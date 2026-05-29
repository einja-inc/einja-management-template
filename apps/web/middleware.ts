import { auth } from "@/lib/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Protected routes that require authentication
  const protectedRoutes = ["/dashboard", "/profile"];
  const isProtectedRoute = protectedRoutes.some((route) => nextUrl.pathname.startsWith(route));

  // Public routes that authenticated users shouldn't access
  const publicRoutes = ["/signin", "/signup"];
  const isPublicRoute = publicRoutes.some((route) => nextUrl.pathname.startsWith(route));

  // Redirect authenticated users away from public routes to dashboard
  if (isLoggedIn && isPublicRoute) {
    return Response.redirect(new URL("/dashboard", nextUrl));
  }

  // Redirect unauthenticated users to signin
  if (!isLoggedIn && isProtectedRoute) {
    return Response.redirect(new URL("/signin", nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
  runtime: "nodejs",
};
