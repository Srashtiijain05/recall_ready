import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcrypt';
import { User } from '@/models/User';
import connectToDatabase from '@/lib/mongodb/connect';
import { signToken } from '@/lib/auth';
import { createOrEnsureCreditBalance } from '@/lib/credits';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, name } = body;

        // Validate input
        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Email, password, and name are required' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Connect to database
        await connectToDatabase();

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return NextResponse.json(
                { error: 'User already exists' },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await hash(password, 10);

        // Create new user
        const newUser = new User({
            email: email.toLowerCase(),
            name,
            password: hashedPassword,
        });

        await newUser.save();
        await createOrEnsureCreditBalance(newUser._id.toString());

        // Create JWT token
        const token = await signToken({
            userId: newUser._id.toString(),
            email: newUser.email,
            name: newUser.name,
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
                message: 'User created successfully',
                user: {
                    id: newUser._id,
                    email: newUser.email,
                    name: newUser.name,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: 'An error occurred during signup' },
            { status: 500 }
        );
    }
}
