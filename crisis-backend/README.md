# Hotel Crisis Management Backend

This project implements a Node.js and Express backend that integrates with a SQLite database for logging incidents and an MQTT broker for real-time notifications.

## Tech Stack
- **Node.js + Express**: REST API
- **MQTT**: Real-time communication (using standard `mqtt` client, interacts with Mosquitto or any MQTT broker)
- **SQLite**: Logging and persistence
- **Aedes (Development only)**: Lightweight Node.js MQTT broker to make local end-to-end testing seamless.

## Project Structure
- `server.js`: The Express REST API Server and routes.
- `mqttClient.js`: Connection logic and helper functions for MQTT.
- `database.js`: SQLite initialization and setup.
- `test-broker.js`: A simple MQTT broker for local testing.
- `incidents.db`: SQLite database file (auto-generated).

## Endpoints
- `POST /alert`: Receives `{ room_number, alert_type }`, triggers logic, saves to DB, publishes to MQTT.
- `GET /incidents`: Returns all logged incidents with timestamps.
- `GET /incidents/latest`: Returns the 5 most recent incidents ordered by timestamp descending.
- `PATCH /incidents/:id`: Update status. Send JSON body `{ "status": "responding" }` or `"resolved"`.
- `GET /simulate/panic`: Simulate a panic alert for demo purposes (e.g. `?room=302`).

## Setup Instructions

1. Ensure you have Node.js installed (v16+ recommended).
2. Navigate to the project directory:
   ```bash
   cd crisis-backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the components:
   - **Terminal 1** (Start the local MQTT test broker):
     ```bash
     node test-broker.js
     ```
   - **Terminal 2** (Start the backend API):
     ```bash
     node server.js
     ```

## Verification
You can test the system end to end by opening your browser and visiting:
http://localhost:3000/simulate/panic?room=302

Check your terminal running the `server.js` and `test-broker.js` files to see real-time MQTT message logs, routing, and SQLite insertions.
