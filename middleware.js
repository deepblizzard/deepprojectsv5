// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/onboarding(.*)',
  '/organisation(.*)',
  '/project(.*)',
  '/issue(.*)',
  '/sprint(.*)',
]);

// matches /organisation/<slug> and deeper paths, e.g. /organisation/my-org or /organisation/my-org/settings
const orgBySlugRoute = /^\/organisation\/[^\/]+(\/.*)?$/;

export default clerkMiddleware((auth, req) => {
  // use sessionClaims.o.id (Clerk's changed shape) to get the org id
  const { userId, sessionClaims } = auth();
  const orgId = sessionClaims?.o?.id;
  const pathname = req.nextUrl.pathname;

  // Unauthenticated user trying to access a protected route -> redirect to Clerk sign-in
  if (!userId && isProtectedRoute(req)) {
    return auth().redirectToSignIn();
  }

  // Signed-in user without an active org -> allow only certain routes, otherwise send to onboarding
  const allowedWithoutOrg = ['/', '/onboarding', '/project/create'];

  if (
    userId &&
    !orgId &&
    !allowedWithoutOrg.includes(pathname) &&
    !orgBySlugRoute.test(pathname)
  ) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
