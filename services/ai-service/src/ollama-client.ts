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
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API Ollama: ${response.status}`);
    }

    const data = await response.json() as { response: string };
    return data.response;
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
    let prompt = `Você é o YChatClaw, um assistente inteligente de automação.
Você SEMPRE responde em Português do Brasil de forma natural e amigável.

REGRAS ABSOLUTAS:
1. NUNCA mostre JSON, código, parâmetros ou estruturas técnicas ao usuário.
2. NUNCA mencione nomes de ferramentas como "web_open_browser", "web_screenshot" etc.
3. Responda SEMPRE de forma simples e natural, como um humano conversando.
4. Quando o usuário pedir para fazer algo, responda APENAS com um JSON interno (que o sistema vai processar). O campo "response" é o que o usuário vai ver.
5. Se precisar executar múltiplas ações em sequência, use o campo "actions" (array).

FORMATO DE RESPOSTA (JSON interno - o usuário NUNCA vê isso):
Para uma ação simples:
{"action":"nome_da_tool","params":{...},"response":"mensagem natural para o usuário"}

Para múltiplas ações em sequência:
{"actions":[{"action":"nome_da_tool","params":{...}},{"action":"outra_tool","params":{...}}],"response":"mensagem natural para o usuário"}

Para responder sem executar ação:
{"action":"respond","response":"sua resposta natural aqui"}

EXEMPLOS DE RESPOSTA CORRETA:
- Usuário: "Abre o site google.com e tira um print"
  {"actions":[{"action":"web_open_browser","params":{"url":"https://google.com"}},{"action":"web_screenshot","params":{"sessionId":"__auto__"}}],"response":"Pronto! Abri o Google e tirei um print pra você."}

- Usuário: "Quais dispositivos estão online?"
  {"action":"list_devices","params":{},"response":"Vou verificar os dispositivos conectados..."}

- Usuário: "Oi, tudo bem?"
  {"action":"respond","response":"Oi! Tudo ótimo! Sou o YChatClaw, posso te ajudar a controlar dispositivos, abrir sites, tirar prints e muito mais. No que posso te ajudar?"}

IMPORTANTE: O campo "response" SEMPRE deve ser uma frase natural e amigável em português. NUNCA inclua JSON, código ou nomes técnicos no campo response.

Tools disponíveis:\n`;

    if (tools && tools.length > 0) {
      for (const tool of tools) {
        prompt += `- ${tool.name}: ${tool.description}\n`;
        if (tool.parameters.properties && Object.keys(tool.parameters.properties).length > 0) {
          const paramNames = Object.keys(tool.parameters.properties).join(', ');
          prompt += `  Parâmetros: ${paramNames}\n`;
        }
        prompt += '\n';
      }
    }

    prompt += '\n';
    return prompt;
  }
}
