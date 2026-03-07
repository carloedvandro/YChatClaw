const net = require('net');
const server = net.createServer(function(client) {
  const target = net.connect(18789, '127.0.0.1');
  client.pipe(target);
  target.pipe(client);
  target.on('error', function() { client.destroy(); });
  client.on('error', function() { target.destroy(); });
});
server.listen(3100, '0.0.0.0', function() {
  console.log('Proxy 0.0.0.0:3100 -> 127.0.0.1:18789 ready');
});
