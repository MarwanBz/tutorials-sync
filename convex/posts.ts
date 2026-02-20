import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Get all posts (published and unpublished) for dashboard admin view
export const listAll = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      _creationTime: v.number(),
      slug: v.string(),
      title: v.string(),
      description: v.string(),
      content: v.string(),
      date: v.string(),
      published: v.boolean(),
      tags: v.array(v.string()),
      readTime: v.optional(v.string()),
      image: v.optional(v.string()),
      excerpt: v.optional(v.string()),
      featured: v.optional(v.boolean()),
      featuredOrder: v.optional(v.number()),
      authorName: v.optional(v.string()),
      authorImage: v.optional(v.string()),
      source: v.optional(v.union(v.literal("dashboard"), v.literal("sync"))),
    }),
  ),
  handler: async (ctx) => {
    const posts = await ctx.db.query("posts").collect();

    // Sort by date descending
    const sortedPosts = posts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return sortedPosts.map((post) => ({
      _id: post._id,
      _creationTime: post._creationTime,
      slug: post.slug,
      title: post.title,
      description: post.description,
      content: post.content,
      date: post.date,
      published: post.published,
      tags: post.tags,
      readTime: post.readTime,
      image: post.image,
      excerpt: post.excerpt,
      featured: post.featured,
      featuredOrder: post.featuredOrder,
      authorName: post.authorName,
      authorImage: post.authorImage,
      source: post.source,
    }));
  },
});

// Get all published posts, sorted by date descending
export const getAllPosts = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      _creationTime: v.number(),
      slug: v.string(),
      title: v.string(),
      description: v.string(),
      date: v.string(),
      published: v.boolean(),
      tags: v.array(v.string()),
      readTime: v.optional(v.string()),
      image: v.optional(v.string()),
      excerpt: v.optional(v.string()),
      featured: v.optional(v.boolean()),
      featuredOrder: v.optional(v.number()),
      authorName: v.optional(v.string()),
      authorImage: v.optional(v.string()),
      layout: v.optional(v.string()),
      rightSidebar: v.optional(v.boolean()),
      showFooter: v.optional(v.boolean()),
      footer: v.optional(v.string()),
      blogFeatured: v.optional(v.boolean()),
      understanding_score: v.optional(v.union(v.null(), v.number())),
      last_quizzed: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    // Filter out unlisted posts
    const listedPosts = posts.filter((p) => !p.unlisted);

    // Sort by date descending
    const sortedPosts = listedPosts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Return without content for list view
    return sortedPosts.map((post) => ({
      _id: post._id,
      _creationTime: post._creationTime,
      slug: post.slug,
      title: post.title,
      description: post.description,
      date: post.date,
      published: post.published,
      tags: post.tags,
      readTime: post.readTime,
      image: post.image,
      excerpt: post.excerpt,
      featured: post.featured,
      featuredOrder: post.featuredOrder,
      authorName: post.authorName,
      authorImage: post.authorImage,
      layout: post.layout,
      rightSidebar: post.rightSidebar,
      showFooter: post.showFooter,
      blogFeatured: post.blogFeatured,
      understanding_score: post.understanding_score,
      last_quizzed: post.last_quizzed,
    }));
  },
});

// Get all blog featured posts for the /blog page (hero + featured row)
// Returns posts with blogFeatured: true, sorted by date descending
export const getBlogFeaturedPosts = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      slug: v.string(),
      title: v.string(),
      description: v.string(),
      date: v.string(),
      tags: v.array(v.string()),
      readTime: v.optional(v.string()),
      image: v.optional(v.string()),
      excerpt: v.optional(v.string()),
      authorName: v.optional(v.string()),
      authorImage: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_blogFeatured", (q) => q.eq("blogFeatured", true))
      .collect();

    // Filter to only published posts and sort by date descending
    const publishedFeatured = posts
      .filter((p) => p.published && !p.unlisted)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return publishedFeatured.map((post) => ({
      _id: post._id,
      slug: post.slug,
      title: post.title,
      description: post.description,
      date: post.date,
      tags: post.tags,
      readTime: post.readTime,
      image: post.image,
      excerpt: post.excerpt,
      authorName: post.authorName,
      authorImage: post.authorImage,
    }));
  },
});

