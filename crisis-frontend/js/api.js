const BASE_URL = 'http://localhost:3000'

// Post an alert to the backend
async function postAlert(room_number, alert_type) {
  try {
    const response = await fetch(`${BASE_URL}/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_number, alert_type })
    })
    return await response.json()
  } catch (error) {
    console.error('postAlert failed:', error)
  }
}

// Get latest 5 incidents
async function getLatestIncidents() {
  try {
    const response = await fetch(`${BASE_URL}/incidents/latest`)
    return await response.json()
  } catch (error) {
    console.error('getLatestIncidents failed:', error)
  }
}

// Update incident status
async function updateIncidentStatus(id, status) {
  try {
    const response = await fetch(`${BASE_URL}/incidents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    return await response.json()
  } catch (error) {
    console.error('updateIncidentStatus failed:', error)
  }
}
