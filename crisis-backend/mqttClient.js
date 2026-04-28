const mqtt = require('mqtt');

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log(`Connected to MQTT broker at ${brokerUrl}`);
});

client.on('error', (err) => {
  console.error('MQTT connection error:', err);
});

function publishAlert(roomNumber, payload) {
  const topic = `hotel/alerts/${roomNumber}`;
  client.publish(topic, JSON.stringify(payload));
  console.log(`[MQTT] Published to ${topic}:`, payload);
}

function publishStaffNotification(role, payload) {
  const topic = `hotel/staff/${role}`;
  client.publish(topic, JSON.stringify(payload));
  console.log(`[MQTT] Published to ${topic}:`, payload);
}

module.exports = {
  publishAlert,
  publishStaffNotification,
  client
};
