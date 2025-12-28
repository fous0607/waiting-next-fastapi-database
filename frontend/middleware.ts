
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that do not require authentication
const PUBLIC_ROUTES = [
    '/',
    '/login',
    '/mobile',
    '/reception-login',
    '/entry', // QR Code Entry
    '/api/public' // Public API
]
]

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Check if the current route is public
    const isPublicRoute = PUBLIC_ROUTES.some(route =>
        pathname.startsWith(route) || pathname === '/favicon.ico'
    )

    // Get token from cookies
    const token = request.cookies.get('access_token')?.value

    if (pathname.includes('superadmin') || pathname.includes('login')) {
        console.log(`[Middleware] Path: ${pathname}, Token exists: ${!!token}`);
    }

    // If route is NOT public and NO token is present, redirect to login
    if (!isPublicRoute && !token) {
        const loginUrl = new URL('/login', request.url)
        // Optional: preserve the intended destination to redirect back after login
        // loginUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // If user is already logged in and tries to visit login page, redirect to dashboard
    if (pathname === '/login' && token) {
        return NextResponse.redirect(new URL('/', request.url))
    }

    return NextResponse.next()
}

// Config to match all paths except static files and api routes
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - static (legacy static files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|static|favicon.ico).*)',
    ],
}
