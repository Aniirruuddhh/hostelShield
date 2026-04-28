let currentTab = 'dashboard'
let allIncidents = []
let currentFilter = 'all'

// ================================
// SIDEBAR
// ================================
function openSidebar() {
  document.getElementById('sidebar')
    .classList.add('open')
  document.getElementById('overlay')
    .classList.add('show')
}

function closeSidebar() {
  document.getElementById('sidebar')
    .classList.remove('open')
  document.getElementById('overlay')
    .classList.remove('show')
}

// ================================
// TAB SWITCHING
// ================================
function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content')
    .forEach(t => t.classList.remove('active'))

  // Remove active from bottom tabs
  document.querySelectorAll('.tab-item')
    .forEach(t => t.classList.remove('active'))

  // Remove active from sidebar items
  document.querySelectorAll('.sidebar-item')
    .forEach(t => t.classList.remove('active'))

  // Show selected tab
  document.getElementById(`tab-${tabName}`)
    .classList.add('active')

  // Highlight bottom tab
  const btab = document.getElementById(
    `btab-${tabName}`
  )
  if (btab) btab.classList.add('active')

  currentTab = tabName
  closeSidebar()
}

// ================================
// FLOOR MAP
// ================================
function updateFloorMap(incidents) {
  // Reset all rooms
  document.querySelectorAll('.room-cell')
    .forEach(cell => {
      cell.classList.remove('active', 'resolved')
    })

  // Update based on incidents
  incidents.forEach(incident => {
    const room = document.getElementById(
      `room-${incident.room_number}`
    )
    if (room) {
      if (incident.status === 'resolved') {
        room.classList.add('resolved')
      } else {
        room.classList.add('active')
      }
    }
  })
}

// ================================
// STATS
// ================================
function updateStats(incidents) {
  const active = incidents.filter(
    i => i.status !== 'resolved'
  ).length

  const resolved = incidents.filter(
    i => i.status === 'resolved'
  ).length

  document.getElementById('stat-total').textContent =
    incidents.length
  document.getElementById('stat-active').textContent =
    active
  document.getElementById('stat-resolved').textContent =
    resolved
  document.getElementById('stat-avg').textContent =
    '2m'
}

// ================================
// RECENT ACTIVITY
// ================================
function updateRecentActivity(incidents) {
  const container = document.getElementById(
    'recent-activity'
  )
  if (incidents.length === 0) {
    container.innerHTML = 
      '<div class="empty-state">No incidents yet</div>'
    return
  }

  const last3 = incidents.slice(0, 3)
  container.innerHTML = last3.map(i => `
    <div class="activity-item">
      <span>
        <span class="activity-room">
          Room ${i.room_number}
        </span>
        — ${i.alert_type}
      </span>
      <span class="badge badge-${i.status}">
        ${i.status}
      </span>
    </div>
  `).join('')
}

// ================================
// ALERTS LIST
// ================================
function updateAlertsList(incidents) {
  const container = document.getElementById('alerts-list')
  const active = incidents.filter(
    i => i.status !== 'resolved'
  )

  if (active.length === 0) {
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          No active alerts 🟢
        </div>
      </div>`
    return
  }

  container.innerHTML = active.map(i => `
    <div class="alert-card">
      <div class="alert-room">Room ${i.room_number}</div>
      <div class="alert-meta">
        ${i.alert_type.toUpperCase()} • 
        Assigned: ${i.assigned_staff_role} • 
        ${new Date(i.timestamp).toLocaleTimeString()}
      </div>
      <div class="alert-actions">
        <button class="btn btn-outline" 
          onclick="respond(${i.id})">
          Responding
        </button>
        <button class="btn btn-success" 
          onclick="resolve(${i.id})">
          Resolved
        </button>
      </div>
    </div>
  `).join('')
}

// ================================
// INCIDENT LOG TABLE
// ================================
function updateLogTable(incidents) {
  const tbody = document.getElementById('log-table-body')

  let filtered = incidents
  if (currentFilter !== 'all') {
    filtered = incidents.filter(
      i => i.status === currentFilter
    )
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" 
            style="text-align:center; 
                   padding:20px; 
                   color:#9E9E9E;">
          No incidents found
        </td>
      </tr>`
    return
  }

  tbody.innerHTML = filtered.map(i => `
    <tr class="${i.status === 'resolved' 
      ? 'resolved' : ''}">
      <td><strong>${i.room_number}</strong></td>
      <td>${i.alert_type}</td>
      <td>${i.assigned_staff_role}</td>
      <td>${new Date(i.timestamp)
        .toLocaleTimeString()}</td>
      <td>
        <span class="badge badge-${i.status}">
          ${i.status}
        </span>
      </td>
      <td>
        ${i.status !== 'resolved' ? `
          <button class="btn btn-success" 
            style="width:auto; padding:6px 10px; 
                   font-size:11px; margin:0;"
            onclick="resolve(${i.id})">
            Resolve
          </button>` : '—'}
      </td>
    </tr>
  `).join('')
}

// ================================
// ANALYTICS
// ================================
function updateAnalytics(incidents) {
  document.getElementById('ana-total').textContent =
    incidents.length

  // Floor counts
  const floor1 = incidents.filter(
    i => i.room_number.startsWith('1')
  ).length
  const floor2 = incidents.filter(
    i => i.room_number.startsWith('2')
  ).length
  const floor3 = incidents.filter(
    i => i.room_number.startsWith('3')
  ).length

  const max = Math.max(floor1, floor2, floor3, 1)

  document.getElementById('count-floor1').textContent =
    floor1
  document.getElementById('count-floor2').textContent =
    floor2
  document.getElementById('count-floor3').textContent =
    floor3

  document.getElementById('bar-floor1').style.width =
    `${(floor1/max)*100}%`
  document.getElementById('bar-floor2').style.width =
    `${(floor2/max)*100}%`
  document.getElementById('bar-floor3').style.width =
    `${(floor3/max)*100}%`

  // Type breakdown
  const types = {}
  incidents.forEach(i => {
    types[i.alert_type] = 
      (types[i.alert_type] || 0) + 1
  })

  const breakdown = 
    document.getElementById('type-breakdown')

  if (Object.keys(types).length === 0) {
    breakdown.innerHTML = 
      '<div class="empty-state">No data yet</div>'
    return
  }

  breakdown.innerHTML = Object.entries(types)
    .map(([type, count]) => `
      <div class="type-row">
        <span>${type.toUpperCase()}</span>
        <strong>${count}</strong>
      </div>
    `).join('')
}

// ================================
// ACTIONS
// ================================
async function respond(id) {
  await updateIncidentSupabase(id, 'responding')
  loadStaffData()
}

async function resolve(id) {
  await updateIncidentSupabase(id, 'resolved')
  loadStaffData()
}

// ================================
// FILTER
// ================================
function filterLog(filter, btn) {
  currentFilter = filter
  document.querySelectorAll('.filter-btn')
    .forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  updateLogTable(allIncidents)
}

// ================================
// MAIN DATA LOADER
// ================================
async function loadData() {
  const incidents = await getLatestIncidents()
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
// START POLLING
// ================================
