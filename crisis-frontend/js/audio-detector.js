// ================================
// STATE
// ================================
let audioStream = null
let audioContext = null
let mediaRecorder = null
let audioChunks = []
let isAudioDetecting = false
let audioInterval = null
let lastAudioAlertTime = 0
const AUDIO_COOLDOWN_MS = 15000
const RECORD_DURATION_MS = 3000

// ================================
// START AUDIO DETECTION
// ================================
async function startAudioDetection() {
  try {
    audioStream = await navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })

    audioContext = new AudioContext()
    isAudioDetecting = true

    // Update audio dot
    document.getElementById('audio-dot')
      .classList.add('green')

    // Start recording cycles
    recordAudioCycle()
    audioInterval = setInterval(
      recordAudioCycle,
      RECORD_DURATION_MS + 1000
    )

    console.log('Audio detection started')

  } catch (error) {
    console.error('Microphone error:', error)
    alert(
      'Microphone access denied. ' +
      'Please allow microphone permission.'
    )
  }
}

// ================================
// STOP AUDIO DETECTION
// ================================
function stopAudioDetection() {
  if (audioStream) {
    audioStream.getTracks()
      .forEach(t => t.stop())
    audioStream = null
  }

  if (audioInterval) {
    clearInterval(audioInterval)
    audioInterval = null
  }

  if (audioContext) {
    audioContext.close()
    audioContext = null
  }

  isAudioDetecting = false

  document.getElementById('audio-dot')
    .classList.remove('active', 'green')

  console.log('Audio detection stopped')
}

// ================================
// RECORD AUDIO CYCLE
// ================================
function recordAudioCycle() {
  if (!audioStream || !isAudioDetecting) return

  audioChunks = []

  try {
    mediaRecorder = new MediaRecorder(
      audioStream,
      { mimeType: 'audio/webm' }
    )

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = async () => {
      if (audioChunks.length > 0) {
        const audioBlob = new Blob(
          audioChunks,
          { type: 'audio/webm' }
        )
        await analyzeAudio(audioBlob)
      }
    }

    // Record for 3 seconds
    mediaRecorder.start()
    setTimeout(() => {
      if (mediaRecorder &&
          mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
      }
    }, RECORD_DURATION_MS)

  } catch (error) {
    console.error('Recording error:', error)
  }
}

// ================================
// ANALYZE AUDIO
// ================================
async function analyzeAudio(audioBlob) {
  try {
    // Convert blob to base64
    const base64 = await blobToBase64(audioBlob)

    const response = await fetch(
      'http://localhost:3000/analyze-audio',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioBase64: base64
        })
      }
    )

    const result = await response.json()
    console.log('Audio result:', result)

    handleAudioResult(result)

  } catch (error) {
    console.error('Audio analysis error:', error)
  }
}

// ================================
// HANDLE AUDIO RESULT
// ================================
async function handleAudioResult(result) {
  if (
    result.threat_detected &&
    result.severity !== 'low' &&
    result.alert_type !== 'none'
  ) {
    // Update audio dot to red
    document.getElementById('audio-dot')
      .classList.remove('green')
    document.getElementById('audio-dot')
      .classList.add('active')

    // Check cooldown
    const now = Date.now()
    if (now - lastAudioAlertTime < 
        AUDIO_COOLDOWN_MS) {
      addToLog(
        result.threat_type,
        document.getElementById(
          'room-select'
        ).value,
        result.description,
        result.confidence,
        false
      )
      return
    }
    lastAudioAlertTime = now

    // Get room
    const room = document.getElementById(
      'room-select'
    ).value

    // Fire alert to Supabase
    await postAlertSupabase(
      getHotelId(),
      room,
      result.alert_type
    )

    // Send SMS
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
            alert_type: result.alert_type
          })
        }
      )
    } catch(e) {
      console.log('SMS unavailable')
    }

    // Update alert dot
    document.getElementById('alert-dot')
      .classList.add('active')
    setTimeout(() => {
      document.getElementById('alert-dot')
        .classList.remove('active')
    }, 3000)

    // Reset audio dot after 5 seconds
    setTimeout(() => {
      document.getElementById('audio-dot')
        .classList.remove('active')
      document.getElementById('audio-dot')
        .classList.add('green')
    }, 5000)

    // Add to log
    addToLog(
      `🎤 ${result.threat_type}`,
      room,
      result.description,
      result.confidence,
      true
    )

  } else {
    // Clear audio dot
    document.getElementById('audio-dot')
      .classList.remove('active')
    document.getElementById('audio-dot')
      .classList.add('green')

    // Log clear status
    addToLog(
      '🎤 clear',
      document.getElementById(
        'room-select'
      ).value,
      result.description,
      result.confidence,
      false
    )
  }
}

// ================================
// BLOB TO BASE64
// ================================
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result
        .split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
