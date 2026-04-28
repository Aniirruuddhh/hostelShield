const ffmpeg = require('fluent-ffmpeg')
const ffmpegStatic = require('ffmpeg-static')
const fs = require('fs')
const path = require('path')
const os = require('os')

ffmpeg.setFfmpegPath(ffmpegStatic)

const twilio = require('twilio')

const twilioClient = twilio(
  'ACfc9d84af3a17ab4c6ca2df7c0a28e4fb',
  'c1148cbbceeb9805dfebcae10688287d'
)

const TWILIO_FROM = '+18147032351'
const ALERT_PHONE = '+917366024179'

const express = require('express');
const cors = require('cors');
const db = require('./database');
const { publishAlert, publishStaffNotification } = require('./mqttClient');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ 
  limit: '50mb', 
  extended: true 
}));
app.use(express.static('public'));
app.use(express.static('../crisis-frontend'));

// Helper function to map alert types to roles
function getRolesForAlert(alertType) {
  switch (alertType.toLowerCase()) {
    case 'panic':
      return ['security', 'manager'];
    case 'fire':
      return ['security', 'manager', 'frontdesk'];
    case 'medical':
      return ['frontdesk', 'manager'];
    default:
      return ['manager'];
  }
}

async function sendSMSAlert(
  room_number, 
  alert_type, 
  assigned_role
) {
  const time = new Date().toLocaleTimeString(
    'en-IN', 
    { hour: '2-digit', minute: '2-digit' }
  )

  const message = 
    `🚨 HOTELSHIELD ALERT\n` +
    `Room: ${room_number}\n` +
    `Type: ${alert_type.toUpperCase()}\n` +
    `Assigned: ${assigned_role}\n` +
    `Time: ${time}\n` +
    `Status: ACTIVE\n` +
    `Act immediately!`

  try {
    await twilioClient.messages.create({
      body: message,
      from: TWILIO_FROM,
      to: ALERT_PHONE
    })
    console.log('SMS sent to', ALERT_PHONE)
  } catch (error) {
    console.error('SMS failed:', error.message)
  }
}

// POST /alert → receives room number + alert type, publishes to MQTT, saves to DB
app.post('/alert', async (req, res) => {
  const { room_number, alert_type } = req.body;

  if (!room_number || !alert_type) {
    return res.status(400).json({ error: 'room_number and alert_type are required' });
  }

  const assignedRoles = getRolesForAlert(alert_type);
  const rolesString = assignedRoles.join(',');

  // Log incident to SQLite
  const stmt = `INSERT INTO incidents (room_number, alert_type, assigned_staff_role, status) VALUES (?, ?, ?, 'new')`;
  db.run(stmt, [room_number, alert_type, rolesString], async function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to log incident' });
    }

    const incidentId = this.lastID;
    const payload = {
      incident_id: incidentId,
      room_number,
      alert_type,
      timestamp: new Date().toISOString(),
      status: 'new'
    };

    // Publish to the specific room's alert topic
    publishAlert(room_number, payload);

    // Publish to all assigned staff role topics
    assignedRoles.forEach(role => {
      publishStaffNotification(role, payload);
    });

    await sendSMSAlert(
      room_number, 
      alert_type, 
      rolesString
    )

    res.status(201).json({ message: 'Alert triggered successfully', incident_id: incidentId });
  });
});

// GET /incidents/latest → returns the 5 most recent incidents
app.get('/incidents/latest', (req, res) => {
  db.all("SELECT * FROM incidents ORDER BY timestamp DESC LIMIT 5", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch latest incidents' });
    }
    res.json(rows);
  });
});

// GET /incidents → returns all logged incidents with timestamps
app.get('/incidents', (req, res) => {
  db.all("SELECT * FROM incidents ORDER BY timestamp DESC", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch incidents' });
    }
    res.json(rows);
  });
});

