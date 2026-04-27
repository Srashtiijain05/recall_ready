import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development';
const protectedRoutes = ['/projects', '/settings', '/docs', '/(dashboard)'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if the route is protected
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    if (isProtectedRoute) {
        const token = request.cookies.get('auth_token')?.value;

        if (!token) {
            // Redirect to home page without auth token
            return NextResponse.redirect(new URL('/', request.url));
        }

        try {
            await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
            // Token is valid, allow the request to proceed
            return NextResponse.next();
        } catch (error) {
            // Token is invalid or expired
            console.error('Token verification failed:', error);
            const response = NextResponse.redirect(new URL('/', request.url));
            response.cookies.set('auth_token', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 0,
                path: '/',
            });
            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
