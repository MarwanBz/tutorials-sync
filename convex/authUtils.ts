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
