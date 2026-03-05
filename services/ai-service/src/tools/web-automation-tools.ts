import { Tool, ToolContext, ToolResult } from './registry';

const WEB_AUTOMATION_URL = process.env.WEB_AUTOMATION_URL || 'http://web-automation:3004';

async function callWebAutomation(endpoint: string, body: any): Promise<any> {
  const response = await fetch(`${WEB_AUTOMATION_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<any>;
}

export function getWebAutomationTools(): Tool[] {
  return [
    // Criar sessão de browser
    {
      name: 'web_open_browser',
      description: 'Abre uma nova sessão de navegador. Pode opcionalmente abrir uma URL. Retorna sessionId para usar nos outros comandos.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL para abrir (opcional)' },
        },
        required: [],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/session/create', { url: params.url });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: `Erro ao abrir navegador: ${(error as Error).message}` };
        }
      },
    },

    // Fechar sessão
    {
      name: 'web_close_browser',
      description: 'Fecha uma sessão de navegador',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão do navegador' },
        },
        required: ['sessionId'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/session/close', { sessionId: params.sessionId });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Navegar para URL
    {
      name: 'web_navigate',
      description: 'Navega para uma URL no navegador',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão do navegador' },
          url: { type: 'string', description: 'URL para navegar' },
        },
        required: ['sessionId', 'url'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/navigate', {
            sessionId: params.sessionId,
            url: params.url,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Clicar em elemento
    {
      name: 'web_click',
      description: 'Clica em um elemento na página usando seletor CSS (ex: #botao, .classe, button[type="submit"])',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão do navegador' },
          selector: { type: 'string', description: 'Seletor CSS do elemento' },
        },
        required: ['sessionId', 'selector'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/click', {
            sessionId: params.sessionId,
            selector: params.selector,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Clicar por texto
    {
      name: 'web_click_text',
      description: 'Clica em um elemento pela seu texto visível (ex: "Login", "Enviar", "Menu")',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
          text: { type: 'string', description: 'Texto visível do elemento' },
          tag: { type: 'string', description: 'Tag HTML (opcional, ex: button, a, div)' },
        },
        required: ['sessionId', 'text'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/click-text', {
            sessionId: params.sessionId,
            text: params.text,
            tag: params.tag,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Digitar texto
    {
      name: 'web_type',
      description: 'Digita texto em um campo de entrada (input, textarea)',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
          selector: { type: 'string', description: 'Seletor CSS do campo' },
          text: { type: 'string', description: 'Texto para digitar' },
          clear: { type: 'boolean', description: 'Limpar campo antes de digitar (padrão: false)' },
        },
        required: ['sessionId', 'selector', 'text'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/type', {
            sessionId: params.sessionId,
            selector: params.selector,
            text: params.text,
            clear: params.clear,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Login completo
    {
      name: 'web_login',
      description: 'Realiza login completo em uma página: navega, preenche usuário/senha e clica em entrar',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
          url: { type: 'string', description: 'URL da página de login' },
          username: { type: 'string', description: 'Nome de usuário ou email' },
          password: { type: 'string', description: 'Senha' },
          usernameSelector: { type: 'string', description: 'Seletor CSS do campo de usuário (opcional)' },
          passwordSelector: { type: 'string', description: 'Seletor CSS do campo de senha (opcional)' },
          submitSelector: { type: 'string', description: 'Seletor CSS do botão de login (opcional)' },
        },
        required: ['sessionId', 'url', 'username', 'password'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/login', {
            sessionId: params.sessionId,
            url: params.url,
            username: params.username,
            password: params.password,
            usernameSelector: params.usernameSelector,
            passwordSelector: params.passwordSelector,
            submitSelector: params.submitSelector,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Preencher formulário
    {
      name: 'web_fill_form',
      description: 'Preenche múltiplos campos de um formulário de uma vez',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
          fields: {
            type: 'array',
            description: 'Lista de campos: [{selector, value, type}]. type pode ser: text, select, checkbox, radio',
          },
        },
        required: ['sessionId', 'fields'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/fill-form', {
            sessionId: params.sessionId,
            fields: params.fields,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Selecionar opção em dropdown
    {
      name: 'web_select',
      description: 'Seleciona uma opção em um dropdown/caixa de seleção',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
          selector: { type: 'string', description: 'Seletor CSS do select' },
          value: { type: 'string', description: 'Valor da opção para selecionar' },
        },
        required: ['sessionId', 'selector', 'value'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/select', {
            sessionId: params.sessionId,
            selector: params.selector,
            value: params.value,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Marcar/desmarcar checkbox
    {
      name: 'web_checkbox',
      description: 'Marca ou desmarca um checkbox',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
          selector: { type: 'string', description: 'Seletor CSS do checkbox' },
          checked: { type: 'boolean', description: 'true para marcar, false para desmarcar' },
        },
        required: ['sessionId', 'selector', 'checked'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/checkbox', {
            sessionId: params.sessionId,
            selector: params.selector,
            checked: params.checked,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Screenshot
    {
      name: 'web_screenshot',
      description: 'Tira um screenshot/captura de tela da página atual no navegador',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
        },
        required: ['sessionId'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/screenshot', { sessionId: params.sessionId });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Obter conteúdo da página
    {
      name: 'web_get_content',
      description: 'Analisa a página atual e retorna: texto visível, links, botões, campos de entrada e checkboxes. Use para entender o que está na página.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
        },
        required: ['sessionId'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/get-content', { sessionId: params.sessionId });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Executar JavaScript
    {
      name: 'web_execute_js',
      description: 'Executa código JavaScript na página do navegador',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
          script: { type: 'string', description: 'Código JavaScript para executar' },
        },
        required: ['sessionId', 'script'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/execute-js', {
            sessionId: params.sessionId,
            script: params.script,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Scroll
    {
      name: 'web_scroll',
      description: 'Rola a página para cima ou para baixo',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
          direction: { type: 'string', enum: ['up', 'down'], description: 'Direção do scroll' },
          amount: { type: 'number', description: 'Quantidade em pixels (padrão: 500)' },
        },
        required: ['sessionId', 'direction'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/scroll', {
            sessionId: params.sessionId,
            direction: params.direction,
            amount: params.amount,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Pressionar tecla
    {
      name: 'web_press_key',
      description: 'Pressiona uma tecla no navegador (Enter, Tab, Escape, etc)',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
          key: { type: 'string', description: 'Tecla para pressionar (Enter, Tab, Escape, ArrowDown, etc)' },
        },
        required: ['sessionId', 'key'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/press-key', {
            sessionId: params.sessionId,
            key: params.key,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Hover
    {
      name: 'web_hover',
      description: 'Passa o mouse sobre um elemento (hover) para revelar menus ou tooltips',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
          selector: { type: 'string', description: 'Seletor CSS do elemento' },
        },
        required: ['sessionId', 'selector'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/hover', {
            sessionId: params.sessionId,
            selector: params.selector,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Listar opções de dropdown
    {
      name: 'web_dropdown_options',
      description: 'Lista todas as opções disponíveis em um dropdown/caixa de seleção',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'ID da sessão' },
          selector: { type: 'string', description: 'Seletor CSS do select' },
        },
        required: ['sessionId', 'selector'],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const result = await callWebAutomation('/dropdown-options', {
            sessionId: params.sessionId,
            selector: params.selector,
          });
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },

    // Listar sessões ativas
    {
      name: 'web_list_sessions',
      description: 'Lista todas as sessões de navegador ativas',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async (params, context): Promise<ToolResult> => {
        try {
          const response = await fetch(`${WEB_AUTOMATION_URL}/sessions`);
          const result: any = await response.json();
          return { success: result.success, data: result.data, error: result.error };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },
  ];
}
