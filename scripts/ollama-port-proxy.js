// Proxy: 0.0.0.0:11434 -> 127.0.0.1:11435
// Makes Ollama available on the default port 11434 for tools like OpenClaw
const net = require('net');
const server = net.createServer(function(client) {
  const target = net.connect(11435, '127.0.0.1');
  client.pipe(target);
  target.pipe(client);
  target.on('error', function() { client.destroy(); });
  client.on('error', function() { target.destroy(); });
});
server.listen(11434, '127.0.0.1', function() {
  console.log('Ollama proxy: 127.0.0.1:11434 -> 127.0.0.1:11435');
});
