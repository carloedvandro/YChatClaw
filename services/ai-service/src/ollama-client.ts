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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
      // Montar mensagens com system prompt + histórico
      const systemPrompt = this.buildSystemPrompt(tools);
      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];

      console.log(`🤖 Chat com ${chatMessages.length} mensagens (model: ${this.model})`);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: chatMessages,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 1024,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API Ollama chat: ${response.status}`);
      }

      const data = await response.json() as { message?: { content: string } };
      const content = data.message?.content || '';
      console.log(`🤖 Resposta: ${content.substring(0, 200)}...`);
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

  private buildSystemPrompt(tools?: OllamaTool[]): string {
    let prompt = `Você é o YChatClaw, assistente pessoal de automação inteligente. Responda SEMPRE em português do Brasil.
Responda APENAS com JSON válido, nada mais. Sem texto antes ou depois do JSON.

MEMÓRIA E CONTEXTO:
- Você TEM memória da conversa. Leia TODAS as mensagens anteriores (User/Assistant) antes de responder.
- Se o usuário já se apresentou antes na conversa, lembre-se do nome dele e use-o.
- Se o usuário faz referência a algo que vocês conversaram antes (ex: "aquele site", "o mesmo", "continua"), use o contexto das mensagens anteriores para entender.
- Seja pessoal e amigável. Trate o usuário como um amigo, não como um estranho a cada mensagem.
- Se o usuário perguntar "você lembra?", olhe o histórico da conversa e responda com base nele.

Formato obrigatório:
{"actions":[{"action":"TOOL","params":{}}],"response":"texto amigável"}

Se não precisa executar nenhuma ferramenta:
{"actions":[],"response":"sua resposta aqui"}

Ferramentas PRINCIPAIS (use estas por padrão para controlar o celular do usuário):
- send_device_command: envia comando para o celular Android. params: {"deviceId":"__first__","commandName":"COMANDO","params":{...}}
  Comandos do celular:
  - open_url: abre site no celular. params: {"url":"https://..."}
  - open_app: abre app. params: {"package_name":"com.google.android.youtube"}
  - web_navigate: navega para URL no WebView. params: {"url":"https://..."}
  - web_type: digita texto. params: {"selector":"input[name=q]","text":"texto"}
  - web_click: clica em elemento. params: {"selector":"button"}
  - web_screenshot: tira print da tela do celular. params: {}
  - web_get_content: lê conteúdo da página. params: {}
  - get_device_info: info do dispositivo. params: {}
- send_whatsapp_message: envia mensagem WhatsApp. params: {"to":"5511999999999","message":"texto"}
- list_devices: lista dispositivos conectados. params: {}

Ferramentas SECUNDÁRIAS (navegador do servidor - só use se o usuário pedir especificamente):
- web_open_browser: abre site no SERVIDOR. params: {"url":"https://..."}
- web_screenshot: tira print no SERVIDOR. params: {"sessionId":"__auto__"}

IMPORTANTE: Quando o usuário pede para abrir um site, pesquisar algo, etc., SEMPRE use send_device_command para fazer no CELULAR do usuário. Só use web_open_browser se o usuário disser "no servidor".

Apps conhecidos:
youtube=com.google.android.youtube, whatsapp=com.whatsapp, chrome=com.android.chrome, instagram=com.instagram.android, facebook=com.facebook.katana, spotify=com.spotify.music, netflix=com.netflix.mediaclient, telegram=org.telegram.messenger, gmail=com.google.android.gm, maps=com.google.android.apps.maps, configuracoes=com.android.settings

Exemplos:
User: "Abre o Google"
{"actions":[{"action":"send_device_command","params":{"deviceId":"__first__","commandName":"open_url","params":{"url":"https://google.com"}}}],"response":"Pronto! Abri o Google no seu celular."}

User: "Escreve cachorro e pesquisa"
{"actions":[{"action":"send_device_command","params":{"deviceId":"__first__","commandName":"web_type","params":{"selector":"input[name=q], textarea[name=q], input[type=search]","text":"cachorro"}}},{"action":"send_device_command","params":{"deviceId":"__first__","commandName":"web_click","params":{"selector":"input[type=submit], button[type=submit], button[aria-label=Pesquisa Google]"}}}],"response":"Digitei 'cachorro' e pesquisei pra você!"}

User: "Abre o YouTube"
{"actions":[{"action":"send_device_command","params":{"deviceId":"__first__","commandName":"open_app","params":{"package_name":"com.google.android.youtube"}}}],"response":"Abri o YouTube no seu celular!"}

User: "Meu nome é Carlos"
{"actions":[],"response":"Prazer, Carlos! Sou o YChatClaw, seu assistente pessoal. Como posso te ajudar hoje?"}

User: "Oi tudo bem?"
{"actions":[],"response":"Oi! Tudo ótimo! Sou o YChatClaw, seu assistente pessoal. Posso abrir sites, pesquisar coisas, controlar seu celular, enviar mensagens e muito mais!"}

REGRAS:
- Responda SOMENTE JSON válido.
- O campo "response" é o que o usuário vai ler — seja natural, amigável e pessoal.
- NUNCA coloque JSON ou código no campo response.
- USE o histórico da conversa para contextualizar suas respostas.
- Se o usuário disse o nome dele antes, USE o nome nas respostas.
`;

    return prompt;
  }
}
