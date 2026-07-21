// /api/whoop/refresh.js
// Exchanges a refresh token for a new access token

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mattyinc.github.io')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { refresh_token } = req.body
  if (!refresh_token) return res.status(400).json({ error: 'No refresh_token' })

  try {
    const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
      })
    })

    const data = await tokenRes.json()
    if (!data.access_token) {
      return res.status(401).json({ error: data.error_description || 'Refresh failed' })
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
