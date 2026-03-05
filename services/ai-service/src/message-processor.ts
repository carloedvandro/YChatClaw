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

// Armazenar sessões de browser ativas por usuário
const userBrowserSessions: Map<string, string> = new Map();

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
  const sessionKey = sessionId || `${channel}:${userId}`;
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

  // Atualizar última atividade
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActivity: new Date() },
  });

  // Carregar histórico
  const history: SessionMessage[] = (session.history as SessionMessage[]) || [];

  // Adicionar mensagem do usuário
  history.push({ role: 'user', content: message });

  // Manter apenas últimas 20 mensagens
  if (history.length > 20) {
    history.shift();
  }

  const toolContext: ToolContext = {
    userId,
    sessionId: session.id,
    prisma,
    redis,
  };

  try {
    // Chamar Ollama com tools
    const tools = toolRegistry.getToolDescriptions();
    const aiResponse = await ollamaClient.chat(history, tools);
    
    console.log(`🤖 AI raw response: ${aiResponse.substring(0, 200)}...`);

    // Parsear resposta JSON
    let parsedResponse: any;
    try {
      // Tentar extrair JSON da resposta (pegar o JSON mais externo)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = { action: 'respond', response: aiResponse };
      }
    } catch {
      // Se não conseguir parsear JSON, tratar como resposta de texto
      // Limpar qualquer JSON parcial da resposta
      const cleanResponse = aiResponse
        .replace(/\{[\s\S]*$/g, '')
        .replace(/```[\s\S]*```/g, '')
        .trim();
      parsedResponse = { action: 'respond', response: cleanResponse || 'Desculpe, não entendi. Pode reformular?' };
    }

    // Executar tools (suporte a ações múltiplas)
    const allToolResults: any[] = [];
    let lastSessionId: string | null = userBrowserSessions.get(userId) || null;

    if (parsedResponse.actions && Array.isArray(parsedResponse.actions)) {
      // Múltiplas ações em sequência
      for (const actionItem of parsedResponse.actions) {
        const result = await executeToolAction(
          actionItem.action,
          actionItem.params || {},
          toolRegistry,
          toolContext,
          lastSessionId
        );
        allToolResults.push(result);

        // Se a ação criou uma sessão de browser, salvar o sessionId
        if (result.success && result.data?.sessionId) {
          lastSessionId = result.data.sessionId;
          userBrowserSessions.set(userId, lastSessionId!);
        }
      }
    } else if (parsedResponse.action && parsedResponse.action !== 'respond') {
      // Ação única
      const result = await executeToolAction(
        parsedResponse.action,
        parsedResponse.params || {},
        toolRegistry,
        toolContext,
        lastSessionId
      );
      allToolResults.push(result);

      // Se a ação criou uma sessão de browser, salvar o sessionId
      if (result.success && result.data?.sessionId) {
        lastSessionId = result.data.sessionId;
        userBrowserSessions.set(userId, lastSessionId!);
      }
    }

    // Montar resposta final para o usuário
    let finalResponse = parsedResponse.response || '';

    // Se a resposta contém JSON, código ou nomes técnicos, limpar
    finalResponse = sanitizeResponse(finalResponse);

    // Se não tem resposta amigável, gerar uma baseada nos resultados
    if (!finalResponse || finalResponse.length < 3) {
      if (allToolResults.length > 0) {
        finalResponse = generateFriendlyResponse(parsedResponse, allToolResults);
      } else {
        finalResponse = 'Desculpe, não entendi. Pode reformular?';
      }
    }

    // Adicionar info de screenshot se houver
    const screenshotResult = allToolResults.find(r => r.data?.screenshot);
    let screenshotData: string | null = null;
    if (screenshotResult) {
      screenshotData = screenshotResult.data.screenshot;
      if (!finalResponse.toLowerCase().includes('print') && !finalResponse.toLowerCase().includes('screenshot')) {
        finalResponse += '\n📸 Screenshot capturado!';
      }
    }

    // Adicionar resposta ao histórico (sem dados técnicos)
    const historyEntry = allToolResults.length > 0
      ? `[Executei ${allToolResults.length} ação(ões) com sucesso] ${finalResponse}`
      : finalResponse;

    history.push({ role: 'assistant', content: historyEntry });

    // Salvar histórico
    await prisma.session.update({
      where: { id: session.id },
      data: { history: history as any },
    });

    return {
      success: true,
      response: finalResponse,
      screenshotData,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      sessionId: session.id,
    };
  } catch (error) {
    console.error('Erro no processamento:', error);
    return {
      success: false,
      response: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
      error: 'Erro ao processar mensagem',
      details: error instanceof Error ? error.message : undefined,
    };
  }
}

// Executar uma ação de tool individual
async function executeToolAction(
  actionName: string,
  params: any,
  toolRegistry: ToolRegistry,
  context: ToolContext,
  currentSessionId: string | null
): Promise<any> {
  // Substituir __auto__ ou <sessionId> pelo sessionId real
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

// Limpar resposta de qualquer conteúdo técnico
function sanitizeResponse(response: string): string {
  if (!response) return '';
  
  let clean = response
    // Remover blocos de JSON
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\{[\s\S]*?\}/g, '')
    // Remover nomes de ferramentas
    .replace(/web_\w+/g, '')
    .replace(/list_\w+/g, '')
    .replace(/send_\w+/g, '')
    // Remover "Ação:", "Parâmetros:", "sessionId", etc.
    .replace(/Ação:.*$/gm, '')
    .replace(/Parâmetros:.*$/gm, '')
    .replace(/Mensagem:.*$/gm, '')
    .replace(/sessionId/gi, '')
    .replace(/<[^>]+>/g, '')
    // Limpar linhas vazias extras
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return clean;
}

// Gerar resposta amigável baseada nos resultados
function generateFriendlyResponse(parsed: any, results: any[]): string {
  const actions = parsed.actions || [{ action: parsed.action }];
  const parts: string[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i].action || parsed.action;
    const result = results[i];
    const success = result?.success;

    if (!success) {
      parts.push('Houve um erro ao executar essa ação.');
      continue;
    }

    switch (action) {
      case 'web_open_browser':
        parts.push(`Abri o navegador${result.data?.url ? ` na página ${result.data.title || result.data.url}` : ''}.`);
        break;
      case 'web_navigate':
        parts.push(`Naveguei para ${result.data?.title || result.data?.url || 'a página'}.`);
        break;
      case 'web_screenshot':
        parts.push('📸 Tirei o print da página!');
        break;
      case 'web_click':
      case 'web_click_text':
        parts.push('Cliquei no elemento solicitado.');
        break;
      case 'web_type':
        parts.push('Digitei o texto no campo.');
        break;
      case 'web_scroll':
        parts.push('Rolei a página.');
        break;
      case 'web_login':
        parts.push(`Fiz login${result.data?.title ? ` - agora estou na página "${result.data.title}"` : ''}.`);
        break;
      case 'web_get_content':
        if (result.data?.textPreview) {
          parts.push(`Conteúdo da página: ${result.data.textPreview.substring(0, 200)}`);
        }
        break;
      case 'list_devices':
        if (result.data && Array.isArray(result.data)) {
          parts.push(`Encontrei ${result.data.length} dispositivo(s).`);
        }
        break;
      default:
        parts.push('Ação executada com sucesso!');
    }
  }

  return parts.join('\n') || 'Pronto! Ação executada.';
}
