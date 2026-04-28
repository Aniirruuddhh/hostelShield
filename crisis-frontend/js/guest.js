let sosPressed = false

// Highlight guest room on map
document.addEventListener('DOMContentLoaded', () => {
  const cells = document.querySelectorAll(
    '#guest-map .room-cell'
  )
  // Room 302 is index 1 on floor 3
  cells[1].classList.add('you')
})

// Handle SOS button press
async function handleSOS() {
  if (sosPressed) return
  sosPressed = true

  const btn = document.getElementById('sos-btn')
  const statusText = document.getElementById(
    'status-text'
  )

  btn.disabled = true
  btn.innerHTML = 'HELP IS ON<br/>THE WAY'
  statusText.className = 'status-alert'
  statusText.textContent = 
    '🚨 Alert Sent — Help Coming'

  // Use Supabase instead of local backend
  const result = await postAlertSupabase(
    currentHotelId,
    '302',
    'panic'
  )
  console.log('Alert sent to Supabase:', result)

  // Also trigger SMS via backend
  try {
    await fetch('http://localhost:3000/send-alert', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        room_number: '302',
        alert_type: 'panic'
      })
    })
  } catch(e) {
    console.log('SMS endpoint unavailable:', e)
  }
}

// Handle I Am Safe button
async function handleSafe() {
  const statusText = document.getElementById(
    'status-text'
  )
  statusText.className = 'status-safe'
  statusText.textContent = '✅ Marked Safe'

  await postAlertSupabase(
    currentHotelId,
    '302',
    'safe'
  )
}
