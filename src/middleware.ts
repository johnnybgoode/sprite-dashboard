export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/sprites/:path*", "/api/sprites/:path*"],
};
