interface OllamaClientOptions {
  baseUrl: string;
  fastModel: string;   // 0.8b - chat simples, rápido
  smartModel: string;  // 4b - tool calling, tarefas complexas
  visionModel: string;
}

interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export class OllamaClient {
  private baseUrl: string;
  private fastModel: string;
  private smartModel: string;
  private visionModel: string;

  constructor(options: OllamaClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fastModel = options.fastModel;
    this.smartModel = options.smartModel;
    this.visionModel = options.visionModel;
    console.log(`🤖 Modelos: fast=${this.fastModel}, smart=${this.smartModel}, vision=${this.visionModel}`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 1024,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API Ollama: ${response.status}`);
      }

      const data = await response.json() as { response: string };
      return data.response;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Chat rápido (0.8b) - para conversa simples, saudações, perguntas
  async chatFast(messages: ChatMessage[]): Promise<string> {
    return this.chatWithModel(this.fastModel, messages, this.buildSimplePrompt(), 30000, 512);
  }

  // Chat inteligente (4b) - para tool calling, comandos de dispositivo
  async chatSmart(messages: ChatMessage[], tools?: OllamaTool[]): Promise<string> {
    return this.chatWithModel(this.smartModel, messages, this.buildSystemPrompt(tools), 90000, 1024);
  }

  // Método legado - redireciona para chatSmart
  async chat(messages: ChatMessage[], tools?: OllamaTool[]): Promise<string> {
    return this.chatSmart(messages, tools);
  }

  // Classificar se a mensagem precisa de tools (usa 0.8b, ultra-rápido)
  async needsTools(message: string): Promise<boolean> {
    // Primeiro: detecção por regex (instantâneo)
    const toolPatterns = /abr[aei]|acesse?|naveg|pesquis|digit|escrev|clic|print|screenshot|captur|mand.*mensag|envi.*mensag|disposit|device|aparelho|celular|youtube|google|instagram|facebook|whatsapp|spotify|netflix|telegram|https?:\/\//i;
    if (toolPatterns.test(message)) return true;

    // Se não é óbvio, é chat simples
    return false;
  }

  private async chatWithModel(model: string, messages: ChatMessage[], systemPrompt: string, timeoutMs: number, maxTokens: number): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];

      const start = Date.now();
      console.log(`🤖 [${model}] Chat com ${chatMessages.length} msgs`);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: chatMessages,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API Ollama chat (${model}): ${response.status}`);
      }

      const data = await response.json() as { message?: { content: string } };
      const content = data.message?.content || '';
      const elapsed = Date.now() - start;
      console.log(`🤖 [${model}] ${elapsed}ms: ${content.substring(0, 200)}...`);
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateWithVision(prompt: string, imageBase64: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.visionModel,
        prompt,
        images: [imageBase64],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API Ollama: ${response.status}`);
    }

    const data = await response.json() as { response: string };
    return data.response;
  }

  // Prompt simples para chat rápido (0.8b)
  private buildSimplePrompt(): string {
    return `Você é o YChatClaw, assistente pessoal inteligente. Responda SEMPRE em português do Brasil.
Responda APENAS com JSON válido: {"actions":[],"response":"sua resposta"}
Seja amigável e pessoal. Use o histórico da conversa para lembrar o nome do usuário e contexto.
NUNCA coloque JSON no campo response. Seja breve e natural.`;
  }

  // Prompt completo para tarefas complexas (4b)
  private buildSystemPrompt(tools?: OllamaTool[]): string {
    return `Você é o YChatClaw, assistente de automação. Responda SEMPRE em português do Brasil.
Responda APENAS com JSON válido, sem texto antes ou depois.

Use o histórico para lembrar nome do usuário e contexto.

Formato: {"actions":[{"action":"TOOL","params":{}}],"response":"texto"}
Sem ações: {"actions":[],"response":"resposta"}

Ferramentas (celular):
- send_device_command: {"deviceId":"__first__","commandName":"CMD","params":{...}}
  CMDs: open_url({url}), open_app({package_name}), web_type({selector,text}), web_click({selector}), web_screenshot({}), web_get_content({})
- send_whatsapp_message: {"to":"5511...","message":"texto"}
- list_devices: {}

Apps: youtube=com.google.android.youtube, whatsapp=com.whatsapp, chrome=com.android.chrome, instagram=com.instagram.android, facebook=com.facebook.katana, spotify=com.spotify.music, netflix=com.netflix.mediaclient, telegram=org.telegram.messenger

Exemplo: "Abre o Google" → {"actions":[{"action":"send_device_command","params":{"deviceId":"__first__","commandName":"open_url","params":{"url":"https://google.com"}}}],"response":"Abri o Google!"}

REGRAS: Responda SOMENTE JSON. Campo response = texto amigável para o usuário.`;
  }
}
