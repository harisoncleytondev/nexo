import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'fallback-secret-change-in-production'
)

const ACCESS_EXP = '5m'
const REFRESH_EXP = '7d'

export async function createAccessToken(username: string) {
  return await new SignJWT({ username, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(ACCESS_EXP)
    .sign(secret)
}

export async function createRefreshToken(username: string) {
  return await new SignJWT({ username, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(REFRESH_EXP)
    .sign(secret)
}

export async function verifyAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload.type === 'access' ? (payload as { username: string }) : null
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload.type === 'refresh' ? (payload as { username: string }) : null
  } catch {
    return null
  }
}
