import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";

const providers: Provider[] = [GitHub];

if (process.env.NODE_ENV === "development") {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev User",
      credentials: {},
      authorize() {
        return { id: "dev", name: "Dev User", email: "dev@localhost" };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    authorized({ auth }) {
      if (process.env.NODE_ENV === "development") return true;
      return !!auth?.user;
    },
  },
});
