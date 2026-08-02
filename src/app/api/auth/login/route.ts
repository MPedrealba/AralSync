import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* ── Mongoose user schema (mirrors seedUsers.js) ── */
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  role: {
    type: String,
    enum: ["student", "teacher", "principal"],
    required: true,
  },
}, { timestamps: true });

function getUserModel() {
  return mongoose.models.User || mongoose.model("User", userSchema);
}

/* ── Ensure single connection ── */
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in .env");
  await mongoose.connect(uri);
}

/* ── POST /api/auth/login ── */
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    await connectDB();
    const User = getUserModel();

    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      message: "Login successful",
      role: user.role,
      fullName: user.fullName,
      username: user.username,
    });
  } catch (err: unknown) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
