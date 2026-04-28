// ================================
// SUPABASE CONFIGURATION
// ================================
const SUPABASE_URL = 
  'https://snuqpvvmuldpgefdlwmh.supabase.co'
const SUPABASE_KEY = 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNudXFwdnZtdWxkcGdlZmRsd21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwOTg5MDUsImV4cCI6MjA5MjY3NDkwNX0.h_rdLy1QxyjBJWutBp3jDpq-KwIP_SQADvlq6ExZ1ps'

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`
}

// ================================
// HOTELS
// ================================

// Get all hotels
async function getHotels() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/hotels?select=*&order=name.asc`,
      { headers: HEADERS }
    )
    const data = await res.json()
    if (Array.isArray(data)) return data
    console.error('Hotels response:', data)
    return []
  } catch (error) {
    console.error('getHotels failed:', error)
    return []
  }
}

// ================================
// INCIDENTS
// ================================

// Post new alert
async function postAlertSupabase(
  hotel_id,
  room_number,
  alert_type
) {
  // Role routing logic
  let assigned_staff_role = 'security'
  if (alert_type === 'medical') {
    assigned_staff_role = 'frontdesk'
  } else if (alert_type === 'fire') {
    assigned_staff_role = 'all'
  } else if (
    alert_type === 'panic' ||
    alert_type === 'motion_anomaly' ||
    alert_type === 'glass_break'
  ) {
    assigned_staff_role = 'security'
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/incidents`,
      {
        method: 'POST',
        headers: {
          ...HEADERS,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          hotel_id,
          room_number,
          alert_type,
          assigned_staff_role,
          status: 'active'
        })
      }
    )
    const data = await res.json()
    console.log('Alert posted to Supabase:', data)
    return data[0]
  } catch (error) {
    console.error('postAlert failed:', error)
  }
}

// Get latest incidents for a hotel
async function getIncidentsSupabase(hotel_id) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/incidents` +
      `?hotel_id=eq.${hotel_id}` +
      `&order=timestamp.desc&limit=10`,
      { headers: HEADERS }
    )
    return await res.json()
  } catch (error) {
    console.error('getIncidents failed:', error)
    return []
  }
}

// Update incident status
async function updateIncidentSupabase(id, status) {
  try {
    const body = { status }
    if (status === 'resolved') {
      body.resolved_at = new Date().toISOString()
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/incidents` +
      `?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          ...HEADERS,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(body)
      }
    )
    return await res.json()
  } catch (error) {
    console.error('updateIncident failed:', error)
  }
}

// Get incidents across ALL hotels
// (for decentralized view)
async function getAllIncidents() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/incidents` +
      `?select=*,hotels(name,city)` +
      `&order=timestamp.desc&limit=20`,
      { headers: HEADERS }
    )
    return await res.json()
  } catch (error) {
    console.error('getAllIncidents failed:', error)
    return []
  }
}

// Get active incidents across ALL hotels
async function getActiveIncidents() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/incidents` +
      `?select=*,hotels(name,city)` +
      `&status=neq.resolved` +
      `&order=timestamp.desc`,
      { headers: HEADERS }
    )
    return await res.json()
  } catch (error) {
    console.error('getActiveIncidents failed:', error)
    return []
  }
}
