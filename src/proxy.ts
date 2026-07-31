import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export const proxy = auth((request) => {
  const { nextUrl } = request
  const isLoggedIn = !!request.auth
  const pathname = nextUrl.pathname

  if (!isLoggedIn && pathname === '/') {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  if (isLoggedIn && pathname === '/login') {
    return NextResponse.redirect(new URL('/', nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|workbox-*).*)'],
}
