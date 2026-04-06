import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }
  return (auth as any)(req);
}

export const config = {
  matcher: ["/sprites/:path*", "/api/sprites/:path*"],
};
