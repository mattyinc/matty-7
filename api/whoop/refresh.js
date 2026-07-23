// /api/whoop/refresh.js
// Exchanges a refresh token for a new access token

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
  const { refresh_token } = body
  if (!refresh_token) return res.status(400).json({ error: 'No refresh_token' })
  if (!process.env.WHOOP_CLIENT_ID || !process.env.WHOOP_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Whoop OAuth is not configured on the server' })
  }

  try {
    const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
        scope: 'offline'
      })
    })

    const data = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || !data.access_token) {
      return res.status(tokenRes.status || 401).json({
        error: data.error_description || data.error || 'Refresh failed'
      })
    }

    res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refresh_token,
      expires_in: data.expires_in
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
