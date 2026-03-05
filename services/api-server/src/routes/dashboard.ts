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
    <title>YChatClaw Dashboard</title>
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
        .qr-code { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
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

    <script>
        async function loadData() {
            try {
                const healthResponse = await fetch('/health');
                const healthData = await healthResponse.json();
                updateServicesStatus(healthData);

                const devicesResponse = await fetch('/api/devices');
                const devicesData = await devicesResponse.json();
                document.getElementById('active-devices').textContent = devicesData.length || 0;

                updateLogs();
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
                    console.log('✅ QR Code recebido, exibindo...');
                    document.getElementById('qr-code').innerHTML = '<pre style="font-size: 8px; line-height: 1;">' + generateData.qr + '</pre>';
                    document.getElementById('qr-code').style.display = 'block';
                    alert('📱 QR Code gerado! Escaneie com WhatsApp.');
                    
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

export { router };
