import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

const GEMINI_MODEL = 'gemini-2.0-flash-exp-image-generation'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// Stricter limit for image generation - more expensive
const imageRateMap = new Map<string, { count: number; windowStart: number }>()
const IMAGE_LIMIT = 5
const IMAGE_WINDOW_MS = 60_000

function imageRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = imageRateMap.get(ip)
  if (!entry || now - entry.windowStart > IMAGE_WINDOW_MS) {
    imageRateMap.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= IMAGE_LIMIT) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  const { allowed, reason } = rateLimit(ip)
  if (!allowed) {
    return NextResponse.json({ error: reason }, { status: 429 })
  }

  if (!imageRateLimit(ip)) {
    return NextResponse.json(
      { error: `Image rate limit exceeded: max ${IMAGE_LIMIT} images per minute.` },
      { status: 429 }
    )
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await geminiRes.json()

    if (!geminiRes.ok) {
      const msg = data?.error?.message || 'Gemini API error.'
      return NextResponse.json({ error: msg }, { status: geminiRes.status })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to reach Gemini API.' }, { status: 502 })
  }
}
