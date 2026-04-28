const { Aedes } = require('aedes');
const server = require('net').createServer((socket) => {
  if (global.aedesInstance) {
    global.aedesInstance.handle(socket);
  } else {
    socket.destroy();
  }
});
const PORT = 1883;

async function startBroker() {
  const aedes = await Aedes.createBroker();
  global.aedesInstance = aedes;
  
  server.listen(PORT, function () {
    console.log(`Local MQTT test broker started and listening on port ${PORT}`);
  });

  aedes.on('client', function (client) {
    console.log(`[Broker] Client Connected: ${client ? client.id : client}`);
  });

  aedes.on('clientDisconnect', function (client) {
    console.log(`[Broker] Client Disconnected: ${client ? client.id : client}`);
  });

  aedes.on('publish', function (packet, client) {
    if (client) {
      console.log(`[Broker] Message from ${client.id} to topic ${packet.topic}`);
    }
  });
}

startBroker().catch(err => {
  console.error(err);
  process.exit(1);
});
