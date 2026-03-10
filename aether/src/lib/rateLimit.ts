// Simple in-memory rate limiter
// Limits: 20 requests per minute per IP, 100 per hour per IP

type Entry = { count: number; windowStart: number }

const minuteMap = new Map<string, Entry>()
const hourMap = new Map<string, Entry>()

const MINUTE_LIMIT = 20
const HOUR_LIMIT = 100
const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000

function check(map: Map<string, Entry>, ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = map.get(ip)

  if (!entry || now - entry.windowStart > windowMs) {
    map.set(ip, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

export function rateLimit(ip: string): { allowed: boolean; reason?: string } {
  if (!check(minuteMap, ip, MINUTE_LIMIT, MINUTE_MS)) {
    return { allowed: false, reason: `Rate limit exceeded: max ${MINUTE_LIMIT} requests per minute.` }
  }
  if (!check(hourMap, ip, HOUR_LIMIT, HOUR_MS)) {
    return { allowed: false, reason: `Rate limit exceeded: max ${HOUR_LIMIT} requests per hour.` }
  }
  return { allowed: true }
}
