import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

export interface BrowserSession {
  id: string;
  browser: Browser;
  page: Page;
  createdAt: Date;
  lastActivity: Date;
  url: string;
  title: string;
}

export interface ActionResult {
  success: boolean;
  data?: any;
  screenshot?: string;
  error?: string;
}

export class BrowserManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private maxSessions = parseInt(process.env.MAX_BROWSER_SESSIONS || '5');
  private defaultTimeout = parseInt(process.env.BROWSER_TIMEOUT || '30000');

  async createSession(options?: { url?: string; headless?: boolean }): Promise<ActionResult> {
    if (this.sessions.size >= this.maxSessions) {
      // Fechar sessão mais antiga
      const oldest = Array.from(this.sessions.entries())
        .sort((a, b) => a[1].lastActivity.getTime() - b[1].lastActivity.getTime())[0];
      if (oldest) await this.closeSession(oldest[0]);
    }

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--window-size=1366,768',
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      const sessionId = uuidv4();
      const url = options?.url || 'about:blank';

      if (url !== 'about:blank') {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: this.defaultTimeout });
      }

      const title = await page.title();

      const session: BrowserSession = {
        id: sessionId,
        browser,
        page,
        createdAt: new Date(),
        lastActivity: new Date(),
        url: page.url(),
        title,
      };

      this.sessions.set(sessionId, session);

      console.log(`🌐 Sessão criada: ${sessionId} -> ${url}`);

      return {
        success: true,
        data: { sessionId, url: page.url(), title },
      };
    } catch (error) {
      return { success: false, error: `Erro ao criar sessão: ${(error as Error).message}` };
    }
  }

  async closeSession(sessionId: string): Promise<ActionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      await session.browser.close();
      this.sessions.delete(sessionId);
      console.log(`🔒 Sessão fechada: ${sessionId}`);
      return { success: true, data: { sessionId } };
    } catch (error) {
      this.sessions.delete(sessionId);
      return { success: false, error: (error as Error).message };
    }
  }

  async navigate(sessionId: string, url: string): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      await session.page.goto(url, { waitUntil: 'networkidle2', timeout: this.defaultTimeout });
      session.url = session.page.url();
      session.title = await session.page.title();
      session.lastActivity = new Date();

      return {
        success: true,
        data: { url: session.url, title: session.title },
      };
    } catch (error) {
      return { success: false, error: `Erro ao navegar: ${(error as Error).message}` };
    }
  }

  async click(sessionId: string, selector: string): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      await session.page.waitForSelector(selector, { timeout: this.defaultTimeout });
      await session.page.click(selector);
      session.lastActivity = new Date();
      await this.waitForNavigation(session.page);

      return {
        success: true,
        data: { selector, url: session.page.url(), title: await session.page.title() },
      };
    } catch (error) {
      return { success: false, error: `Erro ao clicar: ${(error as Error).message}` };
    }
  }

  async type(sessionId: string, selector: string, text: string, options?: { clear?: boolean; delay?: number }): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      await session.page.waitForSelector(selector, { timeout: this.defaultTimeout });

      if (options?.clear) {
        await session.page.click(selector, { clickCount: 3 });
        await session.page.keyboard.press('Backspace');
      }

      await session.page.type(selector, text, { delay: options?.delay || 50 });
      session.lastActivity = new Date();

      return { success: true, data: { selector, textLength: text.length } };
    } catch (error) {
      return { success: false, error: `Erro ao digitar: ${(error as Error).message}` };
    }
  }

  async login(sessionId: string, options: {
    url: string;
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
    username: string;
    password: string;
  }): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      // Navegar para página de login
      await session.page.goto(options.url, { waitUntil: 'networkidle2', timeout: this.defaultTimeout });

      // Preencher username
      await session.page.waitForSelector(options.usernameSelector, { timeout: this.defaultTimeout });
      await session.page.type(options.usernameSelector, options.username, { delay: 50 });

      // Preencher password
      await session.page.waitForSelector(options.passwordSelector, { timeout: this.defaultTimeout });
      await session.page.type(options.passwordSelector, options.password, { delay: 50 });

      // Clicar no botão de submit
      await session.page.waitForSelector(options.submitSelector, { timeout: this.defaultTimeout });
      await session.page.click(options.submitSelector);

      // Aguardar navegação
      await session.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: this.defaultTimeout }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));

      session.url = session.page.url();
      session.title = await session.page.title();
      session.lastActivity = new Date();

      const screenshot = await this.takeScreenshot(sessionId);

      return {
        success: true,
        data: { url: session.url, title: session.title, loggedIn: true },
        screenshot: screenshot.data?.screenshot,
      };
    } catch (error) {
      return { success: false, error: `Erro no login: ${(error as Error).message}` };
    }
  }

  async fillForm(sessionId: string, fields: { selector: string; value: string; type?: string }[]): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      const results: any[] = [];

      for (const field of fields) {
        await session.page.waitForSelector(field.selector, { timeout: 10000 });

        if (field.type === 'select') {
          await session.page.select(field.selector, field.value);
        } else if (field.type === 'checkbox') {
          const isChecked = await session.page.$eval(field.selector, (el: any) => el.checked);
          const shouldCheck = field.value === 'true' || field.value === '1';
          if (isChecked !== shouldCheck) {
            await session.page.click(field.selector);
          }
        } else if (field.type === 'radio') {
          await session.page.click(field.selector);
        } else {
          // Text input
          await session.page.click(field.selector, { clickCount: 3 });
          await session.page.keyboard.press('Backspace');
          await session.page.type(field.selector, field.value, { delay: 30 });
        }

        results.push({ selector: field.selector, filled: true });
      }

      session.lastActivity = new Date();
      return { success: true, data: { filledFields: results.length, results } };
    } catch (error) {
      return { success: false, error: `Erro ao preencher formulário: ${(error as Error).message}` };
    }
  }

  async select(sessionId: string, selector: string, value: string): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      await session.page.waitForSelector(selector, { timeout: this.defaultTimeout });
      await session.page.select(selector, value);
      session.lastActivity = new Date();

      return { success: true, data: { selector, value } };
    } catch (error) {
      return { success: false, error: `Erro ao selecionar: ${(error as Error).message}` };
    }
  }

  async checkbox(sessionId: string, selector: string, checked: boolean): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      await session.page.waitForSelector(selector, { timeout: this.defaultTimeout });
      const isChecked = await session.page.$eval(selector, (el: any) => el.checked);

      if (isChecked !== checked) {
        await session.page.click(selector);
      }

      session.lastActivity = new Date();
      return { success: true, data: { selector, checked } };
    } catch (error) {
      return { success: false, error: `Erro no checkbox: ${(error as Error).message}` };
    }
  }

  async takeScreenshot(sessionId: string): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      const screenshot = await session.page.screenshot({ encoding: 'base64', type: 'png' });
      session.lastActivity = new Date();

      return {
        success: true,
        data: { screenshot: `data:image/png;base64,${screenshot}` },
      };
    } catch (error) {
      return { success: false, error: `Erro no screenshot: ${(error as Error).message}` };
    }
  }

  async getPageContent(sessionId: string): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      const content = await session.page.evaluate(() => {
        // Extrair texto visível e links da página
        const body = document.body;
        const text = body?.innerText?.substring(0, 5000) || '';
        const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 20).map(a => ({
          text: (a as HTMLAnchorElement).innerText?.trim().substring(0, 100),
          href: (a as HTMLAnchorElement).href,
        }));
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')).slice(0, 20).map(b => ({
          text: (b as HTMLElement).innerText?.trim() || (b as HTMLInputElement).value || '',
          id: b.id,
          class: b.className,
        }));
        const inputs = Array.from(document.querySelectorAll('input, textarea, select')).slice(0, 20).map(i => ({
          type: (i as HTMLInputElement).type || i.tagName.toLowerCase(),
          name: (i as HTMLInputElement).name,
          id: i.id,
          placeholder: (i as HTMLInputElement).placeholder || '',
          value: (i as HTMLInputElement).value?.substring(0, 100) || '',
        }));
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).slice(0, 20).map(c => ({
          name: (c as HTMLInputElement).name,
          id: c.id,
          checked: (c as HTMLInputElement).checked,
          label: c.closest('label')?.innerText?.trim() || '',
        }));

        return {
          title: document.title,
          url: window.location.href,
          textPreview: text.substring(0, 2000),
          links,
          buttons,
          inputs,
          checkboxes,
        };
      });

      session.lastActivity = new Date();
      return { success: true, data: content };
    } catch (error) {
      return { success: false, error: `Erro ao extrair conteúdo: ${(error as Error).message}` };
    }
  }

  async executeJS(sessionId: string, script: string): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      const result = await session.page.evaluate(script);
      session.lastActivity = new Date();

      return { success: true, data: { result } };
    } catch (error) {
      return { success: false, error: `Erro ao executar JS: ${(error as Error).message}` };
    }
  }

  async waitForSelector(sessionId: string, selector: string, timeout?: number): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      await session.page.waitForSelector(selector, { timeout: timeout || this.defaultTimeout });
      session.lastActivity = new Date();

      return { success: true, data: { selector, found: true } };
    } catch (error) {
      return { success: false, error: `Timeout esperando: ${selector}` };
    }
  }

  async scroll(sessionId: string, direction: 'up' | 'down', amount?: number): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      const pixels = amount || 500;
      await session.page.evaluate((dir: string, px: number) => {
        window.scrollBy(0, dir === 'down' ? px : -px);
      }, direction, pixels);
      session.lastActivity = new Date();

      return { success: true, data: { direction, amount: pixels } };
    } catch (error) {
      return { success: false, error: `Erro ao rolar: ${(error as Error).message}` };
    }
  }

  async pressKey(sessionId: string, key: string): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      await session.page.keyboard.press(key as any);
      session.lastActivity = new Date();

      return { success: true, data: { key } };
    } catch (error) {
      return { success: false, error: `Erro ao pressionar tecla: ${(error as Error).message}` };
    }
  }

  async hover(sessionId: string, selector: string): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      await session.page.waitForSelector(selector, { timeout: this.defaultTimeout });
      await session.page.hover(selector);
      session.lastActivity = new Date();

      return { success: true, data: { selector } };
    } catch (error) {
      return { success: false, error: `Erro no hover: ${(error as Error).message}` };
    }
  }

  async clickByText(sessionId: string, text: string, tag?: string): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      const tagName = tag || '*';
      const elements = await session.page.$x(
        `//${tagName}[contains(text(), '${text.replace(/'/g, "\\'")}')]`
      );

      if (elements.length === 0) {
        return { success: false, error: `Elemento com texto "${text}" não encontrado` };
      }

      await (elements[0] as ElementHandle<Element>).click();
      session.lastActivity = new Date();
      await this.waitForNavigation(session.page);

      return {
        success: true,
        data: { text, url: session.page.url(), title: await session.page.title() },
      };
    } catch (error) {
      return { success: false, error: `Erro ao clicar por texto: ${(error as Error).message}` };
    }
  }

  async getDropdownOptions(sessionId: string, selector: string): Promise<ActionResult> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: 'Sessão não encontrada' };

    try {
      await session.page.waitForSelector(selector, { timeout: this.defaultTimeout });
      const options = await session.page.$$eval(`${selector} option`, (opts: any[]) =>
        opts.map(o => ({ value: o.value, text: o.innerText?.trim(), selected: o.selected }))
      );
      session.lastActivity = new Date();

      return { success: true, data: { selector, options } };
    } catch (error) {
      return { success: false, error: `Erro ao listar opções: ${(error as Error).message}` };
    }
  }

  listSessions(): ActionResult {
    const sessions = Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      url: s.url,
      title: s.title,
      createdAt: s.createdAt,
      lastActivity: s.lastActivity,
    }));

    return { success: true, data: { sessions, total: sessions.length } };
  }

  private getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  private async waitForNavigation(page: Page): Promise<void> {
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 3000 });
    } catch {
      // Navegação pode não acontecer em todos os cliques
    }
  }

  async cleanupSessions(): Promise<void> {
    const timeout = 30 * 60 * 1000; // 30 minutos
    const now = Date.now();

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > timeout) {
        await this.closeSession(id);
        console.log(`🧹 Sessão expirada removida: ${id}`);
      }
    }
  }
}
