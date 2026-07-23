// /api/whoop/sync.js
// Proxies Whoop API calls server-side to bypass CORS
// Called from the browser with the user's access token

const ALLOWED_ORIGINS = new Set([
  'https://mattyinc.github.io',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
])

function getBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return req.body
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = getBody(req)
  const { token } = body
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
      recRes.json().catch(() => ({})),
      sleepRes.json().catch(() => ({})),
      workoutRes.json().catch(() => ({}))
    ])

    const failures = [
      ['recovery', recRes, recovery],
      ['sleep', sleepRes, sleep],
      ['workouts', workoutRes, workouts]
    ].filter(([, response]) => !response.ok)

    if (failures.length) {
      const status = failures.some(([, response]) => response.status === 401) ? 401
        : failures.some(([, response]) => response.status === 429) ? 429
        : 502
      return res.status(status).json({
        error: 'Whoop data request failed',
        failures: failures.map(([resource, response, payload]) => ({
          resource,
          status: response.status,
          message: payload.error_description || payload.error || response.statusText
        }))
      })
    }

    return res.status(200).json({ recovery, sleep, workouts })
  } catch (err) {
    return res.status(502).json({ error: 'Unable to reach Whoop data service' })
  }
}
