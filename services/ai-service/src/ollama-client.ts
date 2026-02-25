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

    const data = await response.json();
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

    const data = await response.json();
    return data.response;
  }

  private buildSystemPrompt(tools?: OllamaTool[]): string {
    let prompt = `Você é o YChatClaw, um assistente de automação de dispositivos Android.
Você pode controlar dispositivos através das tools disponíveis.

Responda em formato JSON com a seguinte estrutura:
{
  "thought": "seu raciocínio sobre o que o usuário quer",
  "action": "nome_da_tool ou respond",
  "params": { ...parâmetros da tool },
  "response": "mensagem amigável para o usuário (se action=respond)"
}

Tools disponíveis:\n`;

    if (tools && tools.length > 0) {
      for (const tool of tools) {
        prompt += `- ${tool.name}: ${tool.description}\n`;
        prompt += `  Parâmetros: ${JSON.stringify(tool.parameters)}\n\n`;
      }
    }

    prompt += '\n';
    return prompt;
  }
}
