import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Optimistic edge check only. `authConfig.callbacks.authorized` redirects
// unauthenticated visitors away from /admin/* to the login page. Real
// authorization is enforced server-side in every admin route and action.
export const { auth: proxy } = NextAuth(authConfig);

export const config = {
  matcher: ["/admin/:path*"],
};
