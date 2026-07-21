// /api/whoop/sync.js
// Proxies Whoop API calls server-side to bypass CORS
// Called from the browser with the user's access token

module.exports = async function handler(req, res) {
  // Allow CORS from GitHub Pages
  res.setHeader('Access-Control-Allow-Origin', 'https://mattyinc.github.io')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'No token provided' })

  const WHOOP_BASE = 'https://api.prod.whoop.com/developer/v2'
  const headers = { 'Authorization': 'Bearer ' + token }

  try {
    const [recRes, sleepRes, workoutRes] = await Promise.all([
      fetch(`${WHOOP_BASE}/recovery?limit=14`, { headers }),
      fetch(`${WHOOP_BASE}/activity/sleep?limit=14`, { headers }),
      fetch(`${WHOOP_BASE}/activity/workout?limit=20`, { headers })
    ])

    const [recovery, sleep, workouts] = await Promise.all([
      recRes.ok ? recRes.json() : { records: [], error: recRes.status },
      sleepRes.ok ? sleepRes.json() : { records: [], error: sleepRes.status },
      workoutRes.ok ? workoutRes.json() : { records: [], error: workoutRes.status }
    ])

    res.status(200).json({ recovery, sleep, workouts })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
