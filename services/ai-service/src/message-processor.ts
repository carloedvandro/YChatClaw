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

export async function processMessage(options: ProcessMessageOptions): Promise<any> {
  const { message, userId, channel, channelId, sessionId, prisma, redis, ollamaClient, toolRegistry } = options;

  // Buscar ou criar sessão
  const sessionKey = sessionId || `${channel}:${userId}`;
  let session = await prisma.session.findFirst({
    where: { userId, channelType: channel, channelId: channelId || '' },
    orderBy: { lastActivity: 'desc' },
  });

  if (!session) {
    session = await prisma.session.create({
      data: {
        userId,
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

  try {
    // Chamar Ollama com tools
    const tools = toolRegistry.getToolDescriptions();
    const aiResponse = await ollamaClient.chat(history, tools);

    // Parsear resposta JSON
    let parsedResponse: any;
    try {
      // Tentar extrair JSON da resposta
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = { action: 'respond', response: aiResponse };
      }
    } catch {
      parsedResponse = { action: 'respond', response: aiResponse };
    }

    // Executar tool se necessário
    let toolResult: any = null;
    if (parsedResponse.action && parsedResponse.action !== 'respond') {
      const tool = toolRegistry.get(parsedResponse.action);
      if (tool) {
        const context: ToolContext = {
          userId,
          sessionId: session.id,
          prisma,
          redis,
        };
        toolResult = await tool.execute(parsedResponse.params || {}, context);
      }
    }

    // Adicionar resposta ao histórico
    const assistantContent = toolResult
      ? `Ação: ${parsedResponse.action}\nResultado: ${JSON.stringify(toolResult)}`
      : parsedResponse.response || aiResponse;

    history.push({ role: 'assistant', content: assistantContent });

    // Salvar histórico
    await prisma.session.update({
      where: { id: session.id },
      data: { history: history as any },
    });

    return {
      success: true,
      response: parsedResponse.response || 'Comando processado',
      action: parsedResponse.action,
      params: parsedResponse.params,
      toolResult,
      sessionId: session.id,
    };
  } catch (error) {
    console.error('Erro no processamento:', error);
    return {
      success: false,
      error: 'Erro ao processar mensagem',
      details: error instanceof Error ? error.message : undefined,
    };
  }
}