// Get featured posts for the homepage featured section
export const getFeaturedPosts = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      slug: v.string(),
      title: v.string(),
      excerpt: v.optional(v.string()),
      description: v.string(),
      image: v.optional(v.string()),
      featuredOrder: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .collect();

    // Filter to only published posts and sort by featuredOrder
    const featuredPosts = posts
      .filter((p) => p.published && !p.unlisted)
      .sort((a, b) => {
        const orderA = a.featuredOrder ?? 999;
        const orderB = b.featuredOrder ?? 999;
        return orderA - orderB;
      });

    return featuredPosts.map((post) => ({
      _id: post._id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      description: post.description,
      image: post.image,
      featuredOrder: post.featuredOrder,
    }));
  },
});

// Get a single post by slug
export const getPostBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("posts"),
      _creationTime: v.number(),
      slug: v.string(),
      title: v.string(),
      description: v.string(),
      content: v.string(),
      date: v.string(),
      published: v.boolean(),
      tags: v.array(v.string()),
      readTime: v.optional(v.string()),
      image: v.optional(v.string()),
      showImageAtTop: v.optional(v.boolean()),
      excerpt: v.optional(v.string()),
      featured: v.optional(v.boolean()),
      featuredOrder: v.optional(v.number()),
      authorName: v.optional(v.string()),
      authorImage: v.optional(v.string()),
      layout: v.optional(v.string()),
      rightSidebar: v.optional(v.boolean()),
      showFooter: v.optional(v.boolean()),
      footer: v.optional(v.string()),
      showSocialFooter: v.optional(v.boolean()),
      aiChat: v.optional(v.boolean()),
      newsletter: v.optional(v.boolean()),
      contactForm: v.optional(v.boolean()),
      docsSection: v.optional(v.boolean()),
      understanding_score: v.optional(v.union(v.null(), v.number())),
      last_quizzed: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!post || !post.published) {
      return null;
    }

    return {
      _id: post._id,
      _creationTime: post._creationTime,
      slug: post.slug,
      title: post.title,
      description: post.description,
      content: post.content,
      date: post.date,
      published: post.published,
      tags: post.tags,
      readTime: post.readTime,
      image: post.image,
      showImageAtTop: post.showImageAtTop,
      excerpt: post.excerpt,
      featured: post.featured,
      featuredOrder: post.featuredOrder,
      authorName: post.authorName,
      authorImage: post.authorImage,
      layout: post.layout,
      rightSidebar: post.rightSidebar,
      showFooter: post.showFooter,
      footer: post.footer,
      showSocialFooter: post.showSocialFooter,
      aiChat: post.aiChat,
      newsletter: post.newsletter,
      contactForm: post.contactForm,
      docsSection: post.docsSection,
      understanding_score: post.understanding_score,
      last_quizzed: post.last_quizzed,
    };
  },
});

// Internal query to get post by slug (for newsletter sending)
// Returns post details needed for newsletter content
export const getPostBySlugInternal = internalQuery({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      slug: v.string(),
      title: v.string(),
      description: v.string(),
      content: v.string(),
      excerpt: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!post || !post.published) {
      return null;
    }

    return {
      slug: post.slug,
      title: post.title,
      description: post.description,
      content: post.content,
      excerpt: post.excerpt,
    };
  },
});

