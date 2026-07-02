import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'fallback-secret-change-in-production'
)

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/login')) {
    if (accessToken) {
      try {
        const { payload } = await jwtVerify(accessToken, secret)
        if (payload.type === 'access') return NextResponse.redirect(new URL('/', request.url))
      } catch {}
    }
    if (refreshToken) {
      try {
        const { payload } = await jwtVerify(refreshToken, secret)
        if (payload.type === 'refresh') return NextResponse.redirect(new URL('/', request.url))
      } catch {}
    }
    return NextResponse.next()
  }

  if (accessToken) {
    try {
      const { payload } = await jwtVerify(accessToken, secret)
      if (payload.type === 'access') return NextResponse.next()
    } catch {}
  }

  if (refreshToken) {
    try {
      const { payload } = await jwtVerify(refreshToken, secret)
      if (payload.type !== 'refresh') return NextResponse.redirect(new URL('/login', request.url))

      const newAccessToken = await new SignJWT({ username: payload.username, type: 'access' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('5m')
        .sign(secret)

      const response = NextResponse.next()
      response.cookies.set('access_token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 5,
      })
      return response
    } catch {}
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
