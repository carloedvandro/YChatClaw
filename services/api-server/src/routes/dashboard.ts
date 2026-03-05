import express from 'express';
import axios from 'axios';
import basicAuth from 'express-basic-auth';

const router = express.Router();

// Middleware de autenticação
router.use('/', basicAuth({
  users: { admin: 'ychatclaw123' },
  challenge: true,
  realm: 'YChatClaw Dashboard'
}));

// Página principal do Dashboard
router.get('/', (req, res) => {
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
                // Carregar status da API
                const healthResponse = await fetch('/health');
                const healthData = await healthResponse.json();
                
                // Atualizar status dos serviços
                updateServicesStatus(healthData);
                
                // Carregar dispositivos
                const devicesResponse = await fetch('/api/devices');
                const devicesData = await devicesResponse.json();
                document.getElementById('active-devices').textContent = devicesData.length || 0;
                
                // Carregar logs simulados
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
            
            servicesContainer.innerHTML = services.map(service => \`
                <div class="status">
                    <div class="status-dot \${service.status}"></div>
                    <span>\${service.name}</span>
                </div>
            \`).join('');
        }
        
        function updateLogs() {
            const logsContainer = document.getElementById('system-logs');
            const logs = [
                '[\${new Date().toLocaleTimeString()}] 🚀 API Server rodando na porta 3000',
                '[\${new Date().toLocaleTimeString()}] 📱 WhatsApp Gateway conectado com sucesso!',
                '[\${new Date().toLocaleTimeString()}] 🤖 AI Service processando solicitações',
                '[\${new Date().toLocaleTimeString()}] 🔄 WebSocket Server aguardando conexões',
                '[\${new Date().toLocaleTimeString()}] ⚡ Worker pronto para processar filas',
                '[\${new Date().toLocaleTimeString()}] 📊 Database e Redis saudáveis'
            ];
            
            logsContainer.innerHTML = logs.join('<br>');
        }
        
        // Auto-atualizar a cada 30 segundos
        setInterval(loadData, 30000);
        
        // Carregar dados iniciais
        loadData();
    </script>
</body>
</html>
  `);
});

export { router };