// Internal query to get recent posts (for weekly digest)
// Returns published posts with date >= since parameter
export const getRecentPostsInternal = internalQuery({
  args: {
    since: v.string(), // Date string in YYYY-MM-DD format
  },
  returns: v.array(
    v.object({
      slug: v.string(),
      title: v.string(),
      description: v.string(),
      date: v.string(),
      excerpt: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    // Filter posts by date and sort descending, excluding unlisted
    const recentPosts = posts
      .filter((post) => post.date >= args.since && !post.unlisted)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((post) => ({
        slug: post.slug,
        title: post.title,
        description: post.description,
        date: post.date,
        excerpt: post.excerpt,
      }));

    return recentPosts;
  },
});

// Internal query to get posts with quiz results for reverse sync
// Returns posts with understanding_score (for syncing quiz results back to markdown)
export const getPostsWithQuizResults = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      understanding_score: v.optional(v.union(v.null(), v.number())),
      last_quizzed: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const posts = await ctx.db.query("posts").collect();

    // Filter posts that have quiz results and return only quiz-related fields
    const postsWithScores = posts
      .filter((p) => p.understanding_score !== null && p.understanding_score !== undefined)
      .map((post) => ({
        slug: post.slug,
        understanding_score: post.understanding_score,
        last_quizzed: post.last_quizzed,
      }));

    return postsWithScores;
  },
});

// Internal mutation for syncing posts from markdown files
export const syncPosts = internalMutation({
  args: {
    posts: v.array(
      v.object({
        slug: v.string(),
        title: v.string(),
        description: v.string(),
        content: v.string(),
        date: v.string(),
        published: v.boolean(),
        tags: v.array(v.string()),
        readTime: v.optional(v.string()),
        // Tutorial-specific fields
        concepts: v.optional(v.string()),
        source_repo: v.optional(v.string()),
        understanding_score: v.optional(v.union(v.null(), v.number())),
        last_quizzed: v.optional(v.string()),
        prerequisites: v.optional(v.array(v.string())),
        created: v.optional(v.string()),
        last_updated: v.optional(v.string()),
        // Blog fields
        image: v.optional(v.string()),
        showImageAtTop: v.optional(v.boolean()),
        excerpt: v.optional(v.string()),
        featured: v.optional(v.boolean()),
        featuredOrder: v.optional(v.number()),
        authorName: v.optional(v.string()),
        authorImage: v.optional(v.string()),
        layout: v.optional(v.string()),
        rightSidebar: v.optional(v.boolean()),
        showFooter: v.optional(v.boolean()),
        footer: v.optional(v.string()),
        showSocialFooter: v.optional(v.boolean()),
        aiChat: v.optional(v.boolean()),
        blogFeatured: v.optional(v.boolean()),
        newsletter: v.optional(v.boolean()),
        contactForm: v.optional(v.boolean()),
        unlisted: v.optional(v.boolean()),
        docsSection: v.optional(v.boolean()),
        docsSectionGroup: v.optional(v.string()),
        docsSectionOrder: v.optional(v.number()),
        docsSectionGroupOrder: v.optional(v.number()),
        docsSectionGroupIcon: v.optional(v.string()),
        docsLanding: v.optional(v.boolean()),
      }),
    ),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    deleted: v.number(),
  }),
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;
    let deleted = 0;

    const now = Date.now();
    const incomingSlugs = new Set(args.posts.map((p) => p.slug));

    // Get all existing posts
    const existingPosts = await ctx.db.query("posts").collect();
    const existingBySlug = new Map(existingPosts.map((p) => [p.slug, p]));

    // Upsert incoming posts
    for (const post of args.posts) {
      const existing = existingBySlug.get(post.slug);

      if (existing) {
        // Update existing post
        await ctx.db.patch(existing._id, {
          title: post.title,
          description: post.description,
          content: post.content,
          date: post.date,
          published: post.published,
          tags: post.tags,
          readTime: post.readTime,
          // Tutorial-specific fields
          concepts: post.concepts,
          source_repo: post.source_repo,
          understanding_score: post.understanding_score,
          last_quizzed: post.last_quizzed,
          prerequisites: post.prerequisites,
          created: post.created,
          last_updated: post.last_updated,
          // Blog fields
          image: post.image,
          showImageAtTop: post.showImageAtTop,
          excerpt: post.excerpt,
          featured: post.featured,
          featuredOrder: post.featuredOrder,
          authorName: post.authorName,
          authorImage: post.authorImage,
          layout: post.layout,
          rightSidebar: post.rightSidebar,
          showFooter: post.showFooter,
          footer: post.footer,
          showSocialFooter: post.showSocialFooter,
          aiChat: post.aiChat,
          blogFeatured: post.blogFeatured,
          newsletter: post.newsletter,
          contactForm: post.contactForm,
          unlisted: post.unlisted,
          docsSection: post.docsSection,
          docsSectionGroup: post.docsSectionGroup,
          docsSectionOrder: post.docsSectionOrder,
          docsSectionGroupOrder: post.docsSectionGroupOrder,
          docsSectionGroupIcon: post.docsSectionGroupIcon,
          docsLanding: post.docsLanding,
          lastSyncedAt: now,
        });
        updated++;
      } else {
        // Create new post
        await ctx.db.insert("posts", {
          ...post,
          lastSyncedAt: now,
        });
        created++;
      }
    }

    // Delete posts that no longer exist in the repo
    for (const existing of existingPosts) {
      if (!incomingSlugs.has(existing.slug)) {
        await ctx.db.delete(existing._id);
        deleted++;
      }
    }

    return { created, updated, deleted };
  },
});

