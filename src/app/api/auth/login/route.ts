import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import connectDB from "../../../../../database/db";
import User from "../../../../../models/User";
import { logAudit } from "@/lib/audit";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_development";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Connect to MongoDB Atlas
    await connectDB();

    // Search for the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Verify the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Disabled accounts cannot sign in.
    if (user.active === false) {
      return NextResponse.json(
        { error: "This account has been disabled. Contact the ARAL Coordinator." },
        { status: 403 }
      );
    }

    // Create JWT payload
    const payload = {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      name: user.name,
      specialization: user.specialization || 'all-subjects',
    };

    // Sign the JWT token using jose
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    // Create a 200 JSON response
    const response = NextResponse.json(
      { success: true, role: user.role, name: user.name, specialization: user.specialization || 'all-subjects' },
      { status: 200 }
    );

    // Set HTTP-Only secure cookie named auth_token
    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    await logAudit({
      actorId: user._id.toString(),
      actorName: user.name || user.username,
      role: user.role,
      action: 'login',
    });

    return response;
  } catch (error: any) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
