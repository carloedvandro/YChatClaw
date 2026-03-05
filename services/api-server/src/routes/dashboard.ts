import express from 'express';

const router = express.Router();

// Middleware de autenticação simples
router.use('/', (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== 'Basic YWRtaW46eWNoYXRjbGF3MTIz') {
    res.set('WWW-Authenticate', 'Basic realm="YChatClaw Dashboard"');
    return res.status(401).send('Acesso negado');
  }
  next();
});

// Página principal do Dashboard
router.get('/', (req, res) => {
  res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
  res.send(getDashboardHTML());
});

// Rota para obter QR Code do WhatsApp
router.get('/whatsapp-qr', async (req, res) => {
  try {
    const response = await fetch('http://whatsapp-gateway:3003/qrcode');
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    res.json({ 
      qr: null,
      message: 'Erro ao buscar QR Code',
      error: (error as Error).message,
      status: 'error'
    });
  }
});

// Rota para gerar QR Code do WhatsApp
router.post('/whatsapp-generate-qr', async (req, res) => {
  try {
    const response = await fetch('http://whatsapp-gateway:3003/generate-qr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    res.json({ 
      qr: null,
      message: 'Erro ao gerar QR Code',
      error: (error as Error).message,
      status: 'error'
    });
  }
});

// Rota para status do WhatsApp
router.get('/whatsapp-status', async (req, res) => {
  try {
    const response = await fetch('http://whatsapp-gateway:3003/status');
    const status = await response.json();
    
    res.json(status);
  } catch (error) {
    res.json({
      connectionStatus: 'disconnected',
      qrAvailable: false,
      qrTimestamp: null,
      timestamp: new Date().toISOString(),
      message: 'WhatsApp Gateway não está respondendo',
      error: (error as Error).message
    });
  }
});

// Rota agregada de estatísticas para o dashboard
router.get('/stats', async (req, res) => {
  try {
    const [healthRes, waRes, aiRes] = await Promise.allSettled([
      fetch('http://localhost:3000/health/stats'),
      fetch('http://whatsapp-gateway:3003/status'),
      fetch('http://ai-service:3002/health'),
    ]);

    const stats = healthRes.status === 'fulfilled' ? await healthRes.value.json() : {};
    const waStatus = waRes.status === 'fulfilled' ? await waRes.value.json() : { connectionStatus: 'offline' };
    const aiStatus = aiRes.status === 'fulfilled' ? await aiRes.value.json() : { status: 'unhealthy', ollama: 'disconnected' };

    res.json({
      devices: stats.devices || {},
      commands: stats.commands || {},
      users: stats.users || 0,
      queueSize: stats.queueSize || 0,
      whatsapp: waStatus,
      ai: aiStatus,
    });
  } catch (error) {
    res.json({ devices: {}, commands: {}, users: 0, queueSize: 0, whatsapp: { connectionStatus: 'offline' }, ai: { status: 'unhealthy' } });
  }
});

// Rota para status do AI / Ollama
router.get('/ai-status', async (req, res) => {
  try {
    const [healthRes, modelsRes] = await Promise.allSettled([
      fetch('http://ai-service:3002/health'),
      fetch((process.env.OLLAMA_URL || 'http://ollama:11434') + '/api/tags'),
    ]);

    const health = healthRes.status === 'fulfilled' ? await healthRes.value.json() : { status: 'unhealthy' };
    const modelsData = modelsRes.status === 'fulfilled' ? await modelsRes.value.json() : { models: [] };

    res.json({
      service: health,
      models: (modelsData.models || []).map((m: any) => ({
        name: m.name,
        size: m.size,
        family: m.details?.family,
        parameterSize: m.details?.parameter_size,
        quantization: m.details?.quantization_level,
      })),
      config: {
        model: process.env.OLLAMA_MODEL || 'llama3:8b',
        visionModel: process.env.OLLAMA_VISION_MODEL || 'llava:13b',
        url: process.env.OLLAMA_URL || 'http://host.docker.internal:11434',
      },
    });
  } catch (error) {
    res.json({ service: { status: 'unhealthy' }, models: [], config: {} });
  }
});

// Rota para enviar mensagem de teste via AI
router.post('/test-ai', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await fetch('http://ai-service:3002/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message || 'Olá, quem é você?',
        userId: 'dashboard-admin',
        channel: 'dashboard',
        channelId: 'admin',
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.json({ success: false, error: (error as Error).message });
  }
});

// Rota para enviar mensagem via WhatsApp
router.post('/send-whatsapp', async (req, res) => {
  try {
    const { to, message } = req.body;
    const response = await fetch('http://whatsapp-gateway:3003/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message }),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.json({ success: false, error: (error as Error).message });
  }
});

// Rota para desconectar WhatsApp
router.post('/whatsapp-disconnect', async (req, res) => {
  try {
    const response = await fetch('http://whatsapp-gateway:3003/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.json({ status: 'error', message: (error as Error).message });
  }
});

// Rota para listar mensagens WhatsApp recentes
router.get('/whatsapp-messages', async (req, res) => {
  try {
    const response = await fetch('http://whatsapp-gateway:3003/messages');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.json({ messages: [], totalCount: 0 });
  }
});

// Rota para verificar serviços individualmente
router.get('/services-health', async (req, res) => {
  const checks = await Promise.allSettled([
    fetch('http://localhost:3000/health').then(r => r.json()),
    fetch('http://whatsapp-gateway:3003/health').then(r => r.json()),
    fetch('http://ai-service:3002/health').then(r => r.json()),
    fetch('http://websocket-server:3005/health').then(r => r.json()),
    fetch('http://web-automation:3004/health').then(r => r.json()),
  ]);

  const getName = (i: number) => ['API Server', 'WhatsApp Gateway', 'AI Service', 'WebSocket Server', 'Web Automation'][i];
  const services = checks.map((c, i) => ({
    name: getName(i),
    status: c.status === 'fulfilled' ? 'online' : 'offline',
  }));

  res.json({ services });
});

// === Device Control Proxy Routes ===
router.get('/devices', async (req, res) => {
  try {
    // Get devices from database
    const dbRes = await fetch('http://localhost:3000/api/devices');
    const dbData = await dbRes.json() as any;
    // Get connected devices from WebSocket server
    let wsDevices: any[] = [];
    try {
      const wsRes = await fetch('http://websocket-server:3005/devices');
      const wsData = await wsRes.json() as any;
      wsDevices = wsData.devices || [];
    } catch (e) { /* WebSocket server may be down */ }
    // Merge: mark which DB devices are actually connected via WS
    const wsIds = new Set(wsDevices.filter((d: any) => d.connected).map((d: any) => d.id));
    const devices = (dbData.devices || []).map((d: any) => ({
      ...d,
      wsConnected: wsIds.has(d.id),
    }));
    res.json({ devices });
  } catch (error) {
    res.json({ devices: [], error: (error as Error).message });
  }
});

router.post('/send-device-command', async (req, res) => {
  try {
    const { deviceId, commandName, params } = req.body;
    if (!deviceId || !commandName) {
      return res.status(400).json({ success: false, error: 'deviceId e commandName obrigatórios' });
    }
    // Send directly via WebSocket server HTTP API
    const wsRes = await fetch('http://websocket-server:3005/send-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        command: { id: `dash-${Date.now()}`, commandName, params: params || {} },
      }),
    });
    const data = await wsRes.json();
    res.json(data);
  } catch (error) {
    res.json({ success: false, error: (error as Error).message });
  }
});

