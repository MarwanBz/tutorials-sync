import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Returns the current authenticated user's tokenIdentifier.
 * Used by the frontend to scope dashboard queries to the current user's content.
 * Returns null if not authenticated.
 */
export const getMyTokenIdentifier = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.tokenIdentifier ?? null;
  },
});
