import express from 'express';
import dotenv from 'dotenv';
import { BrowserManager } from './browser-manager';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3004');
const browserManager = new BrowserManager();

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  const sessions = browserManager.listSessions();
  res.json({
    status: 'ok',
    service: 'web-automation',
    activeSessions: sessions.data?.total || 0,
    uptime: process.uptime(),
  });
});

// Criar sessão de browser
app.post('/session/create', async (req, res) => {
  const { url, headless } = req.body;
  const result = await browserManager.createSession({ url, headless });
  res.json(result);
});

// Fechar sessão
app.post('/session/close', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId obrigatório' });
  const result = await browserManager.closeSession(sessionId);
  res.json(result);
});

// Listar sessões
app.get('/sessions', (req, res) => {
  res.json(browserManager.listSessions());
});

// Navegar para URL
app.post('/navigate', async (req, res) => {
  const { sessionId, url } = req.body;
  if (!sessionId || !url) return res.status(400).json({ success: false, error: 'sessionId e url obrigatórios' });
  const result = await browserManager.navigate(sessionId, url);
  res.json(result);
});

// Clicar em elemento
app.post('/click', async (req, res) => {
  const { sessionId, selector } = req.body;
  if (!sessionId || !selector) return res.status(400).json({ success: false, error: 'sessionId e selector obrigatórios' });
  const result = await browserManager.click(sessionId, selector);
  res.json(result);
});

// Clicar por texto
app.post('/click-text', async (req, res) => {
  const { sessionId, text, tag } = req.body;
  if (!sessionId || !text) return res.status(400).json({ success: false, error: 'sessionId e text obrigatórios' });
  const result = await browserManager.clickByText(sessionId, text, tag);
  res.json(result);
});

// Digitar texto
app.post('/type', async (req, res) => {
  const { sessionId, selector, text, clear, delay } = req.body;
  if (!sessionId || !selector || text === undefined) return res.status(400).json({ success: false, error: 'sessionId, selector e text obrigatórios' });
  const result = await browserManager.type(sessionId, selector, text, { clear, delay });
  res.json(result);
});

// Login completo
app.post('/login', async (req, res) => {
  const { sessionId, url, usernameSelector, passwordSelector, submitSelector, username, password } = req.body;
  if (!sessionId || !url || !username || !password) {
    return res.status(400).json({ success: false, error: 'sessionId, url, username e password obrigatórios' });
  }
  const result = await browserManager.login(sessionId, {
    url,
    usernameSelector: usernameSelector || 'input[name="username"], input[type="email"], #username, #email',
    passwordSelector: passwordSelector || 'input[name="password"], input[type="password"], #password',
    submitSelector: submitSelector || 'button[type="submit"], input[type="submit"], #login-btn, .login-btn',
    username,
    password,
  });
  res.json(result);
});

// Preencher formulário
app.post('/fill-form', async (req, res) => {
  const { sessionId, fields } = req.body;
  if (!sessionId || !fields) return res.status(400).json({ success: false, error: 'sessionId e fields obrigatórios' });
  const result = await browserManager.fillForm(sessionId, fields);
  res.json(result);
});

// Selecionar opção em dropdown
app.post('/select', async (req, res) => {
  const { sessionId, selector, value } = req.body;
  if (!sessionId || !selector || !value) return res.status(400).json({ success: false, error: 'sessionId, selector e value obrigatórios' });
  const result = await browserManager.select(sessionId, selector, value);
  res.json(result);
});

// Marcar/desmarcar checkbox
app.post('/checkbox', async (req, res) => {
  const { sessionId, selector, checked } = req.body;
  if (!sessionId || !selector) return res.status(400).json({ success: false, error: 'sessionId e selector obrigatórios' });
  const result = await browserManager.checkbox(sessionId, selector, checked !== false);
  res.json(result);
});

// Tirar screenshot
app.post('/screenshot', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId obrigatório' });
  const result = await browserManager.takeScreenshot(sessionId);
  res.json(result);
});

// Obter conteúdo da página (texto, links, botões, inputs)
app.post('/get-content', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId obrigatório' });
  const result = await browserManager.getPageContent(sessionId);
  res.json(result);
});

// Executar JavaScript na página
app.post('/execute-js', async (req, res) => {
  const { sessionId, script } = req.body;
  if (!sessionId || !script) return res.status(400).json({ success: false, error: 'sessionId e script obrigatórios' });
  const result = await browserManager.executeJS(sessionId, script);
  res.json(result);
});

// Aguardar elemento
app.post('/wait-for', async (req, res) => {
  const { sessionId, selector, timeout } = req.body;
  if (!sessionId || !selector) return res.status(400).json({ success: false, error: 'sessionId e selector obrigatórios' });
  const result = await browserManager.waitForSelector(sessionId, selector, timeout);
  res.json(result);
});

// Scroll na página
app.post('/scroll', async (req, res) => {
  const { sessionId, direction, amount } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId obrigatório' });
  const result = await browserManager.scroll(sessionId, direction || 'down', amount);
  res.json(result);
});

// Pressionar tecla
app.post('/press-key', async (req, res) => {
  const { sessionId, key } = req.body;
  if (!sessionId || !key) return res.status(400).json({ success: false, error: 'sessionId e key obrigatórios' });
  const result = await browserManager.pressKey(sessionId, key);
  res.json(result);
});

// Hover em elemento
app.post('/hover', async (req, res) => {
  const { sessionId, selector } = req.body;
  if (!sessionId || !selector) return res.status(400).json({ success: false, error: 'sessionId e selector obrigatórios' });
  const result = await browserManager.hover(sessionId, selector);
  res.json(result);
});

// Listar opções de dropdown
app.post('/dropdown-options', async (req, res) => {
  const { sessionId, selector } = req.body;
  if (!sessionId || !selector) return res.status(400).json({ success: false, error: 'sessionId e selector obrigatórios' });
  const result = await browserManager.getDropdownOptions(sessionId, selector);
  res.json(result);
});

// Cleanup de sessões expiradas
setInterval(() => {
  browserManager.cleanupSessions();
}, 5 * 60 * 1000); // A cada 5 minutos

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web Automation Service rodando na porta ${PORT}`);
});
