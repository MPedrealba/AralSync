import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 * Clears the HttpOnly auth_token cookie so the user is signed out.
 * (The cookie is HttpOnly, so it cannot be removed from the browser via
 *  document.cookie — it must be cleared server-side.)
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: "auth_token",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return response;
}