// Public mutation wrapper for sync script (no auth required for build-time sync)
// Respects source field: only syncs posts where source !== "dashboard"
export const syncPostsPublic = mutation({
  args: {
    posts: v.array(
      v.object({
        slug: v.string(),
        title: v.string(),
        description: v.string(),
        content: v.string(),
        date: v.string(),
        published: v.boolean(),
        tags: v.array(v.string()),
        readTime: v.optional(v.string()),
        // Tutorial-specific fields
        concepts: v.optional(v.string()),
        source_repo: v.optional(v.string()),
        understanding_score: v.optional(v.union(v.null(), v.number())),
        last_quizzed: v.optional(v.string()),
        prerequisites: v.optional(v.array(v.string())),
        created: v.optional(v.string()),
        last_updated: v.optional(v.string()),
        // Blog fields
        image: v.optional(v.string()),
        showImageAtTop: v.optional(v.boolean()),
        excerpt: v.optional(v.string()),
        featured: v.optional(v.boolean()),
        featuredOrder: v.optional(v.number()),
        authorName: v.optional(v.string()),
        authorImage: v.optional(v.string()),
        layout: v.optional(v.string()),
        rightSidebar: v.optional(v.boolean()),
        showFooter: v.optional(v.boolean()),
        footer: v.optional(v.string()),
        showSocialFooter: v.optional(v.boolean()),
        aiChat: v.optional(v.boolean()),
        blogFeatured: v.optional(v.boolean()),
        newsletter: v.optional(v.boolean()),
        contactForm: v.optional(v.boolean()),
        unlisted: v.optional(v.boolean()),
        docsSection: v.optional(v.boolean()),
        docsSectionGroup: v.optional(v.string()),
        docsSectionOrder: v.optional(v.number()),
        docsSectionGroupOrder: v.optional(v.number()),
        docsSectionGroupIcon: v.optional(v.string()),
        docsLanding: v.optional(v.boolean()),
      }),
    ),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    deleted: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;
    let deleted = 0;
    let skipped = 0;

    const now = Date.now();
    const incomingSlugs = new Set(args.posts.map((p) => p.slug));

    // Get all existing posts
    const existingPosts = await ctx.db.query("posts").collect();
    const existingBySlug = new Map(existingPosts.map((p) => [p.slug, p]));

    // Upsert incoming posts (only if source !== "dashboard")
    for (const post of args.posts) {
      const existing = existingBySlug.get(post.slug);

      if (existing) {
        // Skip dashboard-created posts - don't overwrite them
        if (existing.source === "dashboard") {
          skipped++;
          continue;
        }
        // Capture version before update (async, non-blocking)
        await ctx.scheduler.runAfter(0, internal.versions.createVersion, {
          contentType: "post",
          contentId: existing._id,
          slug: existing.slug,
          title: existing.title,
          content: existing.content,
          description: existing.description,
          source: "sync",
        });
        // Update existing sync post
        await ctx.db.patch(existing._id, {
          title: post.title,
          description: post.description,
          content: post.content,
          date: post.date,
          published: post.published,
          tags: post.tags,
          readTime: post.readTime,
          // Tutorial-specific fields
          concepts: post.concepts,
          source_repo: post.source_repo,
          understanding_score: post.understanding_score,
          last_quizzed: post.last_quizzed,
          prerequisites: post.prerequisites,
          created: post.created,
          last_updated: post.last_updated,
          // Blog fields
          image: post.image,
          showImageAtTop: post.showImageAtTop,
          excerpt: post.excerpt,
          featured: post.featured,
          featuredOrder: post.featuredOrder,
          authorName: post.authorName,
          authorImage: post.authorImage,
          layout: post.layout,
          rightSidebar: post.rightSidebar,
          showFooter: post.showFooter,
          footer: post.footer,
          showSocialFooter: post.showSocialFooter,
          aiChat: post.aiChat,
          blogFeatured: post.blogFeatured,
          newsletter: post.newsletter,
          contactForm: post.contactForm,
          unlisted: post.unlisted,
          docsSection: post.docsSection,
          docsSectionGroup: post.docsSectionGroup,
          docsSectionOrder: post.docsSectionOrder,
          docsSectionGroupOrder: post.docsSectionGroupOrder,
          docsSectionGroupIcon: post.docsSectionGroupIcon,
          docsLanding: post.docsLanding,
          source: "sync",
          lastSyncedAt: now,
        });
        updated++;
      } else {
        // Create new post with source: "sync"
        await ctx.db.insert("posts", {
          ...post,
          source: "sync",
          lastSyncedAt: now,
        });
        created++;
      }
    }

    // Delete posts that no longer exist in the repo (but not dashboard posts)
    for (const existing of existingPosts) {
      if (!incomingSlugs.has(existing.slug) && existing.source !== "dashboard") {
        await ctx.db.delete(existing._id);
        deleted++;
      }
    }

    return { created, updated, deleted, skipped };
  },
});

