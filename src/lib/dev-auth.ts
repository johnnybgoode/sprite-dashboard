import { auth } from "@/auth";
import type { Session } from "next-auth";

const DEV_SESSION: Session = {
  user: {
    id: "dev",
    name: "Dev User",
    email: "dev@localhost",
    image: undefined,
  },
  expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
};

export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (session) return session;

  if (process.env.NODE_ENV === "development") {
    return DEV_SESSION;
  }

  throw new Error("Unauthorized");
}
