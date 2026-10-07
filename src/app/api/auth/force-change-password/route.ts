import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import connectDB from "../../../../../database/db";
import User from "../../../../../models/User";
import { requireAuth, authErrorResponse, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_development";

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req, []);
    await connectDB();

    const { currentPassword, newPassword, confirmPassword } = await req.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "All password fields are required." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirmation password do not match." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const user = await User.findById(authUser.id);
    if (!user) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    // Verify current password with bcrypt
    const isCurrentMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentMatch) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 }
      );
    }

    // Cannot be identical to current/temporary default password
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password cannot be identical to your temporary default password." },
        { status: 400 }
      );
    }

    const isSameAsHashed = await bcrypt.compare(newPassword, user.password);
    if (isSameAsHashed) {
      return NextResponse.json(
        { error: "New password cannot be identical to your current password." },
        { status: 400 }
      );
    }

    // Hash new password and update user
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.mustChangePassword = false;
    await user.save();

    // Create refreshed JWT payload with mustChangePassword = false
    const payload = {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      name: user.name,
      specialization: user.specialization || "all-subjects",
      mustChangePassword: false,
    };

    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    const response = NextResponse.json(
      {
        success: true,
        role: user.role,
        message: "Password updated successfully.",
      },
      { status: 200 }
    );

    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    await logAudit({
      actorId: user._id.toString(),
      actorName: user.name || user.username,
      role: user.role,
      action: "change_password",
    });

    return response;
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Force Change Password Error:", error);
    return NextResponse.json(
      { error: "Failed to update password. Please try again." },
      { status: 500 }
    );
  }
}