// === Web Automation Proxy Routes ===
router.get('/web-sessions', async (req, res) => {
  try {
    const r = await fetch('http://web-automation:3004/sessions');
    const data = await r.json();
    res.json(data);
  } catch (error) { res.json({ success: false, data: { sessions: [], total: 0 } }); }
});

router.post('/web-create-session', async (req, res) => {
  try {
    const r = await fetch('http://web-automation:3004/session/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await r.json());
  } catch (error) { res.json({ success: false, error: (error as Error).message }); }
});

router.post('/web-close-session', async (req, res) => {
  try {
    const r = await fetch('http://web-automation:3004/session/close', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await r.json());
  } catch (error) { res.json({ success: false, error: (error as Error).message }); }
});

router.post('/web-navigate', async (req, res) => {
  try {
    const r = await fetch('http://web-automation:3004/navigate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await r.json());
  } catch (error) { res.json({ success: false, error: (error as Error).message }); }
});

router.post('/web-click', async (req, res) => {
  try {
    const r = await fetch('http://web-automation:3004/click', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await r.json());
  } catch (error) { res.json({ success: false, error: (error as Error).message }); }
});

router.post('/web-type', async (req, res) => {
  try {
    const r = await fetch('http://web-automation:3004/type', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await r.json());
  } catch (error) { res.json({ success: false, error: (error as Error).message }); }
});

router.post('/web-login', async (req, res) => {
  try {
    const r = await fetch('http://web-automation:3004/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await r.json());
  } catch (error) { res.json({ success: false, error: (error as Error).message }); }
});

router.post('/web-screenshot', async (req, res) => {
  try {
    const r = await fetch('http://web-automation:3004/screenshot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await r.json());
  } catch (error) { res.json({ success: false, error: (error as Error).message }); }
});

router.post('/web-get-content', async (req, res) => {
  try {
    const r = await fetch('http://web-automation:3004/get-content', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await r.json());
  } catch (error) { res.json({ success: false, error: (error as Error).message }); }
});

router.post('/web-execute-js', async (req, res) => {
  try {
    const r = await fetch('http://web-automation:3004/execute-js', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await r.json());
  } catch (error) { res.json({ success: false, error: (error as Error).message }); }
});

function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>YChatClaw Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0f0f23;color:#e0e0e0;min-height:100vh}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px 30px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 4px 15px rgba(0,0,0,0.3)}
.header h1{font-size:22px;font-weight:700;color:#fff}
.header p{color:rgba(255,255,255,0.8);font-size:13px}
.header-actions{display:flex;gap:10px}
.btn{padding:8px 18px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s}
.btn-primary{background:#667eea;color:#fff}
.btn-primary:hover{background:#5a6fd6}
.btn-success{background:#10b981;color:#fff}
.btn-success:hover{background:#059669}
.btn-danger{background:#ef4444;color:#fff}
.btn-danger:hover{background:#dc2626}
.btn-warning{background:#f59e0b;color:#fff}
.btn-warning:hover{background:#d97706}
.btn-sm{padding:6px 12px;font-size:12px}
.container{max-width:1400px;margin:0 auto;padding:20px}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}
.stat-card{background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.05)}
.stat-card .icon{font-size:28px;margin-bottom:8px}
.stat-card .value{font-size:32px;font-weight:700;color:#fff}
.stat-card .label{font-size:13px;color:#888;margin-top:4px}
.stat-card.green .value{color:#10b981}
.stat-card.blue .value{color:#667eea}
.stat-card.yellow .value{color:#f59e0b}
.stat-card.red .value{color:#ef4444}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px}
.card{background:#1a1a2e;border-radius:12px;border:1px solid rgba(255,255,255,0.05);overflow:hidden}
.card-header{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;align-items:center}
.card-header h3{font-size:15px;font-weight:600;color:#fff}
.card-body{padding:20px}
.service-item{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.03)}
.service-item:last-child{border-bottom:none}
.dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.dot.green{background:#10b981;box-shadow:0 0 8px rgba(16,185,129,0.5)}
.dot.red{background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,0.5)}
.dot.yellow{background:#f59e0b;box-shadow:0 0 8px rgba(245,158,11,0.5)}
.service-name{font-size:14px;color:#ccc}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
.badge-green{background:rgba(16,185,129,0.15);color:#10b981}
.badge-red{background:rgba(239,68,68,0.15);color:#ef4444}
.badge-yellow{background:rgba(245,158,11,0.15);color:#f59e0b}
.badge-blue{background:rgba(102,126,234,0.15);color:#667eea}
.wa-status-box{text-align:center;padding:10px}
.wa-status-box .big-icon{font-size:48px;margin:10px 0}
.wa-status-box .status-text{font-size:16px;font-weight:600;margin-bottom:15px}
.wa-status-box .btn-group{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.ai-model{background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.2);border-radius:8px;padding:12px;margin-bottom:10px}
.ai-model .model-name{font-weight:600;color:#667eea;font-size:14px}
.ai-model .model-info{font-size:12px;color:#888;margin-top:4px}
.chat-box{background:#0f0f23;border-radius:8px;border:1px solid rgba(255,255,255,0.05);height:250px;overflow-y:auto;padding:15px;margin-bottom:12px}
.chat-msg{margin-bottom:12px;display:flex;flex-direction:column}
.chat-msg.user{align-items:flex-end}
.chat-msg.bot{align-items:flex-start}
.chat-bubble{max-width:80%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.5}
.chat-msg.user .chat-bubble{background:#667eea;color:#fff;border-bottom-right-radius:4px}
.chat-msg.bot .chat-bubble{background:#1e293b;color:#e0e0e0;border-bottom-left-radius:4px}
.chat-sender{font-size:11px;color:#666;margin-bottom:3px}
.chat-input-row{display:flex;gap:8px}
.chat-input-row input{flex:1;background:#16213e;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;color:#fff;font-size:13px;outline:none}
.chat-input-row input:focus{border-color:#667eea}
.logs-box{background:#0a0a1a;border-radius:8px;padding:12px;font-family:'Cascadia Code','Fira Code',monospace;font-size:12px;height:200px;overflow-y:auto;line-height:1.8}
.log-line{color:#8892b0}
.log-line .time{color:#555}
.log-line .ok{color:#10b981}
.log-line .warn{color:#f59e0b}
.log-line .err{color:#ef4444}
.wa-msg-list{max-height:300px;overflow-y:auto}
.wa-msg-item{padding:10px;border-bottom:1px solid rgba(255,255,255,0.03);display:flex;gap:10px;align-items:flex-start}
.wa-msg-item:last-child{border-bottom:none}
.wa-msg-avatar{width:36px;height:36px;border-radius:50%;background:#667eea;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.wa-msg-content{flex:1}
.wa-msg-from{font-size:13px;font-weight:600;color:#fff}
.wa-msg-text{font-size:12px;color:#999;margin-top:2px}
.wa-msg-time{font-size:11px;color:#555;white-space:nowrap}
.send-row{display:flex;gap:8px;margin-top:12px}
.send-row input{flex:1;background:#16213e;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#fff;font-size:13px;outline:none}
.qr-modal{display:none;position:fixed;z-index:1000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px)}
.qr-modal-content{background:#1a1a2e;margin:5% auto;padding:30px;border-radius:15px;width:90%;max-width:420px;text-align:center;border:1px solid rgba(255,255,255,0.1);animation:slideIn .3s ease-out}
@keyframes slideIn{from{opacity:0;transform:translateY(-30px)}to{opacity:1;transform:translateY(0)}}
.qr-modal-content h2{color:#fff;margin-bottom:20px;font-size:20px}
.qr-modal-body{background:#fff;border-radius:10px;padding:20px;margin:15px 0}
.qr-instructions{background:rgba(102,126,234,0.1);padding:14px;border-radius:8px;margin:15px 0;text-align:left;border-left:3px solid #667eea}
.qr-instructions h4{color:#667eea;margin-bottom:8px;font-size:14px}
.qr-instructions ol{margin:0;padding-left:20px;color:#999;font-size:13px}
.qr-instructions li{margin:4px 0}
.web-toolbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.web-toolbar input{flex:1;min-width:200px;background:#16213e;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#fff;font-size:13px;outline:none}
.web-toolbar input:focus{border-color:#667eea}
.web-sessions-list{margin-bottom:12px}
.web-session-item{display:flex;align-items:center;gap:10px;padding:8px;background:rgba(102,126,234,0.05);border:1px solid rgba(102,126,234,0.15);border-radius:8px;margin-bottom:6px;font-size:12px}
.web-session-item .sid{color:#667eea;font-weight:600;font-family:monospace}
.web-session-item .surl{color:#999;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.web-screenshot-box{background:#000;border-radius:8px;overflow:hidden;margin:10px 0;text-align:center;min-height:100px;display:flex;align-items:center;justify-content:center}
.web-screenshot-box img{max-width:100%;height:auto;display:block}
.web-screenshot-box .placeholder{color:#444;font-size:13px}
.web-content-box{background:#0a0a1a;border-radius:8px;padding:12px;font-size:12px;max-height:250px;overflow-y:auto;line-height:1.6;color:#999;margin:10px 0}
.web-content-box .wc-section{margin-bottom:10px}
.web-content-box .wc-title{font-weight:600;color:#667eea;margin-bottom:4px}
.web-content-box a{color:#10b981;text-decoration:none}
.web-action-row{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
@media(max-width:900px){.stats-row,.grid-2,.grid-3{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>YChatClaw Dashboard</h1>
    <p>Painel de Controle do Sistema</p>
  </div>
  <div class="header-actions">
    <button class="btn btn-primary" onclick="refreshAll()">Atualizar</button>
  </div>
</div>

<div class="container">
  <!-- Stats Row -->
  <div class="stats-row">
    <div class="stat-card green">
      <div class="icon">&#128241;</div>
      <div class="value" id="stat-devices">0</div>
      <div class="label">Dispositivos Conectados</div>
    </div>
    <div class="stat-card blue">
      <div class="icon">&#128172;</div>
      <div class="value" id="stat-messages">0</div>
      <div class="label">Mensagens Processadas</div>
    </div>
    <div class="stat-card yellow">
      <div class="icon">&#129302;</div>
      <div class="value" id="stat-ai">--</div>
      <div class="label">AI Status (Ollama)</div>
    </div>
    <div class="stat-card red">
      <div class="icon">&#128101;</div>
      <div class="value" id="stat-users">0</div>
      <div class="label">Usuarios Ativos</div>
    </div>
  </div>

  <!-- Row 2: Services + WhatsApp -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>Status dos Servicos</h3><span class="badge badge-green" id="health-badge">Verificando...</span></div>
      <div class="card-body" id="services-list">
        <div class="service-item"><div class="dot yellow"></div><span class="service-name">Carregando...</span></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>WhatsApp Gateway</h3><span class="badge badge-yellow" id="wa-badge">Verificando</span></div>
      <div class="card-body">
        <div id="wa-status-area">
          <div class="wa-status-box">
            <div class="big-icon">&#128241;</div>
            <div class="status-text" id="wa-status-text">Verificando...</div>
            <div class="btn-group">
              <button class="btn btn-success btn-sm" onclick="generateQR()">Gerar QR Code</button>
              <button class="btn btn-primary btn-sm" onclick="checkWaStatus()">Verificar Status</button>
              <button class="btn btn-danger btn-sm" onclick="disconnectWa()">Desconectar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Row 3: AI Agent + Messages -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>AI Agent (Ollama)</h3><span class="badge badge-blue" id="ai-badge">--</span></div>
      <div class="card-body">
        <div id="ai-models-list"></div>
        <div id="ai-config" style="margin-top:12px;font-size:12px;color:#666"></div>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.05);margin:15px 0">
        <h4 style="font-size:14px;margin-bottom:10px;color:#ccc">Testar AI Agent</h4>
        <div class="chat-box" id="ai-chat"></div>
        <div class="chat-input-row">
          <input type="text" id="ai-input" placeholder="Digite uma mensagem para o agente..." onkeypress="if(event.key==='Enter')sendAiMsg()">
          <button class="btn btn-primary btn-sm" onclick="sendAiMsg()">Enviar</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Mensagens WhatsApp</h3><span class="badge badge-green" id="msg-badge">0</span></div>
      <div class="card-body">
        <div class="wa-msg-list" id="wa-messages">
          <div style="text-align:center;color:#555;padding:30px">Nenhuma mensagem ainda</div>
        </div>
        <div class="send-row">
          <input type="text" id="wa-to" placeholder="Numero (5511999...)">
          <input type="text" id="wa-msg" placeholder="Mensagem..." onkeypress="if(event.key==='Enter')sendWaMsg()">
          <button class="btn btn-success btn-sm" onclick="sendWaMsg()">Enviar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Row 4: Device Control -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-header"><h3>&#128241; Controle de Dispositivos</h3><span class="badge badge-blue" id="dev-badge">0 dispositivos</span></div>
    <div class="card-body">
      <div id="device-list" style="margin-bottom:12px">
        <div style="text-align:center;color:#555;padding:20px">Carregando dispositivos...</div>
      </div>
      <div style="background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:8px;padding:14px;margin-top:10px">
        <h4 style="font-size:13px;color:#ccc;margin-bottom:10px">Enviar Comando ao Dispositivo</h4>
        <div class="web-toolbar">
          <select id="dev-target" style="background:#16213e;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#fff;font-size:13px;min-width:200px"><option value="">Selecione um dispositivo...</option></select>
          <select id="dev-cmd" style="background:#16213e;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#fff;font-size:13px;min-width:150px">
            <option value="open_url">Abrir URL</option>
            <option value="open_app">Abrir App</option>
            <option value="open_webview">Abrir WebView</option>
            <option value="get_device_info">Info do Dispositivo</option>
            <option value="web_navigate">Navegar (WebView)</option>
            <option value="web_screenshot">Screenshot (WebView)</option>
          </select>
        </div>
        <div class="web-toolbar">
          <input type="text" id="dev-param" placeholder="URL ou package_name (ex: https://google.com ou com.whatsapp)">
          <button class="btn btn-success btn-sm" onclick="sendDeviceCmd()">Enviar Comando</button>
        </div>
        <div id="dev-result" style="display:none;margin-top:10px;background:#0a0a1a;border-radius:8px;padding:12px;font-size:12px;color:#999;max-height:150px;overflow-y:auto"></div>
      </div>
    </div>
  </div>

  <!-- Row 5: Web Automation -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-header"><h3>&#127760; Web Automation (Controle de Navegador)</h3><span class="badge badge-blue" id="web-badge">0 sessoes</span></div>
    <div class="card-body">
      <div class="web-toolbar">
        <input type="text" id="web-url" placeholder="URL para navegar (ex: https://google.com)" onkeypress="if(event.key==='Enter')webNavigateOrCreate()">
        <button class="btn btn-success btn-sm" onclick="webCreateSession()">Nova Sessao</button>
        <button class="btn btn-primary btn-sm" onclick="webNavigateOrCreate()">Navegar</button>
        <button class="btn btn-warning btn-sm" onclick="webScreenshot()">Screenshot</button>
        <button class="btn btn-primary btn-sm" onclick="webGetContent()">Analisar Pagina</button>
      </div>
      <div class="web-toolbar">
        <input type="text" id="web-selector" placeholder="Seletor CSS (ex: #login-btn, .menu-item, input[name=email])">
        <button class="btn btn-sm btn-primary" onclick="webClick()">Clicar</button>
        <button class="btn btn-sm btn-primary" onclick="webType()">Digitar</button>
        <input type="text" id="web-text" placeholder="Texto para digitar...">
      </div>
      <div class="web-toolbar">
        <input type="text" id="web-user" placeholder="Usuario/Email">
        <input type="password" id="web-pass" placeholder="Senha">
        <button class="btn btn-sm btn-success" onclick="webLogin()">Fazer Login</button>
        <button class="btn btn-sm btn-danger" onclick="webCloseSession()">Fechar Sessao</button>
      </div>
      <div class="web-sessions-list" id="web-sessions"></div>
      <div class="web-screenshot-box" id="web-screenshot"><div class="placeholder">Nenhum screenshot ainda - clique em "Screenshot" para capturar</div></div>
      <div class="web-content-box" id="web-content" style="display:none"></div>
    </div>
  </div>

  <!-- Row 5: Logs -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-header"><h3>Logs do Sistema</h3><button class="btn btn-sm btn-primary" onclick="loadLogs()">Atualizar</button></div>
    <div class="card-body">
      <div class="logs-box" id="system-logs"></div>
    </div>
  </div>
</div>

<!-- QR Code Modal -->
<div id="qrModal" class="qr-modal">
  <div class="qr-modal-content">
    <h2>QR Code WhatsApp</h2>
    <div class="qr-modal-body" id="qr-modal-body">
      <p style="color:#333">Gerando QR Code...</p>
    </div>
    <div class="qr-instructions">
      <h4>Como escanear:</h4>
      <ol>
        <li>Abra o WhatsApp no seu celular</li>
        <li>Va em Configuracoes > Dispositivos conectados</li>
        <li>Toque em Conectar um novo dispositivo</li>
        <li>Aponte a camera para este QR Code</li>
      </ol>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:10px">
      <button class="btn btn-success" onclick="generateQR()">Gerar Novo</button>
      <button class="btn btn-danger" onclick="closeQrModal()">Fechar</button>
    </div>
  </div>
</div>

<script>
const AUTH = 'Basic YWRtaW46eWNoYXRjbGF3MTIz';
const hdrs = {'Authorization': AUTH, 'Content-Type': 'application/json'};
let logLines = [];

// === LOAD ALL DATA ===
async function refreshAll() {
  await Promise.allSettled([loadStats(), loadServices(), checkWaStatus(), loadAiStatus(), loadWaMessages(), loadDevices(), loadWebSessions(), loadLogs()]);
}

// === STATS ===
async function loadStats() {
  try {
    const r = await fetch('/dashboard/stats', {headers: hdrs});
    const d = await r.json();
    const devOnline = (d.devices && d.devices.ONLINE) || 0;
    const waConn = d.whatsapp && d.whatsapp.connectionStatus === 'connected' ? 1 : 0;
    document.getElementById('stat-devices').textContent = devOnline + waConn;
    const totalCmds = d.commands ? Object.values(d.commands).reduce((a,b) => Number(a)+Number(b), 0) : 0;
    document.getElementById('stat-messages').textContent = totalCmds;
    document.getElementById('stat-users').textContent = d.users || 0;
    const aiOk = d.ai && d.ai.status === 'healthy';
    document.getElementById('stat-ai').textContent = aiOk ? 'Online' : 'Offline';
    document.getElementById('stat-ai').style.color = aiOk ? '#10b981' : '#ef4444';
  } catch(e) { console.error('Stats error:', e); }
}

// === SERVICES ===
async function loadServices() {
  try {
    const r = await fetch('/dashboard/services-health', {headers: hdrs});
    const d = await r.json();
    const el = document.getElementById('services-list');
    const allOk = d.services.every(s => s.status === 'online');
    document.getElementById('health-badge').textContent = allOk ? 'Todos Online' : 'Verificar';
    document.getElementById('health-badge').className = 'badge ' + (allOk ? 'badge-green' : 'badge-yellow');
    el.innerHTML = d.services.map(s =>
      '<div class="service-item"><div class="dot ' + (s.status==='online'?'green':'red') + '"></div><span class="service-name">' + s.name + '</span><span class="badge ' + (s.status==='online'?'badge-green':'badge-red') + '">' + s.status + '</span></div>'
    ).join('');
    addLog('Servicos verificados: ' + d.services.filter(s=>s.status==='online').length + '/' + d.services.length + ' online', 'ok');
  } catch(e) {
    document.getElementById('services-list').innerHTML = '<div class="service-item"><div class="dot red"></div><span class="service-name">Erro ao carregar</span></div>';
    addLog('Erro ao verificar servicos: ' + e.message, 'err');
  }
}

// === WHATSAPP STATUS ===
async function checkWaStatus() {
  try {
    const r = await fetch('/dashboard/whatsapp-status', {headers: hdrs});
    const d = await r.json();
    const st = d.connectionStatus;
    const badge = document.getElementById('wa-badge');
    const text = document.getElementById('wa-status-text');
    if (st === 'connected') {
      badge.textContent = 'Conectado'; badge.className = 'badge badge-green';
      text.innerHTML = '<span style="color:#10b981">WhatsApp Conectado</span>';
      addLog('WhatsApp conectado com sucesso', 'ok');
    } else if (st === 'qr_ready') {
      badge.textContent = 'QR Pronto'; badge.className = 'badge badge-yellow';
      text.innerHTML = '<span style="color:#f59e0b">QR Code pronto para escanear</span>';
    } else if (st === 'initializing') {
      badge.textContent = 'Inicializando'; badge.className = 'badge badge-yellow';
      text.innerHTML = '<span style="color:#f59e0b">Inicializando...</span>';
    } else {
      badge.textContent = 'Desconectado'; badge.className = 'badge badge-red';
      text.innerHTML = '<span style="color:#ef4444">WhatsApp Desconectado</span>';
    }
  } catch(e) {
    document.getElementById('wa-badge').textContent = 'Erro'; document.getElementById('wa-badge').className = 'badge badge-red';
    addLog('Erro ao verificar WhatsApp: ' + e.message, 'err');
  }
}

// === GENERATE QR ===
async function generateQR() {
  document.getElementById('qrModal').style.display = 'block';
  document.getElementById('qr-modal-body').innerHTML = '<p style="color:#333">Gerando QR Code... (pode levar 15s)</p>';
  addLog('Solicitando QR Code do WhatsApp...', 'warn');
  try {
    const r = await fetch('/dashboard/whatsapp-generate-qr', {method:'POST', headers: hdrs});
    const d = await r.json();
    if (d.qr) {
      const isImg = d.qr.startsWith('data:image');
      if (isImg) {
        document.getElementById('qr-modal-body').innerHTML = '<img src="' + d.qr + '" style="width:100%;max-width:280px;height:auto;display:block;margin:0 auto;image-rendering:pixelated">';
      } else {
        document.getElementById('qr-modal-body').innerHTML = '<pre style="font-size:4px;line-height:1;font-family:monospace;color:#000;margin:0;white-space:pre">' + d.qr + '</pre>';
      }
      addLog('QR Code gerado com sucesso', 'ok');
      setTimeout(checkWaStatus, 3000);
    } else {
      document.getElementById('qr-modal-body').innerHTML = '<p style="color:#333">' + (d.message || 'Tente novamente em alguns segundos') + '</p>';
      addLog('QR Code: ' + (d.message || 'nao disponivel'), 'warn');
    }
  } catch(e) {
    document.getElementById('qr-modal-body').innerHTML = '<p style="color:red">Erro: ' + e.message + '</p>';
    addLog('Erro ao gerar QR Code: ' + e.message, 'err');
  }
}

function closeQrModal() { document.getElementById('qrModal').style.display = 'none'; }
window.onclick = function(e) { if(e.target.classList.contains('qr-modal')) closeQrModal(); };

async function disconnectWa() {
  try {
    await fetch('/dashboard/whatsapp-disconnect', {method:'POST', headers: hdrs});
    addLog('WhatsApp desconectado', 'warn');
    setTimeout(checkWaStatus, 1000);
  } catch(e) { addLog('Erro ao desconectar: ' + e.message, 'err'); }
}

// === AI STATUS ===
async function loadAiStatus() {
  try {
    const r = await fetch('/dashboard/ai-status', {headers: hdrs});
    const d = await r.json();
    const badge = document.getElementById('ai-badge');
    const isOk = d.service && d.service.status === 'healthy';
    badge.textContent = isOk ? 'Online' : 'Offline';
    badge.className = 'badge ' + (isOk ? 'badge-green' : 'badge-red');

    let modelsHtml = '';
    if (d.models && d.models.length > 0) {
      d.models.forEach(function(m) {
        const sizeGB = (m.size / 1073741824).toFixed(1);
        modelsHtml += '<div class="ai-model"><div class="model-name">' + m.name + '</div><div class="model-info">' + (m.parameterSize||'') + ' | ' + (m.quantization||'') + ' | ' + sizeGB + ' GB | Familia: ' + (m.family||'?') + '</div></div>';
      });
    } else {
      modelsHtml = '<div style="color:#555;font-size:13px">Nenhum modelo encontrado</div>';
    }
    document.getElementById('ai-models-list').innerHTML = modelsHtml;

    if (d.config) {
      document.getElementById('ai-config').innerHTML = 'Modelo padrao: <strong style="color:#667eea">' + (d.config.model||'?') + '</strong> | Vision: <strong style="color:#667eea">' + (d.config.visionModel||'?') + '</strong>';
    }
    addLog('AI Service: ' + (isOk?'online':'offline') + ' | Modelos: ' + (d.models?d.models.length:0), isOk?'ok':'err');
  } catch(e) {
    document.getElementById('ai-badge').textContent = 'Erro'; document.getElementById('ai-badge').className = 'badge badge-red';
    document.getElementById('ai-models-list').innerHTML = '<div style="color:#ef4444;font-size:13px">Erro ao conectar com AI Service</div>';
    addLog('Erro ao verificar AI: ' + e.message, 'err');
  }
}

// === AI CHAT ===
async function sendAiMsg() {
  const input = document.getElementById('ai-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendChat('user', 'Voce', msg);
  appendChat('bot', 'AI', 'Processando...');
  try {
    const r = await fetch('/dashboard/test-ai', {method:'POST', headers: hdrs, body: JSON.stringify({message: msg})});
    const d = await r.json();
    removeLastChat();
    appendChat('bot', 'YChatClaw AI', d.response || d.error || 'Sem resposta');
    addLog('AI respondeu: ' + ((d.response||'').substring(0,50)) + '...', 'ok');
  } catch(e) {
    removeLastChat();
    appendChat('bot', 'Erro', e.message);
    addLog('Erro na AI: ' + e.message, 'err');
  }
}

function appendChat(type, sender, text) {
  const box = document.getElementById('ai-chat');
  box.innerHTML += '<div class="chat-msg ' + type + '"><div class="chat-sender">' + sender + '</div><div class="chat-bubble">' + text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div></div>';
  box.scrollTop = box.scrollHeight;
}

function removeLastChat() {
  const box = document.getElementById('ai-chat');
  const last = box.querySelector('.chat-msg:last-child');
  if (last) last.remove();
}

// === SEND WHATSAPP ===
async function sendWaMsg() {
  const to = document.getElementById('wa-to').value.trim();
  const msg = document.getElementById('wa-msg').value.trim();
  if (!to || !msg) return alert('Preencha numero e mensagem');
  try {
    const r = await fetch('/dashboard/send-whatsapp', {method:'POST', headers: hdrs, body: JSON.stringify({to, message: msg})});
    const d = await r.json();
    document.getElementById('wa-msg').value = '';
    addWaMessage('Voce', to, msg, new Date().toLocaleTimeString());
    addLog('Mensagem enviada para ' + to, d.success ? 'ok' : 'err');
  } catch(e) { addLog('Erro ao enviar: ' + e.message, 'err'); }
}

function addWaMessage(from, to, text, time) {
  const list = document.getElementById('wa-messages');
  if (list.querySelector('div[style]')) list.innerHTML = '';
  list.innerHTML = '<div class="wa-msg-item"><div class="wa-msg-avatar">&#128100;</div><div class="wa-msg-content"><div class="wa-msg-from">' + from + ' &rarr; ' + to + '</div><div class="wa-msg-text">' + text + '</div></div><div class="wa-msg-time">' + time + '</div></div>' + list.innerHTML;
}

// === LOAD WA MESSAGES ===
async function loadWaMessages() {
  try {
    const r = await fetch('/dashboard/whatsapp-messages', {headers: hdrs});
    const d = await r.json();
    document.getElementById('msg-badge').textContent = d.totalCount || 0;
    if (d.messages && d.messages.length > 0) {
      const list = document.getElementById('wa-messages');
      list.innerHTML = d.messages.slice(0, 20).map(function(m) {
        const dir = m.direction === 'outgoing' ? '&#128228;' : '&#128229;';
        const from = m.from === 'me' ? 'Voce' : (m.from || '?').replace('@c.us','');
        const to = m.to ? m.to.replace('@c.us','') : '';
        const label = m.direction === 'outgoing' ? from + ' &rarr; ' + to : from;
        const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '';
        return '<div class="wa-msg-item"><div class="wa-msg-avatar">' + dir + '</div><div class="wa-msg-content"><div class="wa-msg-from">' + label + '</div><div class="wa-msg-text">' + (m.body||'').substring(0,100) + '</div></div><div class="wa-msg-time">' + time + '</div></div>';
      }).join('');
    }
  } catch(e) { console.error('WA messages error:', e); }
}

// === DEVICE CONTROL ===
async function loadDevices() {
  try {
    var r = await fetch('/dashboard/devices', {headers: hdrs});
    var d = await r.json();
    var devices = d.devices || [];
    document.getElementById('dev-badge').textContent = devices.length + ' dispositivos';
    var el = document.getElementById('device-list');
    var sel = document.getElementById('dev-target');
    if (devices.length === 0) {
      el.innerHTML = '<div style="text-align:center;color:#555;padding:20px">Nenhum dispositivo registrado. Instale o APK no celular e conecte.</div>';
      sel.innerHTML = '<option value="">Nenhum dispositivo</option>';
      return;
    }
    el.innerHTML = devices.map(function(dev) {
      var st = dev.wsConnected ? 'green' : (dev.status === 'ONLINE' ? 'yellow' : 'red');
      var stLabel = dev.wsConnected ? 'Conectado' : dev.status;
      var meta = dev.metadata || {};
      var info = [meta.model, meta.manufacturer, meta.android_version ? 'Android ' + meta.android_version : ''].filter(Boolean).join(' | ');
      return '<div class="service-item"><div class="dot ' + st + '"></div><span class="service-name" style="flex:1"><strong>' + (dev.name||dev.uuid.substring(0,8)) + '</strong><br><span style="font-size:11px;color:#666">' + (info || dev.uuid.substring(0,16)) + '</span></span><span class="badge badge-' + st + '">' + stLabel + '</span></div>';
    }).join('');
    sel.innerHTML = '<option value="">Selecione...</option>' + devices.map(function(dev) {
      return '<option value="' + dev.id + '">' + (dev.name||dev.uuid.substring(0,8)) + (dev.wsConnected ? ' (online)' : '') + '</option>';
    }).join('');
    addLog('Dispositivos: ' + devices.length + ' registrados, ' + devices.filter(function(d){return d.wsConnected}).length + ' conectados', 'ok');
  } catch(e) { console.error('Devices error:', e); addLog('Erro ao carregar dispositivos: ' + e.message, 'err'); }
}

async function sendDeviceCmd() {
  var devId = document.getElementById('dev-target').value;
  var cmd = document.getElementById('dev-cmd').value;
  var param = document.getElementById('dev-param').value.trim();
  if (!devId) return addLog('Selecione um dispositivo', 'warn');
  var params = {};
  if (cmd === 'open_url' || cmd === 'open_webview' || cmd === 'web_navigate') params = {url: param || 'https://google.com'};
  else if (cmd === 'open_app') params = {package_name: param || 'com.android.chrome'};
  addLog('Enviando ' + cmd + ' para dispositivo...', 'warn');
  try {
    var r = await fetch('/dashboard/send-device-command', {method:'POST', headers:hdrs, body:JSON.stringify({deviceId:devId, commandName:cmd, params:params})});
    var d = await r.json();
    var resultEl = document.getElementById('dev-result');
    resultEl.style.display = 'block';
    if (d.success) {
      resultEl.innerHTML = '<span style="color:#10b981">Comando enviado com sucesso!</span><br><pre style="color:#888;margin-top:6px">' + JSON.stringify(d, null, 2) + '</pre>';
      addLog('Comando ' + cmd + ' enviado com sucesso', 'ok');
    } else {
      resultEl.innerHTML = '<span style="color:#ef4444">Erro: ' + (d.error||'desconhecido') + '</span>';
      addLog('Erro ao enviar comando: ' + (d.error||''), 'err');
    }
  } catch(e) { addLog('Erro: ' + e.message, 'err'); }
}

// === WEB AUTOMATION ===
let webSessionId = null;

async function webCreateSession() {
  var url = document.getElementById('web-url').value.trim() || undefined;
  addLog('Criando sessao de navegador...', 'warn');
  try {
    var r = await fetch('/dashboard/web-create-session', {method:'POST', headers:hdrs, body:JSON.stringify({url:url})});
    var d = await r.json();
    if (d.success) {
      webSessionId = d.data.sessionId;
      addLog('Sessao criada: ' + d.data.sessionId.substring(0,8) + '... -> ' + (d.data.url||'blank'), 'ok');
      loadWebSessions();
      if (url) webScreenshot();
    } else { addLog('Erro: ' + d.error, 'err'); }
  } catch(e) { addLog('Erro ao criar sessao: ' + e.message, 'err'); }
}

async function webCloseSession() {
  if (!webSessionId) return addLog('Nenhuma sessao ativa', 'warn');
  try {
    await fetch('/dashboard/web-close-session', {method:'POST', headers:hdrs, body:JSON.stringify({sessionId:webSessionId})});
    addLog('Sessao fechada: ' + webSessionId.substring(0,8), 'ok');
    webSessionId = null;
    document.getElementById('web-screenshot').innerHTML = '<div class="placeholder">Sessao fechada</div>';
    document.getElementById('web-content').style.display = 'none';
    loadWebSessions();
  } catch(e) { addLog('Erro ao fechar: ' + e.message, 'err'); }
}

async function webNavigateOrCreate() {
  var url = document.getElementById('web-url').value.trim();
  if (!url) return addLog('Digite uma URL', 'warn');
  if (!webSessionId) return webCreateSession();
  addLog('Navegando para: ' + url, 'warn');
  try {
    var r = await fetch('/dashboard/web-navigate', {method:'POST', headers:hdrs, body:JSON.stringify({sessionId:webSessionId, url:url})});
    var d = await r.json();
    if (d.success) {
      addLog('Navegou para: ' + d.data.title + ' (' + d.data.url + ')', 'ok');
      webScreenshot();
    } else { addLog('Erro: ' + d.error, 'err'); }
  } catch(e) { addLog('Erro ao navegar: ' + e.message, 'err'); }
}

async function webClick() {
  if (!webSessionId) return addLog('Crie uma sessao primeiro', 'warn');
  var sel = document.getElementById('web-selector').value.trim();
  if (!sel) return addLog('Digite um seletor CSS', 'warn');
  addLog('Clicando em: ' + sel, 'warn');
  try {
    var r = await fetch('/dashboard/web-click', {method:'POST', headers:hdrs, body:JSON.stringify({sessionId:webSessionId, selector:sel})});
    var d = await r.json();
    if (d.success) { addLog('Clique OK em: ' + sel, 'ok'); webScreenshot(); }
    else { addLog('Erro ao clicar: ' + d.error, 'err'); }
  } catch(e) { addLog('Erro: ' + e.message, 'err'); }
}

async function webType() {
  if (!webSessionId) return addLog('Crie uma sessao primeiro', 'warn');
  var sel = document.getElementById('web-selector').value.trim();
  var txt = document.getElementById('web-text').value;
  if (!sel || !txt) return addLog('Preencha seletor e texto', 'warn');
  addLog('Digitando em: ' + sel, 'warn');
  try {
    var r = await fetch('/dashboard/web-type', {method:'POST', headers:hdrs, body:JSON.stringify({sessionId:webSessionId, selector:sel, text:txt, clear:true})});
    var d = await r.json();
    if (d.success) { addLog('Texto digitado em: ' + sel, 'ok'); document.getElementById('web-text').value = ''; }
    else { addLog('Erro: ' + d.error, 'err'); }
  } catch(e) { addLog('Erro: ' + e.message, 'err'); }
}

async function webLogin() {
  if (!webSessionId) return addLog('Crie uma sessao primeiro', 'warn');
  var url = document.getElementById('web-url').value.trim();
  var user = document.getElementById('web-user').value.trim();
  var pass = document.getElementById('web-pass').value;
  if (!url || !user || !pass) return addLog('Preencha URL, usuario e senha', 'warn');
  addLog('Fazendo login em: ' + url, 'warn');
  try {
    var r = await fetch('/dashboard/web-login', {method:'POST', headers:hdrs, body:JSON.stringify({sessionId:webSessionId, url:url, username:user, password:pass})});
    var d = await r.json();
    if (d.success) {
      addLog('Login realizado! Pagina: ' + d.data.title, 'ok');
      if (d.screenshot) { document.getElementById('web-screenshot').innerHTML = '<img src="' + d.screenshot + '">'; }
      else { webScreenshot(); }
    } else { addLog('Erro no login: ' + d.error, 'err'); }
  } catch(e) { addLog('Erro: ' + e.message, 'err'); }
}

async function webScreenshot() {
  if (!webSessionId) return addLog('Crie uma sessao primeiro', 'warn');
  try {
    var r = await fetch('/dashboard/web-screenshot', {method:'POST', headers:hdrs, body:JSON.stringify({sessionId:webSessionId})});
    var d = await r.json();
    if (d.success && d.data && d.data.screenshot) {
      document.getElementById('web-screenshot').innerHTML = '<img src="' + d.data.screenshot + '">';
    } else { addLog('Erro no screenshot: ' + (d.error||'sem dados'), 'err'); }
  } catch(e) { addLog('Erro: ' + e.message, 'err'); }
}

async function webGetContent() {
  if (!webSessionId) return addLog('Crie uma sessao primeiro', 'warn');
  addLog('Analisando pagina...', 'warn');
  try {
    var r = await fetch('/dashboard/web-get-content', {method:'POST', headers:hdrs, body:JSON.stringify({sessionId:webSessionId})});
    var d = await r.json();
    if (d.success && d.data) {
      var c = d.data;
      var html = '<div class="wc-section"><div class="wc-title">Pagina: ' + (c.title||'?') + '</div><div>' + (c.url||'') + '</div></div>';
      if (c.inputs && c.inputs.length) {
        html += '<div class="wc-section"><div class="wc-title">Campos (' + c.inputs.length + ')</div>';
        c.inputs.forEach(function(i) { html += '<div>&#9679; [' + (i.type||'text') + '] name="' + (i.name||'') + '" id="' + (i.id||'') + '" placeholder="' + (i.placeholder||'') + '"</div>'; });
        html += '</div>';
      }
      if (c.buttons && c.buttons.length) {
        html += '<div class="wc-section"><div class="wc-title">Botoes (' + c.buttons.length + ')</div>';
        c.buttons.forEach(function(b) { html += '<div>&#9679; "' + (b.text||'?') + '" id="' + (b.id||'') + '" class="' + (b.class||'').substring(0,40) + '"</div>'; });
        html += '</div>';
      }
      if (c.links && c.links.length) {
        html += '<div class="wc-section"><div class="wc-title">Links (' + c.links.length + ')</div>';
        c.links.forEach(function(l) { html += '<div>&#9679; <a href="#">' + (l.text||l.href||'?').substring(0,60) + '</a></div>'; });
        html += '</div>';
      }
      if (c.checkboxes && c.checkboxes.length) {
        html += '<div class="wc-section"><div class="wc-title">Checkboxes (' + c.checkboxes.length + ')</div>';
        c.checkboxes.forEach(function(cb) { html += '<div>&#9679; [' + (cb.checked?'X':' ') + '] "' + (cb.label||cb.name||cb.id||'?') + '"</div>'; });
        html += '</div>';
      }
      if (c.textPreview) {
        html += '<div class="wc-section"><div class="wc-title">Texto visivel</div><div>' + c.textPreview.substring(0,500).replace(/</g,'&lt;') + '...</div></div>';
      }
      document.getElementById('web-content').innerHTML = html;
      document.getElementById('web-content').style.display = 'block';
      addLog('Pagina analisada: ' + c.inputs.length + ' campos, ' + c.buttons.length + ' botoes, ' + c.links.length + ' links', 'ok');
    } else { addLog('Erro: ' + (d.error||'sem dados'), 'err'); }
  } catch(e) { addLog('Erro: ' + e.message, 'err'); }
}

async function loadWebSessions() {
  try {
    var r = await fetch('/dashboard/web-sessions', {headers:hdrs});
    var d = await r.json();
    var el = document.getElementById('web-sessions');
    var sessions = (d.data && d.data.sessions) || [];
    document.getElementById('web-badge').textContent = sessions.length + ' sessoes';
    if (sessions.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = sessions.map(function(s) {
      var active = s.id === webSessionId ? ' style="border-color:#10b981"' : '';
      return '<div class="web-session-item"' + active + '><span class="sid">' + s.id.substring(0,8) + '...</span><span class="surl">' + (s.url||'blank') + '</span><span class="badge badge-blue">' + (s.title||'').substring(0,30) + '</span><button class="btn btn-sm btn-primary" onclick="webSessionId=\\'' + s.id + '\\';addLog(\\'Sessao selecionada: ' + s.id.substring(0,8) + '\\',\\'ok\\');loadWebSessions()">Selecionar</button></div>';
    }).join('');
  } catch(e) { console.error('Web sessions error:', e); }
}

// === LOGS ===
function addLog(msg, type) {
  const now = new Date().toLocaleTimeString();
  logLines.unshift({time: now, msg: msg, type: type || 'ok'});
  if (logLines.length > 50) logLines.pop();
  renderLogs();
}

function renderLogs() {
  const el = document.getElementById('system-logs');
  el.innerHTML = logLines.map(function(l) {
    return '<div class="log-line"><span class="time">[' + l.time + ']</span> <span class="' + l.type + '">' + l.msg + '</span></div>';
  }).join('');
}

function loadLogs() {
  addLog('Dashboard atualizado', 'ok');
}

// === INIT ===
addLog('Dashboard carregado', 'ok');
addLog('Verificando servicos...', 'warn');
refreshAll();
setInterval(function(){ loadStats(); checkWaStatus(); loadWaMessages(); }, 15000);
setInterval(loadServices, 60000);
</script>
</body>
</html>`;
}

export { router as dashboardRoutes };
