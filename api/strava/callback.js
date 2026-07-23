const ALLOWED_ORIGINS = new Set([
  'https://mattyinc.github.io',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
])
const REDIRECT_URI = 'https://mattyinc.github.io/matty-7/auth/strava-callback.html'

function setCors(req, res) {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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

  const configured = {
    client_id: Boolean(process.env.STRAVA_CLIENT_ID),
    client_secret: Boolean(process.env.STRAVA_CLIENT_SECRET),
    redirect_uri: Boolean(process.env.STRAVA_REDIRECT_URI)
  }
  if (req.method === 'GET') {
    return res.status(200).json({ ok: configured.client_id && configured.client_secret, configured })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!configured.client_id || !configured.client_secret) {
    return res.status(503).json({ error: 'Strava OAuth is not configured on the server', configured })
  }

  const body = getBody(req)
  const action = body.action || 'exchange'
  const params = {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    grant_type: action === 'refresh' ? 'refresh_token' : 'authorization_code'
  }

  if (action === 'refresh') {
    if (!body.refresh_token) return res.status(400).json({ error: 'Missing refresh token' })
    params.refresh_token = body.refresh_token
  } else {
    if (!body.code) return res.status(400).json({ error: 'Missing authorization code' })
    if (body.redirect_uri !== (process.env.STRAVA_REDIRECT_URI || REDIRECT_URI)) {
      return res.status(400).json({ error: 'Redirect URI does not match the server configuration' })
    }
    params.code = body.code
  }

  try {
    const tokenRes = await fetch('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams(params)
    })
    const data = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || !data.access_token) {
      return res.status(tokenRes.status || 502).json({
        error: data.message || data.error || 'Strava rejected the token request',
        errors: data.errors || []
      })
    }
    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      expires_in: data.expires_in,
      athlete_id: data.athlete?.id || null,
      scope: body.scope || ''
    })
  } catch {
    return res.status(502).json({ error: 'Unable to reach Strava token service' })
  }
}
