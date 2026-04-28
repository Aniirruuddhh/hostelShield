// Get hotel ID from app.js global state
function getHotelId() {
  if (typeof currentHotelId !== 'undefined'
    && currentHotelId) {
    return currentHotelId
  }
  // Fallback — get first hotel from Supabase
  return null
}

// ================================
// STATE
// ================================
let stream = null
let detectionInterval = null
let isDetecting = false
let lastAlertTime = 0
let sensitivity = 20
let detectionLog = []
const COOLDOWN_MS = 30000
const ANALYSIS_INTERVAL_MS = 5000

// ================================
// CAMERA SETUP
// ================================
async function startDetection() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    })

    const video = document.getElementById('camera-feed')
    video.srcObject = stream

    document.getElementById('camera-overlay')
      .classList.add('hidden')
    document.getElementById('start-btn').disabled = true
    document.getElementById('stop-btn').disabled = false
    document.getElementById('detector-badge')
      .textContent = 'AI Active'
    document.getElementById('detector-badge')
      .classList.add('active')
    document.getElementById('motion-dot')
      .classList.add('green')

    isDetecting = true

    // Start AI analysis every 5 seconds
    video.addEventListener('loadeddata', () => {
      detectionInterval = setInterval(
        analyzeWithAI, ANALYSIS_INTERVAL_MS
      )
    })

  } catch (error) {
    alert(
      'Camera access denied. ' +
      'Please allow camera permission.'
    )
    console.error('Camera error:', error)
  }
}

// ================================
// STOP DETECTION
// ================================
function stopDetection() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
  if (detectionInterval) {
    clearInterval(detectionInterval)
    detectionInterval = null
  }

  isDetecting = false

  const video = document.getElementById('camera-feed')
  video.srcObject = null

  document.getElementById('camera-overlay')
    .classList.remove('hidden')
  document.getElementById('start-btn').disabled = false
  document.getElementById('stop-btn').disabled = true
  document.getElementById('detector-badge')
    .textContent = 'Standby'
  document.getElementById('detector-badge')
    .classList.remove('active')
  document.getElementById('motion-dot')
    .classList.remove('active', 'green')
  document.getElementById('motion-indicator')
    .classList.remove('show')
  document.getElementById('motion-meter')
    .style.width = '0%'
  document.getElementById('motion-value')
    .textContent = 'Waiting...'
}

// ================================
// CAPTURE FRAME AS BASE64
// ================================
function captureFrame() {
  const video = document.getElementById('camera-feed')
  const canvas = document.getElementById('motion-canvas')

  if (video.readyState !== video.HAVE_ENOUGH_DATA) {
    return null
  }

  // Capture at reasonable resolution
  canvas.width = 640
  canvas.height = 480

  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, 640, 480)

  // Return as base64 JPEG
  return canvas.toDataURL('image/jpeg', 0.6)
    .split(',')[1]
}

// ================================
// CLAUDE AI ANALYSIS
// ================================
async function analyzeWithAI() {
  const base64Image = captureFrame()
  if (!base64Image) return

  // Update UI to show analyzing
  document.getElementById('motion-value')
    .textContent = 'AI Analyzing...'
  document.getElementById('motion-meter')
    .style.width = '50%'

  try {
    const response = await fetch(
      'http://localhost:3000/analyze-frame',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageBase64: base64Image
        })
      }
    )

    const result = await response.json()
    console.log('Vision AI Result:', result)
    handleAIResult(result)

  } catch (error) {
    console.error('Analysis error:', error)
    document.getElementById('motion-value')
      .textContent = 'Analysis failed'
    document.getElementById('motion-meter')
      .style.width = '0%'
  }
}

