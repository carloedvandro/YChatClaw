const https = require('https');
const net = require('net');
const crypto = require('crypto');
const tls = require('tls');

// Generate self-signed certificate
function generateCert() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  
  // Use Node.js built-in to create a self-signed cert
  const forge = null; // Not available, use openssl approach
  return null;
}

// Simple TCP TLS proxy
const options = {
  key: null,
  cert: null,
};

// Since we can't easily generate certs in pure Node.js without openssl,
// we'll generate them via child_process
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certDir = '/tmp/openclaw-certs';
if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

const keyFile = path.join(certDir, 'key.pem');
const certFile = path.join(certDir, 'cert.pem');

if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
  console.log('Generating self-signed certificate...');
  execSync(
    'openssl req -x509 -newkey rsa:2048 -keyout ' + keyFile + ' -out ' + certFile + 
    ' -days 365 -nodes -subj "/CN=openclaw-proxy" 2>/dev/null'
  );
  console.log('Certificate generated');
}

const server = https.createServer({
  key: fs.readFileSync(keyFile),
  cert: fs.readFileSync(certFile),
}, function(req, res) {
  var options = {
    hostname: '127.0.0.1',
    port: 18789,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };
  // Remove host header to avoid conflicts
  delete options.headers['host'];
  options.headers['host'] = '127.0.0.1:18789';
  
  var proxyReq = require('http').request(options, function(proxyRes) {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', function(e) {
    res.writeHead(502);
    res.end('Bad Gateway: ' + e.message);
  });
  req.pipe(proxyReq);
});

// Handle WebSocket upgrade
server.on('upgrade', function(req, socket, head) {
  var target = net.connect(18789, '127.0.0.1', function() {
    var reqLine = req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + '\r\n';
    var headers = '';
    for (var i = 0; i < req.rawHeaders.length; i += 2) {
      if (req.rawHeaders[i].toLowerCase() === 'host') {
        headers += req.rawHeaders[i] + ': 127.0.0.1:18789\r\n';
      } else {
        headers += req.rawHeaders[i] + ': ' + req.rawHeaders[i + 1] + '\r\n';
      }
    }
    target.write(reqLine + headers + '\r\n');
    if (head && head.length) target.write(head);
    socket.pipe(target);
    target.pipe(socket);
  });
  target.on('error', function() { socket.destroy(); });
  socket.on('error', function() { target.destroy(); });
});

server.listen(3101, '0.0.0.0', function() {
  console.log('HTTPS proxy listening on 0.0.0.0:3101 -> 127.0.0.1:18789');
});
