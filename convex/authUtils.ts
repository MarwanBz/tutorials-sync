import { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Checks that the current user is authenticated AND is an admin.
 * Admin emails are configured via the ADMIN_EMAILS environment variable
 * (comma-separated list of emails).
 *
 * Throws an error if:
 * - The user is not authenticated
 * - The user's email is not in the admin list
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Authentication required. Please sign in.");
  }

  const adminEmailsEnv = process.env.ADMIN_EMAILS;
  if (!adminEmailsEnv) {
    throw new Error(
      "ADMIN_EMAILS environment variable is not configured. " +
        "Set it in the Convex dashboard to enable admin access.",
    );
  }

  const adminEmails = adminEmailsEnv
    .split(",")
    .map((email) => email.trim().toLowerCase());

  const userEmail = identity.email?.toLowerCase();

  if (!userEmail || !adminEmails.includes(userEmail)) {
    throw new Error(
      "Unauthorized. You do not have admin access to this dashboard.",
    );
  }
}

/**
 * Checks that the current user is authenticated.
 * Returns the UserIdentity object with tokenIdentifier, email, name, etc.
 *
 * Throws an error if the user is not authenticated.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Authentication required. Please sign in.");
  }

  return identity;
}

/**
 * Checks that the current user either owns the resource OR is an admin.
 * Used for update/delete operations on user-owned content.
 *
 * - If the user's email is in ADMIN_EMAILS, they can access anything.
 * - Otherwise, the user's tokenIdentifier must match the resource's ownerId.
 * - Resources with no ownerId (e.g., synced content) are admin-only.
 *
 * Throws an error if neither condition is met.
 */
export async function requireOwnerOrAdmin(
  ctx: QueryCtx | MutationCtx,
  ownerId: string | undefined,
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Authentication required. Please sign in.");
  }

  // Check if admin
  const adminEmailsEnv = process.env.ADMIN_EMAILS;
  if (adminEmailsEnv) {
    const adminEmails = adminEmailsEnv
      .split(",")
      .map((e) => e.trim().toLowerCase());
    if (
      identity.email &&
      adminEmails.includes(identity.email.toLowerCase())
    ) {
      return; // admin can do anything
    }
  }

  // Check ownership
  if (!ownerId || identity.tokenIdentifier !== ownerId) {
    throw new Error(
      "Unauthorized. You can only modify your own content.",
    );
  }
}
