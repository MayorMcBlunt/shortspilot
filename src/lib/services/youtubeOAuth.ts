import crypto from 'crypto'

const YOUTUBE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YOUTUBE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
]

function getYoutubeClientConfig() {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI ?? `${appUrl}/api/publish/accounts/youtube/callback`

  if (!clientId || !clientSecret) {
    throw new Error('YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET are required')
  }

  return { clientId, clientSecret, redirectUri }
}

function toBase64Url(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const verifier = toBase64Url(crypto.randomBytes(32))
  const challenge = toBase64Url(crypto.createHash('sha256').update(verifier).digest())
  return { codeVerifier: verifier, codeChallenge: challenge }
}

export function buildYoutubeAuthUrl(state: string, codeChallenge: string): string {
  const { clientId, redirectUri } = getYoutubeClientConfig()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: YOUTUBE_SCOPES.join(' '),
    include_granted_scopes: 'true',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return `${YOUTUBE_AUTH_BASE}?${params.toString()}`
}

type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: string
}

export async function exchangeYoutubeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = getYoutubeClientConfig()

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  })

  const res = await fetch(YOUTUBE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YouTube token exchange failed (${res.status}): ${text}`)
  }

  return (await res.json()) as TokenResponse
}

export async function refreshYoutubeToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getYoutubeClientConfig()

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })

  const res = await fetch(YOUTUBE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YouTube token refresh failed (${res.status}): ${text}`)
  }

  return (await res.json()) as TokenResponse
}

export async function getYoutubeChannel(accessToken: string): Promise<{ channelId: string; title: string }> {
  const params = new URLSearchParams({ part: 'snippet', mine: 'true' })

  const res = await fetch(`${YOUTUBE_API_BASE}/channels?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to load YouTube channel (${res.status}): ${text}`)
  }

  const json = await res.json() as {
    items?: Array<{ id: string; snippet?: { title?: string } }>
  }

  const channel = json.items?.[0]
  if (!channel?.id) {
    throw new Error('No YouTube channel found for this account')
  }

  return {
    channelId: channel.id,
    title: channel.snippet?.title ?? 'YouTube Channel',
  }
}

export async function revokeYoutubeToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token })
  await fetch(YOUTUBE_REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
}

