import { OllamaClient } from './ollama-client';
import { ToolRegistry, ToolContext } from './tools/registry';

interface ProcessMessageOptions {
  message: string;
  userId: string;
  channel: string;
  channelId?: string;
  sessionId?: string;
  prisma: any;
  redis: any;
  ollamaClient: OllamaClient;
  toolRegistry: ToolRegistry;
}

interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ParsedAction {
  action: string;
  params: Record<string, any>;
}

// Sessões de browser por usuário
const userBrowserSessions: Map<string, string> = new Map();
// Último URL aberto por usuário (para retry de screenshot)
const userLastUrls: Map<string, string> = new Map();

// Mutex para serializar chamadas ao Ollama (evitar flood)
let ollamaLock: Promise<void> = Promise.resolve();

function withOllamaLock<T>(fn: () => Promise<T>, timeoutMs: number = 90000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Ollama queue timeout')), timeoutMs);
    ollamaLock = ollamaLock.then(async () => {
      try {
        const result = await fn();
        clearTimeout(timer);
        resolve(result);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    }).catch(() => {});
  });
}

export async function processMessage(options: ProcessMessageOptions): Promise<any> {
  const { message, userId, channel, channelId, sessionId, prisma, redis, ollamaClient, toolRegistry } = options;

  // Buscar ou criar usuário
  let user = await prisma.user.findFirst({
    where: { channelType: channel, externalId: userId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        channelType: channel,
        externalId: userId,
        name: userId,
      },
    });
  }

  // Buscar ou criar sessão
  let session = await prisma.session.findFirst({
    where: { userId: user.id, channelType: channel, channelId: channelId || '' },
    orderBy: { lastActivity: 'desc' },
  });

  if (!session) {
    session = await prisma.session.create({
      data: {
        userId: user.id,
        channelType: channel,
        channelId: channelId || '',
        history: [],
        context: {},
      },
    });
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastActivity: new Date() },
  });

  const history: SessionMessage[] = (session.history as SessionMessage[]) || [];
  history.push({ role: 'user', content: message });
  if (history.length > 20) history.shift();

  const toolContext: ToolContext = {
    userId,
    sessionId: session.id,
    prisma,
    redis,
  };

  try {
    // ===== CHAMAR AI (com fallback) =====
    let actions: ParsedAction[] = [];
    let friendlyResponse = '';
    let aiResponse = '';

    try {
      const tools = toolRegistry.getToolDescriptions();
      aiResponse = await withOllamaLock(() => ollamaClient.chat(history, tools));
      console.log(`🤖 AI raw response: ${aiResponse.substring(0, 300)}...`);

      // Parsear JSON da resposta AI
      const parsed = tryParseAiResponse(aiResponse);
      if (parsed) {
        actions = parsed.actions;
        friendlyResponse = parsed.response;
      }
    } catch (aiError) {
      console.error('⚠️ Ollama falhou, usando detecção de intenção:', (aiError as Error).message);
    }

    // ===== FALLBACK: DETECÇÃO DE INTENÇÃO =====
    // Se AI não retornou ações válidas, detectar intenção da mensagem do usuário
    if (actions.length === 0) {
      const detected = detectIntent(message, userId);
      if (detected.actions.length > 0) {
        actions = detected.actions;
        if (!friendlyResponse) {
          friendlyResponse = detected.fallbackResponse;
        }
        console.log(`🔍 Intent detectado: ${detected.actions.map(a => a.action).join(', ')}`);
      }
    }

    // ===== GARANTIR SCREENSHOT =====
    const wantsScreenshot = /print|screenshot|captur|tela|foto.*site|imagem.*site|tir.*print|mand.*print|envi.*print|mand.*screenshot/i.test(message);
    const hasScreenshotAction = actions.some(a => a.action === 'web_screenshot');
    const hasOpenBrowser = actions.some(a => a.action === 'web_open_browser' || a.action === 'web_navigate');
    
    // Salvar URL se houver ação de abrir browser
    const openAction = actions.find(a => (a.action === 'web_open_browser' || a.action === 'web_navigate') && a.params?.url);
    if (openAction?.params?.url) {
      userLastUrls.set(userId, openAction.params.url);
    }

    if (wantsScreenshot && !hasScreenshotAction) {
      // Adicionar screenshot se: tem browser aberto, tem sessão cacheada, ou tem URL anterior
      if (hasOpenBrowser || userBrowserSessions.has(userId) || userLastUrls.has(userId)) {
        actions.push({ action: 'web_screenshot', params: { sessionId: '__auto__' } });
        console.log('📸 Auto-adicionado web_screenshot');
      }
    }

    // ===== EXECUTAR TOOLS =====
    const allToolResults: any[] = [];
    let lastSessionId: string | null = userBrowserSessions.get(userId) || null;

    for (let ai = 0; ai < actions.length; ai++) {
      const actionItem = actions[ai];
      let result = await executeToolAction(
        actionItem.action,
        actionItem.params || {},
        toolRegistry,
        toolContext,
        lastSessionId
      );

      // ===== RETRY: screenshot com sessão morta =====
      if (!result.success && actionItem.action === 'web_screenshot' && 
          (result.error?.includes('não encontrada') || result.error?.includes('not found'))) {
        console.log('🔄 Screenshot falhou (sessão morta). Tentando criar nova sessão...');
        userBrowserSessions.delete(userId);
        lastSessionId = null;

        // Tentar encontrar a URL original para recriar a sessão
        const urlAction = actions.find(a => 
          (a.action === 'web_open_browser' || a.action === 'web_navigate') && a.params?.url
        );
        const retryUrl = urlAction?.params?.url || userLastUrls.get(userId) || 'about:blank';

        const newSession = await executeToolAction(
          'web_open_browser',
          { url: retryUrl },
          toolRegistry,
          toolContext,
          null
        );

        if (newSession.success && newSession.data?.sessionId) {
          lastSessionId = newSession.data.sessionId;
          userBrowserSessions.set(userId, lastSessionId!);
          console.log(`🔄 Nova sessão criada: ${lastSessionId}. Retentando screenshot...`);
          
          // Aguardar página carregar
          await new Promise(r => setTimeout(r, 2000));
          
          result = await executeToolAction(
            'web_screenshot',
            { sessionId: lastSessionId },
            toolRegistry,
            toolContext,
            lastSessionId
          );
          console.log(`🔄 Screenshot retry: ${result.success ? 'sucesso' : 'erro'}`);
        }
      }

      // Limpar sessão cacheada se qualquer ação web falhar com sessão não encontrada
      if (!result.success && result.error?.includes('não encontrada') && actionItem.action.startsWith('web_')) {
        userBrowserSessions.delete(userId);
        lastSessionId = null;
      }

      allToolResults.push(result);

      if (result.success && result.data?.sessionId) {
        lastSessionId = result.data.sessionId;
        userBrowserSessions.set(userId, lastSessionId!);
      }
    }

    // ===== SCREENSHOT DATA =====
    const screenshotResult = allToolResults.find(r => r.success && r.data?.screenshot);
    let screenshotData: string | null = null;
    if (screenshotResult) {
      screenshotData = screenshotResult.data.screenshot;
    }

    // ===== MONTAR RESPOSTA FINAL =====
    friendlyResponse = sanitizeResponse(friendlyResponse);

    if (!friendlyResponse || friendlyResponse.length < 5) {
      if (allToolResults.length > 0) {
        friendlyResponse = generateFriendlyResponse(actions, allToolResults);
      } else {
        const cleanAi = aiResponse ? sanitizeResponse(aiResponse) : '';
        friendlyResponse = cleanAi || 'Oi! Sou o YChatClaw. Posso abrir sites, tirar prints, enviar mensagens e muito mais!';
      }
    }

    // Se o usuário pediu screenshot mas não conseguimos, informar honestamente
    if (wantsScreenshot && !screenshotData) {
      const screenshotFailed = allToolResults.some(r => !r.success && actions[allToolResults.indexOf(r)]?.action === 'web_screenshot');
      if (screenshotFailed) {
        friendlyResponse = friendlyResponse.replace(/tirei.*print.*você/gi, 'Tentei tirar o print mas houve um erro');
        friendlyResponse = friendlyResponse.replace(/print.*capturado/gi, 'Não consegui capturar o print');
        friendlyResponse = friendlyResponse.replace(/screenshot.*capturado/gi, 'Não consegui capturar o screenshot');
        if (!/erro|não consegui|falh/i.test(friendlyResponse)) {
          friendlyResponse += '\n⚠️ Não consegui tirar o screenshot. Tente novamente.';
        }
      }
    }

    // Se screenshot teve sucesso, garantir menção
    if (screenshotData) {
      if (!/print|screenshot|captur/i.test(friendlyResponse)) {
        friendlyResponse += '\n📸 Screenshot capturado!';
      }
    }

    // ===== SALVAR HISTÓRICO =====
    const historyEntry = allToolResults.length > 0
      ? `[Executei ${allToolResults.length} ação(ões)] ${friendlyResponse}`
      : friendlyResponse;
    history.push({ role: 'assistant', content: historyEntry });

    await prisma.session.update({
      where: { id: session.id },
      data: { history: history as any },
    });

    return {
      success: true,
      response: friendlyResponse,
      screenshotData,
      sessionId: session.id,
    };
  } catch (error) {
    console.error('Erro no processamento:', error);
    return {
      success: false,
      response: 'Desculpe, ocorreu um erro. Tente novamente.',
      error: (error as Error).message,
    };
  }
}

