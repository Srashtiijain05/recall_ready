import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcrypt';
import { User } from '@/models/User';
import connectToDatabase from '@/lib/mongodb/connect';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        // Validate input
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        // Connect to database
        await connectToDatabase();

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Check if user has password (email/password auth enabled)
        if (!user.password) {
            return NextResponse.json(
                { error: 'This account is registered with Google. Please sign in with Google.' },
                { status: 400 }
            );
        }

        // Compare password
        const isPasswordValid = await compare(password, user.password);
        if (!isPasswordValid) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Create JWT token
        const token = await signToken({
            userId: user._id.toString(),
            email: user.email,
            name: user.name,
        });

        // Set cookie
        const cookieStore = await cookies();
        cookieStore.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return NextResponse.json(
            {
                message: 'Signed in successfully',
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Signin error:', error);
        return NextResponse.json(
            { error: 'An error occurred during signin' },
            { status: 500 }
        );
    }
}
