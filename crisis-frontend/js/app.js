let currentRole = null
let currentHotel = 'grand'
let staffPollingInterval = null
let responderPollingInterval = null
let currentHotelId = null
let hotels = []

// ================================
// HOTEL SELECTOR
// ================================
async function loadHotels() {
  hotels = await getHotels()
  const select = document.getElementById(
    'hotel-select'
  )

  if (hotels.length === 0) {
    select.innerHTML =
      '<option>No hotels found</option>'
    return
  }

  select.innerHTML = hotels.map(h => `
    <option value="${h.id}">
      🏨 ${h.name} — ${h.city}
    </option>
  `).join('')

  // Set first hotel as default
  currentHotelId = hotels[0].id
  select.value = currentHotelId
}

function selectHotel(value) {
  currentHotelId = value
  console.log('Hotel selected:', value)
}

// ================================
// ROLE SELECTOR
// ================================
function selectRole(role) {
  currentRole = role

  // Hide all screens
  document.querySelectorAll('.screen')
    .forEach(s => s.classList.remove('active'))

  // Show selected screen
  document.getElementById(`screen-${role}`)
    .classList.add('active')

  // Scroll to top
  window.scrollTo(0, 0)

  // Auto start detection when 
  // detector role selected
  if (role === 'detector') {
    setTimeout(() => {
      startAll()
    }, 1000)
  }

  // Start polling for relevant roles
  if (role === 'staff') {
    startStaffPolling()
  }

  if (role === 'responder') {
    startResponderPolling()
  }
}

// ================================
// GO BACK TO ROLE SELECTOR
// ================================
function goBack() {
  // Stop all polling
  if (staffPollingInterval) {
    clearInterval(staffPollingInterval)
    staffPollingInterval = null
  }
  if (responderPollingInterval) {
    clearInterval(responderPollingInterval)
    responderPollingInterval = null
  }

  // Stop camera if detector was active
  if (currentRole === 'detector') {
    try { stopDetection() } catch (e) { }
  }

  // Hide all screens
  document.querySelectorAll('.screen')
    .forEach(s => s.classList.remove('active'))

  // Show role selector
  document.getElementById('screen-role')
    .classList.add('active')

  window.scrollTo(0, 0)
  currentRole = null
}

// ================================
// STAFF POLLING
// ================================
function startStaffPolling() {
  loadStaffData()
  staffPollingInterval = setInterval(
    loadStaffData, 3000
  )
}

async function loadStaffData() {
  if (!currentHotelId) return
  const incidents = await getIncidentsSupabase(
    currentHotelId
  )
  if (!incidents) return

  allIncidents = incidents

  updateFloorMap(incidents)
  updateStats(incidents)
  updateRecentActivity(incidents)
  updateAlertsList(incidents)
  updateLogTable(incidents)
  updateAnalytics(incidents)
}

// ================================
// RESPONDER POLLING
// ================================
function startResponderPolling() {
  loadResponderDataSupabase()
  responderPollingInterval = setInterval(
    loadResponderDataSupabase, 3000
  )
}

async function loadResponderDataSupabase() {
  if (!currentHotelId) return
  const incidents = await getIncidentsSupabase(
    currentHotelId
  )
  if (!incidents) return

  // Reuse existing loadResponderData logic
  // but pass incidents directly
  processResponderIncidents(incidents)
}

function processResponderIncidents(incidents) {
  if (!incidents || incidents.length === 0) {
    document.getElementById('no-emergency')
      .style.display = 'block'
    document.getElementById('emergency-card')
      .style.display = 'none'
    document.getElementById('action-card')
      .style.display = 'none'
    return
  }

  const active = incidents.find(
    i => i.status !== 'resolved'
  )

  if (!active) {
    document.getElementById('no-emergency')
      .style.display = 'block'
    document.getElementById('emergency-card')
      .style.display = 'none'
    document.getElementById('action-card')
      .style.display = 'none'
    return
  }

  document.getElementById('no-emergency')
    .style.display = 'none'
  document.getElementById('emergency-card')
    .style.display = 'block'
  document.getElementById('action-card')
    .style.display = 'block'

  document.getElementById('emergency-type')
    .textContent = active.alert_type.toUpperCase()
  document.getElementById('emergency-room')
    .textContent = active.room_number
  document.getElementById('emergency-assigned')
    .textContent = active.assigned_staff_role
  document.getElementById('emergency-status')
    .textContent = active.status
  document.getElementById('emergency-id')
    .textContent = `#${active.id}`

  const elapsed = Math.round(
    (Date.now() -
      new Date(active.timestamp)) / 60000
  )
  document.getElementById('emergency-time')
    .textContent = `${elapsed}m ago`

  incidents.forEach(incident => {
    const room = document.getElementById(
      `resp-room-${incident.room_number}`
    )
    if (room) {
      room.classList.remove('active', 'resolved')
      if (incident.status === 'resolved') {
        room.classList.add('resolved')
      } else {
        room.classList.add('active')
      }
    }
  })

  const feed = document.getElementById('status-feed')
  feed.innerHTML = incidents.slice(0, 5).map(i => `
    <div class="feed-item">
      <div class="feed-dot ${i.status === 'resolved' ? 'green' :
      i.status === 'responding' ? 'orange' : ''
    }"></div>
      <div class="feed-content">
        <div class="feed-text">
          Room ${i.room_number} — 
          ${i.alert_type} — 
          ${i.assigned_staff_role}
        </div>
        <div class="feed-time">
          ${new Date(i.timestamp)
      .toLocaleTimeString()} — 
          ${i.status}
        </div>
      </div>
    </div>
  `).join('')
}

// ================================
// RESPONDER ACTIONS
// ================================
async function responderAction(status) {
  const incidents = await getIncidentsSupabase(
    currentHotelId
  )
  if (!incidents) return

  const active = incidents.find(
    i => i.status !== 'resolved'
  )
  if (!active) return

  await updateIncidentSupabase(active.id, status)
  loadResponderDataSupabase()
}

async function requestBackup() {
  alert(
    '🆘 Backup Requested!\n\n' +
    'Additional units have been notified.\n' +
    'ETA: 5-8 minutes'
  )
}

// ================================
// DEPT SELECTOR (RESPONDER)
// ================================
function setDept(dept) {
  document.querySelectorAll('.dept-btn')
    .forEach(b => b.classList.remove('active'))
  document.getElementById(`dept-${dept}`)
    .classList.add('active')
  document.getElementById('dept-badge')
    .textContent = dept
}

// ================================
// DETECTOR CONTROLS
// ================================
function startAll() {
  // Start camera detection
  startDetection()

  // Start audio detection
  startAudioDetection()

  // Update button states
  document.getElementById('start-btn')
    .disabled = true
  document.getElementById('stop-btn')
    .disabled = false
}

function stopAll() {
  // Stop camera detection
  stopDetection()

  // Stop audio detection
  stopAudioDetection()

  // Update button states
  document.getElementById('start-btn')
    .disabled = false
  document.getElementById('stop-btn')
    .disabled = true
}

// Load hotels when app starts
document.addEventListener(
  'DOMContentLoaded', loadHotels
)