// PATCH /incidents/:id → update status to "responding" or "resolved"
app.patch('/incidents/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['responding', 'resolved'].includes(status.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid status. Must be responding or resolved' });
  }

  const stmt = `UPDATE incidents SET status = ? WHERE id = ?`;
  db.run(stmt, [status, id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to update incident' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    res.json({ message: 'Incident updated successfully', id, status });
  });
});

const PORT = process.env.PORT || 3000;
// GET /simulate/panic?room=302 → triggers a test panic alert for demo purposes
app.get('/simulate/panic', (req, res) => {
  const room = req.query.room || '302';
  
  // Create an internal fetch request to our own POST endpoint
  fetch(`http://localhost:${PORT}/alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_number: room, alert_type: 'panic' })
  })
  .then(response => response.json())
  .then(data => res.json({ simulation_status: 'success', details: data }))
  .catch(err => res.status(500).json({ simulation_status: 'error', details: err.message }));
});

app.post('/analyze-frame', async (req, res) => {
  const { imageBase64 } = req.body

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=AIzaSyByEGgQEC1KpT6KajXkrbDiv7_8AdkgZqc`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageBase64
              },
              features: [
                {
                  type: 'LABEL_DETECTION',
                  maxResults: 10
                },
                {
                  type: 'OBJECT_LOCALIZATION',
                  maxResults: 10
                },
                {
                  type: 'SAFE_SEARCH_DETECTION'
                }
              ]
            }
          ]
        })
      }
    )

    const data = await response.json()

    // Extract labels
    const labels = data.responses[0]
      .labelAnnotations || []
    const objects = data.responses[0]
      .localizedObjectAnnotations || []
    const safeSearch = data.responses[0]
      .safeSearchAnnotation || {}

    // Convert Google Vision results to
    // our threat format
    const result = analyzeThreat(
      labels, objects, safeSearch
    )

    res.json(result)

  } catch (error) {
    console.error('Vision API error:', error)
    res.status(500).json({
      threat_detected: false,
      threat_type: 'none',
      confidence: 0,
      alert_type: 'none',
      description: 'Analysis failed',
      severity: 'low'
    })
  }
})

// Threat analysis logic
function analyzeThreat(
  labels, objects, safeSearch
) {
  const labelNames = labels.map(
    l => l.description.toLowerCase()
  )
  const objectNames = objects.map(
    o => o.name.toLowerCase()
  )
  const allDetected = [
    ...labelNames, 
    ...objectNames
  ]

  console.log('Detected:', allDetected)

  // Check for fire
  if (
    allDetected.some(d => 
      d.includes('fire') || 
      d.includes('flame') ||
      d.includes('smoke') ||
      d.includes('burning')
    )
  ) {
    return {
      threat_detected: true,
      threat_type: 'fire',
      confidence: 0.92,
      alert_type: 'fire',
      description: 'Fire or smoke detected in camera feed',
      severity: 'high'
    }
  }

  // Check for person falling or on ground
  if (
    allDetected.some(d =>
      d.includes('fall') ||
      d.includes('lying') ||
      d.includes('ground') ||
      d.includes('floor')
    ) &&
    allDetected.some(d =>
      d.includes('person') ||
      d.includes('human') ||
      d.includes('people')
    )
  ) {
    return {
      threat_detected: true,
      threat_type: 'person_falling',
      confidence: 0.85,
      alert_type: 'medical',
      description: 'Person detected on ground — possible medical emergency',
      severity: 'high'
    }
  }

  // Check for crowd gathering
  if (
    allDetected.some(d =>
      d.includes('crowd') ||
      d.includes('group') ||
      d.includes('gathering')
    )
  ) {
    return {
      threat_detected: true,
      threat_type: 'crowd_gathering',
      confidence: 0.78,
      alert_type: 'security',
      description: 'Unusual crowd gathering detected',
      severity: 'medium'
    }
  }

  // Check for violence indicators
  if (safeSearch.violence === 'LIKELY' ||
      safeSearch.violence === 'VERY_LIKELY') {
    return {
      threat_detected: true,
      threat_type: 'fight',
      confidence: 0.88,
      alert_type: 'panic',
      description: 'Possible violent activity detected',
      severity: 'high'
    }
  }

  // Check for running
  if (
    allDetected.some(d =>
      d.includes('running') ||
      d.includes('sprint') ||
      d.includes('chase')
    )
  ) {
    return {
      threat_detected: true,
      threat_type: 'running',
      confidence: 0.72,
      alert_type: 'security',
      description: 'Person running detected in corridor',
      severity: 'medium'
    }
  }

  // No threat detected
  const hasPersonOnly = allDetected.some(d =>
    d.includes('person') ||
    d.includes('human')
  )

  return {
    threat_detected: false,
    threat_type: 'none',
    confidence: 0.90,
    alert_type: 'none',
    description: hasPersonOnly
      ? 'Person detected — no threat identified'
      : 'No persons or threats detected',
    severity: 'low'
  }
}

