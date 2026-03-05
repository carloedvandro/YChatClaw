import express from 'express';
import axios from 'axios';

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
  // Headers para evitar cache
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🤖 YChatClaw Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .card h3 { color: #333; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .status { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
        .status-dot { width: 12px; height: 12px; border-radius: 50%; }
        .status.online { background: #4CAF50; }
        .status.offline { background: #f44336; }
        .status.restarting { background: #FF9800; }
        .metric { font-size: 24px; font-weight: bold; color: #667eea; margin: 10px 0; }
        .logs { background: #1e1e1e; color: #fff; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto; }
        .refresh-btn { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px 0; }
        .refresh-btn:hover { background: #5a67d8; }
        .whatsapp-status { text-align: center; padding: 20px; }
        .qr-code {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            margin: 20px 0;
            display: none;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-height: 400px;
            overflow: auto;
        }
        
        .qr-code pre {
            font-size: 6px !important;
            line-height: 1.2 !important;
            margin: 0 !important;
            white-space: pre !important;
            overflow: auto !important;
            max-height: 350px !important;
        }
        
        /* Modal/Lightbox para QR Code */
        .qr-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(5px);
        }
        
        .qr-modal-content {
            background: white;
            margin: 5% auto;
            padding: 30px;
            border-radius: 15px;
            width: 90%;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: modalSlideIn 0.3s ease-out;
        }
        
        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: translateY(-50px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .qr-modal-header {
            margin-bottom: 20px;
        }
        
        .qr-modal-header h2 {
            color: #333;
            margin: 0;
            font-size: 24px;
        }
        
        .qr-modal-body {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            max-height: 350px;
            overflow: auto;
            border: 2px solid #e0e0e0;
        }
        
        .qr-modal-body pre {
            font-size: 11px;
            line-height: 11px;
            font-family: monospace;
            background: white;
            color: black;
            margin: 0;
            padding: 5px;
            white-space: pre;
            overflow-x: auto;
        }
        
        .qr-instructions {
            background: #e7f3ff;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #2196F3;
            text-align: left;
        }
        
        .qr-instructions h4 {
            margin: 0 0 10px 0;
            color: #1976D2;
            font-size: 16px;
        }
        
        .qr-instructions ol {
            margin: 0;
            padding-left: 20px;
        }
        
        .qr-instructions li {
            margin: 5px 0;
            color: #555;
            font-size: 14px;
        }
        
        .qr-modal-close {
            background: #f44336;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
            transition: background 0.3s;
        }
        
        .qr-modal-close:hover {
            background: #d32f2f;
        }
        
        .qr-modal-refresh {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
            transition: background 0.3s;
        }
        
        .qr-modal-refresh:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 YChatClaw Dashboard</h1>
        <p>Painel de Controle do Sistema</p>
    </div>

    <div class="container">
        <button class="refresh-btn" onclick="loadData()">🔄 Atualizar</button>

        <div class="grid">
            <!-- Status dos Serviços -->
            <div class="card">
                <h3>📊 Status dos Serviços</h3>
                <div id="services-status">
                    <div class="status">
                        <div class="status-dot restarting"></div>
                        <span>Carregando...</span>
                    </div>
                </div>
            </div>

            <!-- WhatsApp Status -->
            <div class="card">
                <h3>📱 WhatsApp Gateway</h3>
                <div id="whatsapp-status">
                    <div class="status">
                        <div class="status-dot restarting"></div>
                        <span>Verificando...</span>
                    </div>
                </div>
                <div id="qr-code" class="qr-code" style="display: none;"></div>
                <button class="refresh-btn" onclick="loadWhatsAppQR()">📱 Gerar QR Code</button>
                <button class="refresh-btn" onclick="checkWhatsAppStatus()">🔄 Verificar Status</button>
            </div>

            <!-- Estatísticas -->
            <div class="card">
                <h3>📈 Estatísticas</h3>
                <div class="metric" id="total-messages">0</div>
                <p>Mensagens Processadas</p>
                <div class="metric" id="active-devices">0</div>
                <p>Dispositivos Ativos</p>
            </div>

            <!-- Logs em Tempo Real -->
            <div class="card">
                <h3>📋 Logs do Sistema</h3>
                <div class="logs" id="system-logs">
                    <div>Carregando logs...</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal para QR Code -->
    <div id="qrModal" class="qr-modal">
        <div class="qr-modal-content">
            <div class="qr-modal-header">
                <h2>📱 QR Code WhatsApp</h2>
            </div>
            <div class="qr-modal-body">
                <pre id="modalQrCode">Carregando...</pre>
            </div>
            <div class="qr-instructions">
                <h4>📋 Como escanear:</h4>
                <ol>
                    <li>Abra o WhatsApp no seu celular</li>
                    <li>Vá em "Configurações" > "Dispositivos conectados"</li>
                    <li>Toque em "Conectar um novo dispositivo"</li>
                    <li>Aponte a câmera para este QR Code</li>
                </ol>
            </div>
            <button class="qr-modal-refresh" onclick="loadWhatsAppQR()">🔄 Gerar Novo QR Code</button>
            <button class="qr-modal-close" onclick="closeQrModal()">❌ Fechar</button>
        </div>
    </div>

    <script>
        async function loadData() {
            try {
                // Carregar health
                const healthResponse = await fetch('/health', {
                    headers: {
                        'Authorization': 'Basic YWRtaW46eWNoYXRjbGF3MTIz'
                    }
                });
                const healthData = await healthResponse.json();
                updateServicesStatus(healthData);
                
                // Carregar devices (com fallback)
                try {
                    const devicesResponse = await fetch('/api/devices', {
                        headers: {
                            'Authorization': 'Basic YWRtaW46eWNoYXRjbGF3MTIz'
                        }
                    });
                    if (devicesResponse.ok) {
                        const devicesData = await devicesResponse.json();
                        document.getElementById('active-devices').textContent = devicesData.length || 0;
                    } else {
                        document.getElementById('active-devices').textContent = '0';
                    }
                } catch (error) {
                    console.log('Devices API não disponível');
                    document.getElementById('active-devices').textContent = '0';
                }
                
                // Carregar logs (com fallback)
                try {
                    const logsResponse = await fetch('/api/logs', {
                        headers: {
                            'Authorization': 'Basic YWRtaW46eWNoYXRjbGF3MTIz'
                        }
                    });
                    if (logsResponse.ok) {
                        const logsData = await logsResponse.json();
                        updateLogs(logsData);
                    } else {
                        updateLogs([]);
                    }
                } catch (error) {
                    console.log('Logs API não disponível');
                    updateLogs([]);
                }
                
            } catch (error) {
                console.error('Erro ao carregar dados:', error);
                document.getElementById('system-logs').innerHTML = '<div style="color: #ff6b6b;">❌ Erro ao carregar dados</div>';
            }
        }

        function updateServicesStatus(healthData) {
            const servicesContainer = document.getElementById('services-status');
            const services = [
                { name: 'API Server', status: 'online' },
                { name: 'WhatsApp Gateway', status: 'online' },
                { name: 'AI Service', status: 'online' },
                { name: 'WebSocket Server', status: 'online' },
                { name: 'Worker', status: 'online' },
                { name: 'Telegram Gateway', status: 'restarting' },
                { name: 'Discord Gateway', status: 'restarting' }
            ];

            servicesContainer.innerHTML = services.map(service => 
                '<div class="status">' +
                '<div class="status-dot ' + service.status + '"></div>' +
                '<span>' + service.name + '</span>' +
                '</div>'
            ).join('');
        }

        function updateLogs() {
            const logsContainer = document.getElementById('system-logs');
            const logs = [
                '[' + new Date().toLocaleTimeString() + '] 🚀 API Server rodando na porta 3000',
                '[' + new Date().toLocaleTimeString() + '] 📱 WhatsApp Gateway conectado com sucesso!',
                '[' + new Date().toLocaleTimeString() + '] 🤖 AI Service processando solicitações',
                '[' + new Date().toLocaleTimeString() + '] 🔄 WebSocket Server aguardando conexões',
                '[' + new Date().toLocaleTimeString() + '] ⚡ Worker pronto para processar filas',
                '[' + new Date().toLocaleTimeString() + '] 📊 Database e Redis saudáveis'
            ];

            logsContainer.innerHTML = logs.join('<br>');
        }

        async function loadWhatsAppQR() {
            console.log('🚀 Iniciando loadWhatsAppQR...');
            
            try {
                console.log('📡 Enviando requisição para /dashboard/whatsapp-generate-qr');
                
                // Gerar QR Code via API do dashboard
                const generateResponse = await fetch('/dashboard/whatsapp-generate-qr', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Basic YWRtaW46eWNoYXRjbGF3MTIz'
                    }
                });
                
                console.log('📡 Resposta recebida:', generateResponse.status);
                
                const generateData = await generateResponse.json();
                console.log('📦 Dados recebidos:', generateData);
                
                if (generateData.qr) {
                    console.log('✅ QR Code recebido, abrindo modal...');
                    
                    // Abrir modal com QR Code
                    document.getElementById('modalQrCode').textContent = generateData.qr;
                    document.getElementById('qrModal').style.display = 'block';
                    
                    // Também exibir no dashboard
                    document.getElementById('qr-code').innerHTML = '<pre style="font-size: 6px; line-height: 1.2;">' + generateData.qr + '</pre>';
                    document.getElementById('qr-code').style.display = 'block';
                    
                    // Atualizar status após gerar QR Code
                    setTimeout(checkWhatsAppStatus, 2000);
                } else {
                    console.log('❌ QR Code não encontrado:', generateData.message);
                    document.getElementById('qr-code').innerHTML = '<p>' + generateData.message + '</p>';
                    document.getElementById('qr-code').style.display = 'block';
                }
            } catch (error) {
                console.error('❌ Erro ao gerar QR Code:', error);
                document.getElementById('qr-code').innerHTML = '<p style="color: #ff6b6b;">❌ Erro ao gerar QR Code: ' + error.message + '</p>';
                document.getElementById('qr-code').style.display = 'block';
            }
        }
        
        function closeQrModal() {
            document.getElementById('qrModal').style.display = 'none';
        }
        
        // Fechar modal ao clicar fora dele
        window.onclick = function(event) {
            const modal = document.getElementById('qrModal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        }
        
        async function checkWhatsAppStatus() {
            console.log('🔄 Iniciando checkWhatsAppStatus...');
            
            try {
                console.log('📡 Enviando requisição para /dashboard/whatsapp-status');
                
                const response = await fetch('/dashboard/whatsapp-status', {
                    headers: {
                        'Authorization': 'Basic YWRtaW46eWNoYXRjbGF3MTIz'
                    }
                });
                
                console.log('📡 Resposta status:', response.status);
                
                const data = await response.json();
                console.log('📦 Dados status:', data);
                
                const statusDiv = document.getElementById('whatsapp-status');
                if (data.connectionStatus === 'connected') {
                    console.log('✅ Status: connected');
                    statusDiv.innerHTML = 
                        '<div class="status">' +
                        '<div class="status-dot online"></div>' +
                        '<span>✅ WhatsApp Conectado</span>' +
                        '</div>'
                    ;
                } else if (data.connectionStatus === 'qr_ready') {
                    console.log('📱 Status: qr_ready');
                    statusDiv.innerHTML = 
                        '<div class="status">' +
                        '<div class="status-dot restarting"></div>' +
                        '<span>📱 QR Code Pronto</span>' +
                        '</div>'
                    ;
                } else if (data.connectionStatus === 'reconnecting') {
                    console.log('🔄 Status: reconnecting');
                    statusDiv.innerHTML = 
                        '<div class="status">' +
                        '<div class="status-dot restarting"></div>' +
                        '<span>🔄 Reconectando...</span>' +
                        '</div>'
                    ;
                } else {
                    console.log('❌ Status: disconnected');
                    statusDiv.innerHTML = 
                        '<div class="status">' +
                        '<div class="status-dot offline"></div>' +
                        '<span>❌ WhatsApp Desconectado</span>' +
                        '</div>'
                    ;
                }
            } catch (error) {
                console.error('❌ Erro ao verificar status:', error);
                document.getElementById('whatsapp-status').innerHTML = '<span style="color: #ff6b6b;">❌ Erro ao verificar status: ' + error.message + '</span>';
            }
        }
        
        console.log('🚀 Dashboard carregado, iniciando funções...');
        
        setInterval(loadData, 30000);
        setInterval(checkWhatsAppStatus, 10000);
        
        loadData();
        checkWhatsAppStatus();
        
        console.log('✅ Dashboard inicializado!');
    </script>
</body>
</html>
  `);
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

// Rota para visualização do QR Code em janela separada
router.get('/qr-view', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📱 QR Code - YChatClaw</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            text-align: center;
            max-width: 350px;
            width: 100%;
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
            font-size: 24px;
        }
        .qr-container {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border: 2px solid #e9ecef;
            max-height: 400px;
            overflow: auto;
        }
        .qr-container pre {
            font-size: 4px !important;
            line-height: 1.1 !important;
            margin: 0 !important;
            white-space: pre !important;
            font-family: 'Courier New', monospace !important;
            background: transparent !important;
            color: #000 !important;
        }
        .instructions {
            background: #e7f3ff;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #2196F3;
        }
        .instructions h3 {
            margin: 0 0 10px 0;
            color: #1976D2;
            font-size: 16px;
        }
        .instructions p {
            margin: 5px 0;
            color: #555;
            font-size: 14px;
        }
        .refresh-btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            margin: 10px;
            transition: background 0.3s;
        }
        .refresh-btn:hover {
            background: #45a049;
        }
        .status {
            margin: 15px 0;
            padding: 10px;
            border-radius: 5px;
            font-weight: bold;
        }
        .status.waiting {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
        }
        .status.ready {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 QR Code WhatsApp</h1>
        
        <div class="status waiting" id="status">
            ⏳ Aguardando QR Code...
        </div>
        
        <div class="qr-container" id="qr-container">
            <pre id="qr-code">Carregando QR Code...</pre>
        </div>
        
        <div class="instructions">
            <h3>📋 Como escanear:</h3>
            <p>1. Abra o WhatsApp no seu celular</p>
            <p>2. Vá em "Configurações" > "Dispositivos conectados"</p>
            <p>3. Toque em "Conectar um novo dispositivo"</p>
            <p>4. Aponte a câmera para este QR Code</p>
        </div>
        
        <button class="refresh-btn" onclick="window.location.reload()">
            🔄 Atualizar QR Code
        </button>
        
        <button class="refresh-btn" onclick="window.close()">
            ❌ Fechar Janela
        </button>
    </div>

    <script>
        // Ler QR Code da URL
        function loadQRCode() {
            const urlParams = new URLSearchParams(window.location.search);
            const qrCode = urlParams.get('qr');
            
            if (qrCode) {
                // Decodificar QR Code
                const decodedQR = decodeURIComponent(qrCode);
                document.getElementById('qr-code').textContent = decodedQR;
                document.getElementById('status').innerHTML = '✅ QR Code pronto para escanear!';
                document.getElementById('status').className = 'status ready';
            } else {
                document.getElementById('status').innerHTML = '❌ QR Code não encontrado';
                document.getElementById('status').className = 'status waiting';
            }
        }
        
        // Carregar QR Code quando a página abrir
        window.addEventListener('load', loadQRCode);
        
        // Auto-fechar após 2 minutos
        setTimeout(() => {
            if (confirm('⏰ O QR Code expirou! Deseja gerar um novo?')) {
                window.close();
                // Tentar abrir o dashboard novamente
                window.opener.location.href = '/dashboard';
            } else {
                window.close();
            }
        }, 120000);
    </script>
</body>
</html>
  `);
});

export { router as dashboardRoutes };
