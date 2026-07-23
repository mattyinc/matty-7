const REDIRECT_URI = 'https://mattyinc.github.io/matty-7/auth/strava-callback.html'

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const clientId = process.env.STRAVA_CLIENT_ID
  const redirectUri = process.env.STRAVA_REDIRECT_URI || REDIRECT_URI
  if (!clientId) {
    return res.status(503).json({ error: 'STRAVA_CLIENT_ID is not configured in Vercel' })
  }

  const state = String(req.query.state || '')
  if (!/^[a-z0-9]{8}$/i.test(state)) {
    return res.status(400).json({ error: 'Invalid OAuth state' })
  }

  const url = new URL('https://www.strava.com/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope', 'activity:read_all')
  url.searchParams.set('state', state)
  return res.redirect(302, url.toString())
}