app.post('/analyze-audio', async (req, res) => {
  const { audioBase64 } = req.body

  if (!audioBase64) {
    return res.status(400).json({
      threat_detected: false,
      threat_type: 'none',
      confidence: 0,
      alert_type: 'none',
      description: 'No audio data received',
      severity: 'low'
    })
  }

  try {
    // Save webm to temp file
    const audioBuffer = Buffer.from(
      audioBase64, 'base64'
    )

    const tempDir = os.tmpdir()
    const inputPath = path.join(
      tempDir, `audio_${Date.now()}.webm`
    )
    const outputPath = path.join(
      tempDir, `audio_${Date.now()}.wav`
    )

    fs.writeFileSync(inputPath, audioBuffer)
    console.log(
      'Saved webm:', inputPath,
      'Size:', audioBuffer.length
    )

    // Convert webm to wav using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('wav')
        .audioFrequency(16000)
        .audioChannels(1)
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath)
    })

    console.log('Converted to WAV:', outputPath)

    // Read converted wav file
    const wavBuffer = fs.readFileSync(outputPath)
    console.log('WAV size:', wavBuffer.length)

    // Clean up temp files
    fs.unlinkSync(inputPath)
    fs.unlinkSync(outputPath)

    // Send to Hugging Face
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/MIT/ast-finetuned-audioset-10-10-0.4593',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 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',
          'Content-Type': 'application/octet-stream',
          'Accept': 'application/json'
        },
        body: wavBuffer
      }
    )

    console.log('HF Status:', response.status)

    if (!response.ok) {
      const errText = await response.text()
      console.log('HF Error:', errText.slice(0, 200))
      return res.json({
        threat_detected: false,
        threat_type: 'none',
        confidence: 0,
        alert_type: 'none',
        description: `HF Error ${response.status}`,
        severity: 'low'
      })
    }

    const responseText = await response.text()
    console.log('HF Response:', responseText)

    const data = JSON.parse(responseText)

    if (!Array.isArray(data)) {
      return res.json({
        threat_detected: false,
        threat_type: 'none',
        confidence: 0,
        alert_type: 'none',
        description: 'Unexpected response format',
        severity: 'low'
      })
    }

    const result = analyzeAudioThreat(data)
    console.log('Final result:', result)
    res.json(result)

  } catch (error) {
    console.error(
      'Audio analysis error:', error.message
    )
    res.status(500).json({
      threat_detected: false,
      threat_type: 'none',
      confidence: 0,
      alert_type: 'none',
      description: `Error: ${error.message}`,
      severity: 'low'
    })
  }
})