// ================================
// HANDLE AI RESULT
// ================================
async function handleAIResult(result) {
  console.log('AI Result:', result)

  // Update meter based on confidence
  const confidencePct = Math.round(
    result.confidence * 100
  )
  document.getElementById('motion-meter')
    .style.width = `${confidencePct}%`
  document.getElementById('motion-value')
    .textContent = result.threat_detected
      ? `⚠️ ${result.threat_type
        .replace(/_/g, ' ')
        .toUpperCase()} — ${confidencePct}%`
      : `✅ Clear — ${confidencePct}% confidence`

  if (result.threat_detected &&
    result.severity !== 'low' &&
    result.alert_type !== 'none') {

    // Show motion indicator on camera
    const indicator = document.getElementById(
      'motion-indicator'
    )
    indicator.textContent =
      `⚠️ ${result.threat_type
        .replace(/_/g, ' ')
        .toUpperCase()}`
    indicator.classList.add('show')

    // Update motion dot
    document.getElementById('motion-dot')
      .classList.remove('green')
    document.getElementById('motion-dot')
      .classList.add('active')

    // Check cooldown before firing alert
    const now = Date.now()
    if (now - lastAlertTime < COOLDOWN_MS) {
      addToLog(
        result.threat_type,
        document.getElementById('room-select').value,
        result.description,
        result.confidence,
        false
      )
      return
    }
    lastAlertTime = now

    // Fire alert to backend
    const room = document.getElementById(
      'room-select'
    ).value
    await postAlertSupabase(
      getHotelId(),
      room,
      result.alert_type
    )

    // Update alert dot
    document.getElementById('alert-dot')
      .classList.add('active')
    setTimeout(() => {
      document.getElementById('alert-dot')
        .classList.remove('active')
    }, 3000)

    // Add to log
    addToLog(
      result.threat_type,
      room,
      result.description,
      result.confidence,
      true
    )

  } else {
    // No threat — clear indicators
    document.getElementById('motion-indicator')
      .classList.remove('show')
    document.getElementById('motion-dot')
      .classList.remove('active')
    document.getElementById('motion-dot')
      .classList.add('green')

    // Still log the clear status
    addToLog(
      'clear',
      document.getElementById('room-select').value,
      result.description,
      result.confidence,
      false
    )
  }
}

// ================================
// SIMULATION PANEL
// ================================
async function simulate(alertType) {
  const room = document.getElementById(
    'room-select'
  ).value

  // Use Supabase instead of local backend
  const result = await postAlertSupabase(
    getHotelId(),
    room,
    alertType
  )
  console.log(`${alertType} simulated:`, result)

  // Also send SMS via backend
  try {
    await fetch(
      'http://localhost:3000/send-alert',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_number: room,
          alert_type: alertType
        })
      }
    )
  } catch (e) {
    console.log('SMS unavailable:', e)
  }

  document.getElementById('alert-dot')
    .classList.add('active')
  setTimeout(() => {
    document.getElementById('alert-dot')
      .classList.remove('active')
  }, 3000)

  addToLog(
    alertType,
    room,
    'Manually simulated',
    1.0,
    true
  )
}

// ================================
// DETECTION LOG
// ================================
function addToLog(
  type, room, description,
  confidence, alerted
) {
  const now = new Date().toLocaleTimeString()

  detectionLog.unshift({
    type,
    room,
    description,
    confidence,
    alerted,
    now
  })

  if (detectionLog.length > 10) {
    detectionLog = detectionLog.slice(0, 10)
  }

  const container = document.getElementById(
    'detection-log'
  )

  container.innerHTML = detectionLog.map(item => `
    <div class="log-item">
      <div class="log-left">
        <span class="log-type" style="color: ${item.type === 'clear'
      ? '#388E3C'
      : '#D32F2F'
    }">
          ${item.type === 'clear' ? '✅' : '⚠️'}
          ${item.type.replace(/_/g, ' ').toUpperCase()}
        </span>
        <span class="log-room">
          Room ${item.room}
          ${item.description
      ? `— ${item.description}`
      : ''}
        </span>
        <span class="log-room">
          Confidence: ${Math.round(
        (item.confidence || 0) * 100
      )}%
          ${item.alerted
      ? '🚨 Alert Fired'
      : ''}
        </span>
      </div>
      <span class="log-time">${item.now}</span>
    </div>
  `).join('')
}

// ================================
// SENSITIVITY CONTROL
// ================================
function updateSensitivity(value) {
  sensitivity = parseInt(value)
  document.getElementById('sensitivity-value')
    .textContent = value
}
