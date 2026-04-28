// ================================
// STATE
// ================================
let currentDept = 'Medical'
let activeEmergency = null
let feedMessages = []

// ================================
// DEPARTMENT SWITCHING
// ================================
function setDept(dept) {
  currentDept = dept

  // Update badge text
  document.getElementById('dept-badge').textContent =
    dept

  // Update button states
  document.querySelectorAll('.dept-btn')
    .forEach(btn => btn.classList.remove('active'))

  const activeBtn = document.getElementById(
    `dept-${dept}`
  )
  if (activeBtn) activeBtn.classList.add('active')

  // Re-filter with new department
  loadData()
}

// ================================
// FLOOR MAP
// ================================
function updateResponderMap(incidents) {
  // Reset all room cells
  document.querySelectorAll(
    '[id^="resp-room-"]'
  ).forEach(cell => {
    cell.classList.remove(
      'active', 'resolved', 'responding'
    )
  })

  // Highlight rooms based on incidents
  incidents.forEach(incident => {
    const cell = document.getElementById(
      `resp-room-${incident.room_number}`
    )
    if (cell) {
      if (incident.status === 'resolved') {
        cell.classList.add('resolved')
      } else if (incident.status === 'responding') {
        cell.classList.add('responding')
      } else {
        cell.classList.add('active')
      }
    }
  })
}

// ================================
// EMERGENCY CARD
// ================================
function showEmergency(incident) {
  activeEmergency = incident

  document.getElementById('no-emergency')
    .style.display = 'none'
  document.getElementById('emergency-card')
    .style.display = 'block'
  document.getElementById('action-card')
    .style.display = 'block'

  // Type badge
  document.getElementById('emergency-type')
    .textContent = incident.alert_type.toUpperCase()

  // Time ago
  const mins = Math.floor(
    (Date.now() - new Date(incident.timestamp)) / 60000
  )
  document.getElementById('emergency-time')
    .textContent = `${mins}m ago`

  // Room number
  document.getElementById('emergency-room')
    .textContent = incident.room_number

  // Floor info
  const floor = incident.room_number.charAt(0)
  document.querySelector('.emergency-floor')
    .textContent = `Floor ${floor} — North Wing`

  // Meta
  document.getElementById('emergency-assigned')
    .textContent = incident.assigned_staff_role
  document.getElementById('emergency-status')
    .textContent = incident.status
  document.getElementById('emergency-id')
    .textContent = `#${String(incident.id).padStart(3, '0')}`
}

function hideEmergency() {
  activeEmergency = null
  document.getElementById('no-emergency')
    .style.display = 'block'
  document.getElementById('emergency-card')
    .style.display = 'none'
  document.getElementById('action-card')
    .style.display = 'none'
}

// ================================
// STATUS FEED
// ================================
function addFeedMessage(text, color) {
  const time = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  feedMessages.unshift({ text, color, time })

  // Keep only last 10 messages
  if (feedMessages.length > 10) {
    feedMessages = feedMessages.slice(0, 10)
  }

  renderFeed()
}

function renderFeed() {
  const container = document.getElementById(
    'status-feed'
  )

  if (feedMessages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        Waiting for updates...
      </div>`
    return
  }

  container.innerHTML = feedMessages.map(msg => `
    <div class="feed-item">
      <span class="feed-dot ${msg.color}"></span>
      <span class="feed-text">${msg.text}</span>
      <span class="feed-time">${msg.time}</span>
    </div>
  `).join('')
}

// ================================
// RESPONDER ACTIONS
// ================================
async function responderAction(action) {
  if (!activeEmergency) return

  await updateIncidentStatus(
    activeEmergency.id, action
  )

  if (action === 'responding') {
    addFeedMessage(
      `🚑 ${currentDept} responding to Room ` +
      `${activeEmergency.room_number}`,
      'orange'
    )
  } else if (action === 'resolved') {
    addFeedMessage(
      `✅ Room ${activeEmergency.room_number} ` +
      `emergency resolved by ${currentDept}`,
      'green'
    )
  }

  loadData()
}

async function requestBackup() {
  if (!activeEmergency) return

  addFeedMessage(
    `🆘 Backup requested for Room ` +
    `${activeEmergency.room_number} ` +
    `by ${currentDept}`,
    'red'
  )
}

// ================================
// DEPARTMENT → ROLE MAPPING
// ================================
function deptToRole(dept) {
  const map = {
    'Police':  'security',
    'Medical': 'medical',
    'Fire':    'maintenance'
  }
  return map[dept] || 'security'
}

// ================================
// MAIN DATA LOADER
// ================================
async function loadData() {
  const incidents = await getLatestIncidents()
  if (!incidents) return

  // Update floor map with all incidents
  updateResponderMap(incidents)

  // Filter for this department's active incidents
  const role = deptToRole(currentDept)
  const myActive = incidents.filter(i =>
    i.assigned_staff_role.toLowerCase() ===
      role &&
    i.status !== 'resolved'
  )

  if (myActive.length > 0) {
    // Show the most recent active emergency
    showEmergency(myActive[0])
  } else {
    hideEmergency()
  }
}

// ================================
// INITIAL FEED MESSAGE
// ================================
addFeedMessage(
  `📡 ${currentDept} unit connected to dispatch`,
  'grey'
)

// ================================
// START POLLING
// ================================