// Public mutation for incrementing view count
export const incrementViewCount = mutation({
  args: {
    slug: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("viewCounts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
      });
    } else {
      await ctx.db.insert("viewCounts", {
        slug: args.slug,
        count: 1,
      });
    }

    return null;
  },
});

// Get view count for a post
export const getViewCount = query({
  args: {
    slug: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const viewCount = await ctx.db
      .query("viewCounts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    return viewCount?.count ?? 0;
  },
});

// Get all unique tags from published posts
export const getAllTags = query({
  args: {},
  returns: v.array(
    v.object({
      tag: v.string(),
      count: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    // Filter out unlisted posts
    const listedPosts = posts.filter((p) => !p.unlisted);

    // Count occurrences of each tag
    const tagCounts = new Map<string, number>();
    for (const post of listedPosts) {
      for (const tag of post.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Convert to array and sort by count (descending), then alphabetically
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.tag.localeCompare(b.tag);
      });
  },
});

// Get posts filtered by a specific tag
export const getPostsByTag = query({
  args: {
    tag: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      _creationTime: v.number(),
      slug: v.string(),
      title: v.string(),
      description: v.string(),
      date: v.string(),
      published: v.boolean(),
      tags: v.array(v.string()),
      readTime: v.optional(v.string()),
      image: v.optional(v.string()),
      excerpt: v.optional(v.string()),
      featured: v.optional(v.boolean()),
      featuredOrder: v.optional(v.number()),
      authorName: v.optional(v.string()),
      authorImage: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    // Filter posts that have the specified tag and are not unlisted
    const filteredPosts = posts.filter(
      (post) =>
        !post.unlisted &&
        post.tags.some((t) => t.toLowerCase() === args.tag.toLowerCase()),
    );

    // Sort by date descending
    const sortedPosts = filteredPosts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Return without content for list view
    return sortedPosts.map((post) => ({
      _id: post._id,
      _creationTime: post._creationTime,
      slug: post.slug,
      title: post.title,
      description: post.description,
      date: post.date,
      published: post.published,
      tags: post.tags,
      readTime: post.readTime,
      image: post.image,
      excerpt: post.excerpt,
      featured: post.featured,
      featuredOrder: post.featuredOrder,
      authorName: post.authorName,
      authorImage: post.authorImage,
    }));
  },
});

// Get related posts that share tags with the current post
export const getRelatedPosts = query({
  args: {
    currentSlug: v.string(),
    tags: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      slug: v.string(),
      title: v.string(),
      description: v.string(),
      date: v.string(),
      tags: v.array(v.string()),
      readTime: v.optional(v.string()),
      image: v.optional(v.string()),
      excerpt: v.optional(v.string()),
      authorName: v.optional(v.string()),
      authorImage: v.optional(v.string()),
      sharedTags: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const maxResults = args.limit ?? 3;

    // Skip if no tags provided
    if (args.tags.length === 0) {
      return [];
    }

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    // Find posts that share tags, excluding current post and unlisted posts
    const relatedPosts = posts
      .filter((post) => post.slug !== args.currentSlug && !post.unlisted)
      .map((post) => {
        const sharedTags = post.tags.filter((tag) =>
          args.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
        ).length;
        return {
          _id: post._id,
          slug: post.slug,
          title: post.title,
          description: post.description,
          date: post.date,
          tags: post.tags,
          readTime: post.readTime,
          image: post.image,
          excerpt: post.excerpt,
          authorName: post.authorName,
          authorImage: post.authorImage,
          sharedTags,
        };
      })
      .filter((post) => post.sharedTags > 0)
      .sort((a, b) => {
        // Sort by shared tags count first, then by date
        if (b.sharedTags !== a.sharedTags) return b.sharedTags - a.sharedTags;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, maxResults);

    return relatedPosts;
  },
});

// Get all unique authors with post counts (for author pages)
export const getAllAuthors = query({
  args: {},
  returns: v.array(
    v.object({
      name: v.string(),
      slug: v.string(),
      count: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    // Filter out unlisted posts and posts without author
    const publishedPosts = posts.filter((p) => !p.unlisted && p.authorName);

    // Count posts per author
    const authorCounts = new Map<string, number>();
    for (const post of publishedPosts) {
      if (post.authorName) {
        const count = authorCounts.get(post.authorName) || 0;
        authorCounts.set(post.authorName, count + 1);
      }
    }

    // Convert to array with slugs, sorted by count then name
    return Array.from(authorCounts.entries())
      .map(([name, count]) => ({
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        count,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
  },
});

// Get posts filtered by author slug
export const getPostsByAuthor = query({
  args: {
    authorSlug: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      _creationTime: v.number(),
      slug: v.string(),
      title: v.string(),
      description: v.string(),
      date: v.string(),
      published: v.boolean(),
      tags: v.array(v.string()),
      readTime: v.optional(v.string()),
      image: v.optional(v.string()),
      excerpt: v.optional(v.string()),
      featured: v.optional(v.boolean()),
      featuredOrder: v.optional(v.number()),
      authorName: v.optional(v.string()),
      authorImage: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    // Filter posts by author slug match and not unlisted
    const filteredPosts = posts.filter((post) => {
      if (!post.authorName || post.unlisted) return false;
      const slug = post.authorName.toLowerCase().replace(/\s+/g, "-");
      return slug === args.authorSlug;
    });

    // Sort by date descending
    const sortedPosts = filteredPosts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Return without content for list view
    return sortedPosts.map((post) => ({
      _id: post._id,
      _creationTime: post._creationTime,
      slug: post.slug,
      title: post.title,
      description: post.description,
      date: post.date,
      published: post.published,
      tags: post.tags,
      readTime: post.readTime,
      image: post.image,
      excerpt: post.excerpt,
      featured: post.featured,
      featuredOrder: post.featuredOrder,
      authorName: post.authorName,
      authorImage: post.authorImage,
    }));
  },
});

// Get all posts marked for docs section navigation
// Used by DocsSidebar to build the left navigation
export const getDocsPosts = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("posts"),
      slug: v.string(),
      title: v.string(),
      docsSectionGroup: v.optional(v.string()),
      docsSectionOrder: v.optional(v.number()),
      docsSectionGroupOrder: v.optional(v.number()),
      docsSectionGroupIcon: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_docsSection", (q) => q.eq("docsSection", true))
      .collect();

    // Filter to only published posts
    const publishedDocs = posts.filter((p) => p.published);

    // Sort by docsSectionOrder, then by title
    const sortedDocs = publishedDocs.sort((a, b) => {
      const orderA = a.docsSectionOrder ?? 999;
      const orderB = b.docsSectionOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });

    return sortedDocs.map((post) => ({
      _id: post._id,
      slug: post.slug,
      title: post.title,
      docsSectionGroup: post.docsSectionGroup,
      docsSectionOrder: post.docsSectionOrder,
      docsSectionGroupOrder: post.docsSectionGroupOrder,
      docsSectionGroupIcon: post.docsSectionGroupIcon,
    }));
  },
});

// Get the docs landing page (post with docsLanding: true)
// Returns null if no landing page is set
export const getDocsLandingPost = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("posts"),
      slug: v.string(),
      title: v.string(),
      description: v.string(),
      content: v.string(),
      date: v.string(),
      tags: v.array(v.string()),
      readTime: v.optional(v.string()),
      image: v.optional(v.string()),
      showImageAtTop: v.optional(v.boolean()),
      authorName: v.optional(v.string()),
      authorImage: v.optional(v.string()),
      docsSectionGroup: v.optional(v.string()),
      docsSectionOrder: v.optional(v.number()),
      showFooter: v.optional(v.boolean()),
      footer: v.optional(v.string()),
      aiChat: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    // Get all docs posts and find one with docsLanding: true
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_docsSection", (q) => q.eq("docsSection", true))
      .collect();

    const landing = posts.find((p) => p.published && p.docsLanding);

    if (!landing) return null;

    return {
      _id: landing._id,
      slug: landing.slug,
      title: landing.title,
      description: landing.description,
      content: landing.content,
      date: landing.date,
      tags: landing.tags,
      readTime: landing.readTime,
      image: landing.image,
      showImageAtTop: landing.showImageAtTop,
      authorName: landing.authorName,
      authorImage: landing.authorImage,
      docsSectionGroup: landing.docsSectionGroup,
      docsSectionOrder: landing.docsSectionOrder,
      showFooter: landing.showFooter,
      footer: landing.footer,
      aiChat: landing.aiChat,
    };
  },
});

// Get learning progress data for the progress dashboard
// Returns tutorials with quiz results and concept mastery tracking
export const getLearningProgress = query({
  args: {
    sessionId: v.optional(v.string()), // Optional session ID for user-specific data
  },
  returns: v.object({
    overallProgress: v.number(), // Percentage of tutorials with passing quiz scores
    tutorials: v.array(
      v.object({
        slug: v.string(),
        title: v.string(),
        description: v.string(),
        concepts: v.optional(v.string()), // Comma-separated concepts
        understanding_score: v.optional(v.union(v.null(), v.number())),
        last_quizzed: v.optional(v.string()),
        hasQuiz: v.boolean(),
        lastScore: v.optional(v.number()), // From user's last submission
        lastQuizDate: v.optional(v.number()), // Timestamp of last submission
        prerequisites: v.optional(v.array(v.string())),
      })
    ),
    conceptsNeedingReview: v.array(
      v.object({
        concept: v.string(),
        tutorialCount: v.number(),
        averageScore: v.number(),
      })
    ),
    quizHistory: v.array(
      v.object({
        postSlug: v.string(),
        title: v.string(),
        score: v.number(),
        percentage: v.number(),
        submittedAt: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    // Get all published posts (tutorials)
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    // Filter out unlisted posts
    const tutorials = posts.filter((p) => !p.unlisted);

    // Get all quizzes to check which tutorials have quizzes
    const quizzes = await ctx.db.query("quizzes").collect();
    const quizPostSlugs = new Set(
      quizzes.filter((q) => q.published).map((q) => q.postSlug)
    );

    // Get user's quiz submissions if sessionId provided
    let userSubmissions: Map<string, any> | null = null;
    if (args.sessionId) {
      // Since by_sessionId index doesn't work as expected, collect all and filter
      const allSubmissions = await ctx.db.query("quizSubmissions").collect();
      const userSubmissionList = allSubmissions.filter(
        (s) => s.sessionId === args.sessionId
      );

      userSubmissions = new Map();
      for (const sub of userSubmissionList) {
        // Keep only the most recent submission per post
        const existing = userSubmissions.get(sub.postSlug);
        if (!existing || sub.submittedAt > existing.submittedAt) {
          userSubmissions.set(sub.postSlug, sub);
        }
      }
    }

    // Build tutorial data with quiz information
    const tutorialData = tutorials.map((post) => {
      const hasQuiz = quizPostSlugs.has(post.slug);
      let lastScore: number | undefined;
      let lastQuizDate: number | undefined;

      if (userSubmissions && hasQuiz) {
        const submission = userSubmissions.get(post.slug);
        if (submission) {
          lastScore = submission.percentage;
          lastQuizDate = submission.submittedAt;
        }
      }

      return {
        slug: post.slug,
        title: post.title,
        description: post.description,
        concepts: post.concepts,
        understanding_score: post.understanding_score,
        last_quizzed: post.last_quizzed,
        hasQuiz,
        lastScore,
        lastQuizDate,
        prerequisites: post.prerequisites,
      };
    });

    // Calculate overall progress (percentage of tutorials with score >= 70%)
    const tutorialsWithScores = tutorialData.filter(
      (t) => t.lastScore !== undefined
    );
    const passingCount = tutorialsWithScores.filter(
      (t) => (t.lastScore ?? 0) >= 70
    ).length;
    const overallProgress =
      tutorialsWithScores.length > 0
        ? Math.round((passingCount / tutorialsWithScores.length) * 100)
        : 0;

    // Build concepts needing review
    // Collect all concepts from tutorials with scores < 70%
    const conceptScores = new Map<string, number[]>();
    for (const tutorial of tutorialData) {
      if (!tutorial.concepts) continue;

      const score = tutorial.lastScore ?? tutorial.understanding_score ?? 0;
      if (score < 70 && score > 0) {
        const concepts = tutorial.concepts.split(",").map((c) => c.trim());
        for (const concept of concepts) {
          if (!conceptScores.has(concept)) {
            conceptScores.set(concept, []);
          }
          conceptScores.get(concept)!.push(score);
        }
      }
    }

    const conceptsNeedingReview = Array.from(conceptScores.entries())
      .map(([concept, scores]) => ({
        concept,
        tutorialCount: scores.length,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }))
      .sort((a, b) => a.averageScore - b.averageScore); // Sort by lowest scores first

    // Build quiz history
    let quizHistory: any[] = [];
    if (userSubmissions) {
      quizHistory = Array.from(userSubmissions.values())
        .map((sub) => {
          const post = tutorials.find((p) => p.slug === sub.postSlug);
          return {
            postSlug: sub.postSlug,
            title: post?.title ?? sub.postSlug,
            score: sub.score,
            percentage: sub.percentage,
            submittedAt: sub.submittedAt,
          };
        })
        .sort((a, b) => b.submittedAt - a.submittedAt); // Most recent first
    }

    return {
      overallProgress,
      tutorials: tutorialData,
      conceptsNeedingReview,
      quizHistory,
    };
  },
});
