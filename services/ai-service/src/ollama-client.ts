interface OllamaClientOptions {
  baseUrl: string;
  model: string;
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
  private model: string;
  private visionModel: string;

  constructor(options: OllamaClientOptions) {
    this.baseUrl = options.baseUrl;
    this.model = options.model;
    this.visionModel = options.visionModel;
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

  async chat(messages: ChatMessage[], tools?: OllamaTool[]): Promise<string> {
    // Construir prompt com histórico
    let prompt = this.buildSystemPrompt(tools);
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        prompt += `System: ${msg.content}\n`;
      } else if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else {
        prompt += `Assistant: ${msg.content}\n`;
      }
    }
    
    prompt += 'Assistant: ';

    return this.generate(prompt);
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

  private buildSystemPrompt(tools?: OllamaTool[]): string {
    let prompt = `Você é o YChatClaw, assistente de automação. Responda SEMPRE em português do Brasil.
Responda APENAS com JSON válido, nada mais. Sem texto antes ou depois do JSON.

Formato obrigatório:
{"actions":[{"action":"TOOL","params":{}}],"response":"texto amigável"}

Se não precisa executar nenhuma ferramenta:
{"actions":[],"response":"sua resposta aqui"}

Ferramentas:
- web_open_browser: abre site. params: {"url":"https://..."}
- web_screenshot: tira print. params: {"sessionId":"__auto__"}
- web_navigate: navega para URL. params: {"sessionId":"__auto__","url":"https://..."}
- web_click_text: clica em texto. params: {"sessionId":"__auto__","text":"texto do link"}
- web_type: digita em campo. params: {"sessionId":"__auto__","selector":"input","text":"texto"}
- web_login: login. params: {"sessionId":"__auto__","usernameSelector":"#user","passwordSelector":"#pass","username":"user","password":"pass"}
- web_scroll: rola página. params: {"sessionId":"__auto__","direction":"down","amount":500}
- web_get_content: lê conteúdo. params: {"sessionId":"__auto__"}
- web_close_browser: fecha navegador. params: {"sessionId":"__auto__"}
- send_whatsapp_message: envia mensagem WhatsApp. params: {"to":"5511999999999","message":"texto"}
- list_devices: lista dispositivos. params: {}

Exemplos:
User: "Abre google.com e tira um print"
{"actions":[{"action":"web_open_browser","params":{"url":"https://google.com"}},{"action":"web_screenshot","params":{"sessionId":"__auto__"}}],"response":"Pronto! Abri o Google e tirei um print pra você."}

User: "Manda oi pro 5511999999999"
{"actions":[{"action":"send_whatsapp_message","params":{"to":"5511999999999","message":"Oi"}}],"response":"Mensagem enviada!"}

User: "Oi tudo bem?"
{"actions":[],"response":"Oi! Tudo ótimo! Sou o YChatClaw. Posso abrir sites, tirar prints, enviar mensagens e muito mais!"}

REGRAS: responda SOMENTE JSON. O campo "response" é o que o usuário vai ler, então seja natural e amigável. NUNCA coloque JSON ou código no campo response.
`;
    return prompt;
  }
}