// ===== PARSEAR RESPOSTA AI =====
function tryParseAiResponse(raw: string): { actions: ParsedAction[]; response: string } | null {
  // Estratégia 1: resposta inteira é JSON
  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      return normalizeActions(parsed);
    }
  } catch {}

  // Estratégia 2: extrair primeiro JSON { ... } da resposta
  try {
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const jsonStr = raw.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);
      return normalizeActions(parsed);
    }
  } catch {}

  // Estratégia 3: extrair JSON de blocos de código
  try {
    const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) {
      const parsed = JSON.parse(codeMatch[1].trim());
      return normalizeActions(parsed);
    }
  } catch {}

  return null;
}

function normalizeActions(parsed: any): { actions: ParsedAction[]; response: string } {
  const response = parsed.response || '';
  let actions: ParsedAction[] = [];

  if (parsed.actions && Array.isArray(parsed.actions)) {
    actions = parsed.actions.filter((a: any) => a.action && a.action !== 'respond');
  } else if (parsed.action && parsed.action !== 'respond') {
    actions = [{ action: parsed.action, params: parsed.params || {} }];
  }

  return { actions, response };
}

// ===== DETECÇÃO DE INTENÇÃO (FALLBACK) =====
function detectIntent(message: string, userId: string): { actions: ParsedAction[]; fallbackResponse: string } {
  const msg = message.toLowerCase();
  const actions: ParsedAction[] = [];
  let fallbackResponse = '';

  // Detectar URL na mensagem
  const urlMatch = message.match(/https?:\/\/[^\s]+/i);

  // Abrir site
  if (urlMatch && /abr|entre|acesse|naveg|vai|ir|site/i.test(msg)) {
    actions.push({ action: 'web_open_browser', params: { url: urlMatch[0] } });
    fallbackResponse = 'Pronto! Abri o site pra você.';
  }

  // Scroll / rolar página
  if (/rola|scroll|desç|desce|descer|baixo|para baixo/i.test(msg)) {
    const amount = /muito|bastante|todo/i.test(msg) ? 2000 : 1000;
    actions.push({ action: 'web_scroll', params: { sessionId: '__auto__', direction: 'down', amount } });
    fallbackResponse = 'Rolei a página.';
  }
  if (/suba|subir|para cima|topo/i.test(msg)) {
    actions.push({ action: 'web_scroll', params: { sessionId: '__auto__', direction: 'up', amount: 1000 } });
    fallbackResponse = 'Rolei a página para cima.';
  }

  // Clicar em texto específico — extrair texto entre aspas ou após "clic" + "em/na/no"
  const clickTextQuoted = message.match(/["\u201c\u201d]([^"\u201c\u201d]+)["\u201c\u201d]/)
    || message.match(/\u201c([^\u201d]+)\u201d/)
    || message.match(/"([^"]+)"/);
  const wantsClick = /clic|click|aperte|pressione|entr[ea].*(?:em|na|no)|acess/i.test(msg);
  
  if (wantsClick && clickTextQuoted) {
    actions.push({ action: 'web_click_text', params: { sessionId: '__auto__', text: clickTextQuoted[1] } });
    fallbackResponse = `Cliquei em "${clickTextQuoted[1]}".`;
  } else if (wantsClick) {
    // Tentar extrair texto após "clicar em/na/no" sem aspas
    const clickAfter = message.match(/clic\w*\s+(?:em|na|no|nessa?|nesse?)\s+(?:(?:a |o |na )?palavra\s+)?(.+?)(?:\s+e\s+|\s*$)/i);
    if (clickAfter) {
      const clickText = clickAfter[1].replace(/["\u201c\u201d]/g, '').trim();
      if (clickText.length > 1 && clickText.length < 100) {
        actions.push({ action: 'web_click_text', params: { sessionId: '__auto__', text: clickText } });
        fallbackResponse = `Cliquei em "${clickText}".`;
      }
    }
  }

  // Encontrar texto na página (scroll até encontrar) — "encontr" + texto entre aspas
  if (/encontr|procur|ach[ae]|busc/i.test(msg) && clickTextQuoted) {
    // Se não tem scroll ainda, adicionar scroll para procurar
    if (!actions.some(a => a.action === 'web_scroll')) {
      // Scroll bastante para encontrar o elemento
      actions.unshift({ action: 'web_scroll', params: { sessionId: '__auto__', direction: 'down', amount: 1500 } });
    }
  }

  // Screenshot / print
  if (/print|screenshot|screen shot|captur|tira.*tela|foto.*site|tir.*print|mostr.*imagem|traz.*imagem|me mostr|me envi/i.test(msg)) {
    if (!actions.some(a => a.action === 'web_screenshot')) {
      actions.push({ action: 'web_screenshot', params: { sessionId: '__auto__' } });
      if (fallbackResponse) {
        fallbackResponse += '\n📸 Tirei um print pra você!';
      } else {
        fallbackResponse = '📸 Tirei um print pra você!';
      }
    }
  }

  // Enviar mensagem WhatsApp
  const phoneMatch = message.match(/\b(\d{10,13})\b/);
  if (phoneMatch && /mand|envi|envia|fal[ae]|dig[ao]|mensag/i.test(msg)) {
    let msgToSend = '';
    const quotedMatch = message.match(/["\u201c]([^"\u201d]+)["\u201d]/);
    const afterPatternMatch = message.match(/(?:dizendo|falando|com (?:a )?mensagem|(?:o )?texto|(?:o )?conteúdo)\s*[:\-]?\s*(.+)/i);
    
    if (quotedMatch) {
      msgToSend = quotedMatch[1];
    } else if (afterPatternMatch) {
      msgToSend = afterPatternMatch[1].trim();
    } else {
      const afterPhone = message.split(phoneMatch[0])[1];
      if (afterPhone) {
        msgToSend = afterPhone.replace(/^[\s,.:]+/, '').trim();
      }
    }
    
    if (!msgToSend) msgToSend = 'Olá!';
    
    const phone = phoneMatch[1].startsWith('55') ? phoneMatch[1] : `55${phoneMatch[1]}`;
    actions.push({ action: 'send_whatsapp_message', params: { to: phone, message: msgToSend } });
    fallbackResponse = `Mensagem enviada para ${phoneMatch[1]}!`;
  }

  // Listar dispositivos
  if (/disposit|device|aparelho|tablet|celular.*conect|lista.*celular/i.test(msg)) {
    actions.push({ action: 'list_devices', params: {} });
    fallbackResponse = 'Vou verificar os dispositivos conectados...';
  }

  // Comandos para dispositivo Android (abrir app/url no celular)
  const wantsOnDevice = /no celular|no tablet|no dispositivo|no aparelho|no android|no telefone/i.test(msg);
  if (wantsOnDevice && !actions.some(a => a.action === 'send_device_command')) {
    const deviceUrlMatch = message.match(/https?:\/\/[^\s]+/i);
    // Abrir URL no dispositivo
    if (deviceUrlMatch && /abr|acesse|naveg/i.test(msg)) {
      actions.push({ action: 'send_device_command', params: { deviceId: '__first__', commandName: 'open_url', params: { url: deviceUrlMatch[0] } } });
      fallbackResponse = `Abrindo ${deviceUrlMatch[0]} no dispositivo!`;
    }
    // Abrir app no dispositivo
    const appMatch = message.match(/(?:abr[aei]?|acess[ae]|inici[ae]).*?(youtube|whatsapp|chrome|instagram|facebook|twitter|tiktok|spotify|netflix|telegram|gmail|maps|camera|galeria|calculadora|relogio|configurac)/i);
    if (appMatch) {
      const appPackages: Record<string, string> = {
        youtube: 'com.google.android.youtube',
        whatsapp: 'com.whatsapp',
        chrome: 'com.android.chrome',
        instagram: 'com.instagram.android',
        facebook: 'com.facebook.katana',
        twitter: 'com.twitter.android',
        tiktok: 'com.zhiliaoapp.musically',
        spotify: 'com.spotify.music',
        netflix: 'com.netflix.mediaclient',
        telegram: 'org.telegram.messenger',
        gmail: 'com.google.android.gm',
        maps: 'com.google.android.apps.maps',
        camera: 'com.android.camera',
        galeria: 'com.google.android.apps.photos',
        calculadora: 'com.google.android.calculator',
        relogio: 'com.google.android.deskclock',
        configurac: 'com.android.settings',
      };
      const appName = appMatch[1].toLowerCase();
      const pkg = appPackages[appName] || `com.${appName}`;
      actions.push({ action: 'send_device_command', params: { deviceId: '__first__', commandName: 'open_app', params: { package_name: pkg } } });
      fallbackResponse = `Abrindo ${appMatch[1]} no dispositivo!`;
    }
  }

  return { actions, fallbackResponse };
}

// ===== EXECUTAR TOOL =====
async function executeToolAction(
  actionName: string,
  params: any,
  toolRegistry: ToolRegistry,
  context: ToolContext,
  currentSessionId: string | null
): Promise<any> {
  // Auto-fill sessionId
  if (params.sessionId === '__auto__' || params.sessionId === '<sessionId>' || !params.sessionId) {
    if (currentSessionId) {
      params.sessionId = currentSessionId;
    }
  }

  const tool = toolRegistry.get(actionName);
  if (!tool) {
    console.log(`⚠️ Tool não encontrada: ${actionName}`);
    return { success: false, error: `Ferramenta ${actionName} não encontrada` };
  }

  try {
    console.log(`🔧 Executando tool: ${actionName} com params: ${JSON.stringify(params)}`);
    const result = await tool.execute(params, context);
    console.log(`✅ Tool ${actionName} resultado: ${result.success ? 'sucesso' : 'erro'}`);
    return result;
  } catch (error) {
    console.error(`❌ Erro ao executar tool ${actionName}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

// ===== SANITIZAR RESPOSTA =====
function sanitizeResponse(response: string): string {
  if (!response) return '';
  
  let clean = response
    // Remover blocos de código
    .replace(/```[\s\S]*?```/g, '')
    // Remover qualquer JSON completo ou fragmentos
    .replace(/\{[\s\S]*?\}/g, '')
    .replace(/\[[\s\S]*?\]/g, '')
    // Remover fragmentos JSON parciais como },}], "response":"..."
    .replace(/[{}\[\]],?/g, '')
    .replace(/"response"\s*:\s*"[^"]*"/g, '')
    .replace(/"action"\s*:\s*"[^"]*"/g, '')
    .replace(/"params"\s*:\s*/g, '')
    .replace(/"actions"\s*:\s*/g, '')
    .replace(/"[a-zA-Z_]+"\s*:/g, '')
    // Remover nomes de ferramentas
    .replace(/\bweb_\w+/g, '')
    .replace(/\blist_\w+/g, '')
    .replace(/\bsend_\w+/g, '')
    .replace(/\bget_\w+/g, '')
    // Remover termos técnicos
    .replace(/\b(action|params|sessionId|__auto__|targetType|commandName|DEVICE|GROUP|ALL)\b/gi, '')
    .replace(/Ação:.*$/gm, '')
    .replace(/Parâmetros:.*$/gm, '')
    .replace(/<[^>]+>/g, '')
    // Remover aspas soltas e pontuação JSON residual
    .replace(/"+/g, '')
    .replace(/^[\s,.:;]+/gm, '')
    // Limpar espaços extras
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{3,}/g, ' ')
    .trim();

  // Se após sanitizar sobrou só lixo (< 3 chars úteis), retornar vazio
  const useful = clean.replace(/[^a-zA-ZÀ-ú0-9]/g, '');
  if (useful.length < 3) return '';

  return clean;
}

// ===== GERAR RESPOSTA AMIGÁVEL =====
function generateFriendlyResponse(actions: ParsedAction[], results: any[]): string {
  const parts: string[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]?.action;
    const result = results[i];
    if (!result?.success) {
      if (result?.error) {
        console.log(`⚠️ Erro na ação ${action}: ${result.error}`);
      }
      parts.push('Houve um erro ao executar essa ação.');
      continue;
    }

    switch (action) {
      case 'web_open_browser':
        parts.push(`Abri o site${result.data?.title ? ` "${result.data.title}"` : ''}.`);
        break;
      case 'web_navigate':
        parts.push(`Naveguei para ${result.data?.title || result.data?.url || 'a página'}.`);
        break;
      case 'web_screenshot':
        parts.push('📸 Tirei o print da página!');
        break;
      case 'web_click':
      case 'web_click_text':
        parts.push('Cliquei no elemento.');
        break;
      case 'web_type':
        parts.push('Digitei o texto.');
        break;
      case 'web_scroll':
        parts.push('Rolei a página.');
        break;
      case 'web_login':
        parts.push(`Fiz login${result.data?.title ? ` - "${result.data.title}"` : ''}.`);
        break;
      case 'web_get_content':
        if (result.data?.textPreview) {
          parts.push(`Conteúdo: ${result.data.textPreview.substring(0, 200)}`);
        }
        break;
      case 'send_whatsapp_message':
        parts.push(`Mensagem enviada para ${result.data?.to || 'o número'}!`);
        break;
      case 'send_device_command':
        parts.push('Comando enviado para o dispositivo!');
        break;
      case 'list_devices':
        const devices = result.data?.devices;
        if (devices && Array.isArray(devices)) {
          if (devices.length === 0) {
            parts.push('Nenhum dispositivo encontrado.');
          } else {
            parts.push(`Encontrei ${devices.length} dispositivo(s).`);
          }
        }
        break;
      default:
        parts.push('Ação executada!');
    }
  }

  return parts.join('\n') || 'Pronto!';
}
