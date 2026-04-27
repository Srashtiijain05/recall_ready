import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import connectToDatabase from '@/lib/mongodb/connect';
import { User } from '@/models/User';
import { signToken } from '@/lib/auth';
import { createOrEnsureCreditBalance } from '@/lib/credits';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=unauthorized', req.url));
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2',
    });

    const userInfo = await oauth2.userinfo.get();
    
    if (!userInfo.data.email || !userInfo.data.id) {
      return NextResponse.redirect(new URL('/?error=no_email_or_id', req.url));
    }

    await connectToDatabase();

    let user = await User.findOne({ email: userInfo.data.email });
    
    if (!user) {
      user = await User.create({
        googleId: String(userInfo.data.id),
        email: userInfo.data.email,
        name: userInfo.data.name || 'User',
        picture: userInfo.data.picture || '',
      });
    }

    await createOrEnsureCreditBalance(user._id.toString());

    const payload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      picture: user.picture
    };

    const token = await signToken(payload);
    
    const response = NextResponse.redirect(new URL('/projects', req.url));
    
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Google Auth Error:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', req.url));
  }
}