// Audio threat analysis
function analyzeAudioThreat(predictions) {
  if (!Array.isArray(predictions)) {
    return {
      threat_detected: false,
      threat_type: 'none',
      confidence: 0,
      alert_type: 'none',
      description: 'Invalid audio response',
      severity: 'low'
    }
  }

  console.log('Audio predictions:', predictions)

  // Map of dangerous sounds to alert types
  const threatSounds = {
    // Fire related
    'Fire alarm': {
      type: 'fire_alarm',
      alert: 'fire',
      severity: 'high'
    },
    'Smoke detector': {
      type: 'fire_alarm',
      alert: 'fire',
      severity: 'high'
    },
    'Fire': {
      type: 'fire',
      alert: 'fire',
      severity: 'high'
    },
    'Crackle': {
      type: 'fire',
      alert: 'fire',
      severity: 'high'
    },

    // Violence related
    'Gunshot, gunfire': {
      type: 'gunshot',
      alert: 'panic',
      severity: 'high'
    },
    'Gunshot': {
      type: 'gunshot',
      alert: 'panic',
      severity: 'high'
    },
    'Explosion': {
      type: 'explosion',
      alert: 'panic',
      severity: 'high'
    },
    'Bang': {
      type: 'explosion',
      alert: 'panic',
      severity: 'high'
    },
    'Boom': {
      type: 'explosion',
      alert: 'panic',
      severity: 'high'
    },

    // Glass break
    'Breaking': {
      type: 'glass_break',
      alert: 'security',
      severity: 'high'
    },
    'Glass': {
      type: 'glass_break',
      alert: 'security',
      severity: 'medium'
    },
    'Shatter': {
      type: 'glass_break',
      alert: 'security',
      severity: 'high'
    },

    // Distress
    'Screaming': {
      type: 'screaming',
      alert: 'panic',
      severity: 'high'
    },
    'Crying, sobbing': {
      type: 'distress',
      alert: 'medical',
      severity: 'medium'
    },
    'Crying': {
      type: 'distress',
      alert: 'medical',
      severity: 'medium'
    },
    'Shouting': {
      type: 'screaming',
      alert: 'panic',
      severity: 'high'
    },
    'Yell': {
      type: 'screaming',
      alert: 'panic',
      severity: 'high'
    },

    // Medical
    'Cough': {
      type: 'medical',
      alert: 'medical',
      severity: 'low'
    },
    'Choking': {
      type: 'medical',
      alert: 'medical',
      severity: 'high'
    },

    // Alarm
    'Alarm': {
      type: 'alarm',
      alert: 'security',
      severity: 'high'
    },
    'Siren': {
      type: 'alarm',
      alert: 'security',
      severity: 'high'
    },
    'Beep, bleep': {
      type: 'alarm',
      alert: 'security',
      severity: 'medium'
    }
  }

  // Check each prediction against threat map
  for (const prediction of predictions) {
    const label = prediction.label
    const score = prediction.score

    // Check direct match
    if (threatSounds[label] && score > 0.3) {
      const threat = threatSounds[label]
      return {
        threat_detected: true,
        threat_type: threat.type,
        confidence: score,
        alert_type: threat.alert,
        description: `${label} detected with ${
          Math.round(score * 100)
        }% confidence`,
        severity: threat.severity
      }
    }

    // Check partial match
    for (const [key, threat] of 
         Object.entries(threatSounds)) {
      if (
        label.toLowerCase()
          .includes(key.toLowerCase()) &&
        score > 0.25
      ) {
        return {
          threat_detected: true,
          threat_type: threat.type,
          confidence: score,
          alert_type: threat.alert,
          description: `${label} detected — ${
            Math.round(score * 100)
          }% confidence`,
          severity: threat.severity
        }
      }
    }
  }

  // No threat found
  const topSound = predictions[0]
  return {
    threat_detected: false,
    threat_type: 'none',
    confidence: topSound?.score || 0,
    alert_type: 'none',
    description: `Normal audio — top sound: ${
      topSound?.label || 'unknown'
    } (${
      Math.round((topSound?.score || 0) * 100)
    }%)`,
    severity: 'low'
  }
}

app.post('/send-alert', async (req, res) => {
  const { room_number, alert_type } = req.body

  await sendSMSAlert(
    room_number,
    alert_type,
    'security'
  )

  res.json({ 
    message: 'SMS sent',
    room: room_number
  })
})

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
