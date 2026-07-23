const crypto = require('crypto')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const IMPORT_TOKEN = process.env.APPLE_SHORTCUT_TOKEN

function jsonBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return req.body
}

function asNumber(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const match = String(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function rounded(value) {
  const number = asNumber(value)
  return number === null ? null : Math.round(number)
}

function getDistanceKm(workout) {
  const km = asNumber(workout.distance_km)
  if (km !== null) return km
  const meters = asNumber(workout.distance_meters)
  if (meters !== null) return meters / 1000
  const miles = asNumber(workout.distance_miles)
  if (miles !== null) return miles * 1.609344
  return null
}

function getDurationSeconds(workout) {
  const seconds = asNumber(workout.duration_seconds)
  if (seconds !== null) return seconds
  const minutes = asNumber(workout.duration_minutes)
  if (minutes !== null) return minutes * 60
  return null
}

function normalizeSessionType(value) {
  const allowed = new Set(['easy', 'tempo', 'interval', 'long', 'race'])
  const normalized = String(value || '').trim().toLowerCase()
  return allowed.has(normalized) ? normalized : 'easy'
}

function normalizeWorkout(input) {
  const workout = input.workout && typeof input.workout === 'object' ? input.workout : input
  const start = workout.start_date || workout.start || workout.date
  const parsedStart = start ? new Date(start) : null
  const distanceKm = getDistanceKm(workout)
  const durationSeconds = getDurationSeconds(workout)

  if (!parsedStart || Number.isNaN(parsedStart.getTime())) {
    throw new Error('start_date must be an ISO 8601 date')
  }
  if (distanceKm === null || distanceKm <= 0 || distanceKm > 500) {
    throw new Error('distance_km must be greater than 0')
  }
  if (durationSeconds === null || durationSeconds <= 0 || durationSeconds > 172800) {
    throw new Error('duration_seconds must be greater than 0')
  }

  const workoutType = String(workout.workout_type || workout.type || 'Running').toLowerCase()
  if (!workoutType.includes('run')) throw new Error('Only running workouts are supported')

  const date = workout.local_date || String(start).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('local_date must use YYYY-MM-DD')
  }

  const appleWorkoutId = String(
    workout.apple_workout_id ||
    workout.workout_id ||
    workout.uuid ||
    crypto.createHash('sha256')
      .update(`${parsedStart.toISOString()}|${Math.round(durationSeconds)}|${distanceKm.toFixed(4)}`)
      .digest('hex')
      .slice(0, 32)
  )

  return {
    apple_workout_id: appleWorkoutId,
    source: 'apple_fitness',
    date,
    session_type: normalizeSessionType(workout.session_type),
    distance_km: Number(distanceKm.toFixed(2)),
    duration_seconds: Math.round(durationSeconds),
    avg_pace_sec_per_km: Math.round(durationSeconds / distanceKm),
    avg_hr: rounded(workout.avg_hr || workout.average_heart_rate),
    max_hr: rounded(workout.max_hr || workout.maximum_heart_rate),
    avg_cadence: rounded(workout.avg_cadence || workout.average_cadence),
    avg_power: rounded(workout.avg_power || workout.average_power),
    calories: rounded(workout.calories || workout.active_energy_kcal),
    elevation_gain: rounded(workout.elevation_gain || workout.elevation_gain_m),
    notes: String(workout.name || 'Imported from Apple Fitness').slice(0, 500)
  }
}

function bearerToken(req) {
  const authorization = req.headers.authorization || ''
  if (authorization.startsWith('Bearer ')) return authorization.slice(7).trim()
  return String(req.headers['x-apple-import-token'] || '').trim()
}

async function saveWorkout(run) {
  const endpoint = `${SUPABASE_URL}/rest/v1/runs?on_conflict=apple_workout_id`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(run)
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = payload.message || payload.details || `Supabase returned ${response.status}`
    throw new Error(detail)
  }
  return Array.isArray(payload) ? payload[0] : payload
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Allow', 'POST')
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  if (!IMPORT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ ok: false, error: 'Apple Fitness import is not configured' })
  }
  const suppliedToken = bearerToken(req)
  const expected = Buffer.from(IMPORT_TOKEN)
  const supplied = Buffer.from(suppliedToken)
  if (
    expected.length !== supplied.length ||
    !crypto.timingSafeEqual(expected, supplied)
  ) {
    return res.status(401).json({ ok: false, error: 'Invalid import token' })
  }

  try {
    const run = normalizeWorkout(jsonBody(req))
    const saved = await saveWorkout(run)
    return res.status(200).json({
      ok: true,
      message: 'Workout imported',
      run: {
        id: saved.id,
        date: saved.date,
        distance_km: saved.distance_km,
        duration_seconds: saved.duration_seconds
      }
    })
  } catch (error) {
    const validationError = /must be|Only running/.test(error.message)
    return res.status(validationError ? 400 : 502).json({
      ok: false,
      error: validationError ? error.message : 'Could not save workout',
      detail: validationError ? undefined : error.message
    })
  }
}

module.exports = handler
module.exports._test = { asNumber, getDistanceKm, getDurationSeconds, normalizeWorkout }
