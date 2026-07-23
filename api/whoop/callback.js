// Exchanges a one-time WHOOP authorization code for access and refresh tokens.
// The client secret must only exist in Vercel environment variables.

const ALLOWED_ORIGINS = new Set([
  'https://mattyinc.github.io',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
])

function setCors(req, res) {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
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
    client_id: Boolean(process.env.WHOOP_CLIENT_ID),
    client_secret: Boolean(process.env.WHOOP_CLIENT_SECRET),
    redirect_uri: Boolean(process.env.WHOOP_REDIRECT_URI)
  }

  // Safe deployment diagnostic: reports presence, never values.
  if (req.method === 'GET') {
    return res.status(200).json({ ok: Object.values(configured).every(Boolean), configured })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!Object.values(configured).every(Boolean)) {
    return res.status(503).json({
      error: 'Whoop OAuth is not configured on the server',
      configured
    })
  }

  const { code, redirect_uri } = getBody(req)
  if (!code) return res.status(400).json({ error: 'Missing authorization code' })
  if (redirect_uri !== process.env.WHOOP_REDIRECT_URI) {
    return res.status(400).json({ error: 'Redirect URI does not match the server configuration' })
  }

  try {
    const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
        redirect_uri: process.env.WHOOP_REDIRECT_URI
      })
    })

    const data = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || !data.access_token) {
      return res.status(tokenRes.status || 502).json({
        error: data.error_description || data.error || 'Whoop rejected the authorization code'
      })
    }

    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_in: data.expires_in || 3600,
      scope: data.scope || ''
    })
  } catch (error) {
    return res.status(502).json({ error: 'Unable to reach Whoop token service' })
  }
}
