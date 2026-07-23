const ALLOWED_ORIGINS = new Set([
  'https://mattyinc.github.io',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
])

function setCors(req, res) {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

function getBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return req.body
}

module.exports = async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token, after } = getBody(req)
  if (!token) return res.status(400).json({ error: 'No Strava token provided' })

  const earliest = Number(after) || Math.floor(Date.now() / 1000) - (90 * 86400)
  const url = new URL('https://www.strava.com/api/v3/athlete/activities')
  url.searchParams.set('after', String(earliest))
  url.searchParams.set('page', '1')
  url.searchParams.set('per_page', '100')

  try {
    const activityRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })
    const data = await activityRes.json().catch(() => ({}))
    if (!activityRes.ok) {
      return res.status(activityRes.status).json({
        error: data.message || 'Strava activity request failed',
        errors: data.errors || []
      })
    }
    const activities = Array.isArray(data) ? data : []
    return res.status(200).json({
      activities: activities.filter(activity =>
        ['Run', 'TrailRun', 'VirtualRun'].includes(activity.sport_type || activity.type)
      )
    })
  } catch {
    return res.status(502).json({ error: 'Unable to reach Strava activity service' })
  }
}
