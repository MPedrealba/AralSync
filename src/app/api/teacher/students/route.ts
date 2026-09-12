import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import connectDB from '../../../../../database/db';
import User from '../../../../../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    if (payload.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden: Teachers only' }, { status: 403 });
    }

    await connectDB();

    // Fetch all student users (only _id and name)
    const students = await User.find({ role: 'student' }).select('_id name').sort({ name: 1 });

    return NextResponse.json({ success: true, data: students });
  } catch (error) {
    console.error('Students API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
