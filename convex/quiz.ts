import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  isAdminIdentity,
  isPublicContentOwner,
  requireAuth,
  requireOwnerOrAdmin,
} from "./authUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

const questionValidator = v.object({
  id: v.string(),
  question: v.string(),
  options: v.array(v.string()),
  correctAnswer: v.number(),
  explanation: v.optional(v.string()),
});

const answerValidator = v.object({
  questionId: v.string(),
  selectedAnswer: v.number(),
  isCorrect: v.boolean(),
});

const reviewBucketValidator = v.union(
  v.literal("excellent"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("needs_review"),
);

function getReviewSchedule(scorePercentage: number): {
  reviewBucket: "excellent" | "good" | "fair" | "needs_review";
  nextReviewAt: number;
} {
  const now = Date.now();

  if (scorePercentage >= 90) {
    return { reviewBucket: "excellent", nextReviewAt: now + 14 * DAY_MS };
  }
  if (scorePercentage >= 75) {
    return { reviewBucket: "good", nextReviewAt: now + 7 * DAY_MS };
  }
  if (scorePercentage >= 60) {
    return { reviewBucket: "fair", nextReviewAt: now + 3 * DAY_MS };
  }

  return { reviewBucket: "needs_review", nextReviewAt: now + DAY_MS };
}

function ensureValidQuestionSet(
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
  }>,
): void {
  if (questions.length === 0) {
    throw new Error("Quiz must have at least one question.");
  }

  const ids = new Set<string>();
  for (const question of questions) {
    if (ids.has(question.id)) {
      throw new Error(`Duplicate question id: ${question.id}`);
    }
    ids.add(question.id);

    if (question.options.length !== 4) {
      throw new Error(`Question ${question.id} must have exactly 4 options.`);
    }

    if (
      question.correctAnswer < 0 ||
      question.correctAnswer >= question.options.length
    ) {
      throw new Error(`Question ${question.id} has invalid correctAnswer index.`);
    }
  }
}

function validateSubmissionAnswers(
  quiz: {
    questions: Array<{
      id: string;
      correctAnswer: number;
      options: string[];
    }>;
  },
  answers: Array<{ questionId: string; selectedAnswer: number }>,
): void {
  if (answers.length !== quiz.questions.length) {
    throw new Error("You must answer all questions before submitting.");
  }

  const questionMap = new Map(quiz.questions.map((q) => [q.id, q]));
  const seenQuestionIds = new Set<string>();

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question) {
      throw new Error(`Unknown question id: ${answer.questionId}`);
    }

    if (seenQuestionIds.has(answer.questionId)) {
      throw new Error(`Duplicate answer for question id: ${answer.questionId}`);
    }
    seenQuestionIds.add(answer.questionId);

    if (
      answer.selectedAnswer < 0 ||
      answer.selectedAnswer >= question.options.length
    ) {
      throw new Error(`Invalid answer option for question id: ${answer.questionId}`);
    }
  }
}

async function getOwnedPostForQuiz(ctx: Parameters<typeof requireAuth>[0], postSlug: string) {
  const post = await ctx.db
    .query("posts")
    .withIndex("by_slug", (q) => q.eq("slug", postSlug))
    .first();

  if (!post) {
    throw new Error(`Post with slug "${postSlug}" not found.`);
  }

  await requireOwnerOrAdmin(ctx, post.ownerId);
  return post;
}

export const listAll = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("quizzes"),
      postSlug: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      questionCount: v.number(),
      published: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const isAdmin = isAdminIdentity(identity);

    const quizzes = await ctx.db.query("quizzes").collect();
    let visibleQuizzes = quizzes;

    if (!isAdmin) {
      const myPosts = await ctx.db
        .query("posts")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", identity.tokenIdentifier))
        .collect();
      const myPostSlugs = new Set(myPosts.map((post) => post.slug));
      visibleQuizzes = quizzes.filter((quiz) => myPostSlugs.has(quiz.postSlug));
    }

    const sortedQuizzes = visibleQuizzes.sort((a, b) => b.updatedAt - a.updatedAt);

    return sortedQuizzes.map((quiz) => ({
      _id: quiz._id,
      postSlug: quiz.postSlug,
      title: quiz.title,
      description: quiz.description,
      questionCount: quiz.questions.length,
      published: quiz.published,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
    }));
  },
});

export const listAllWithQuestions = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("quizzes"),
      postSlug: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      questions: v.array(questionValidator),
      published: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const isAdmin = isAdminIdentity(identity);

    const quizzes = await ctx.db.query("quizzes").collect();
    let visibleQuizzes = quizzes;

    if (!isAdmin) {
      const myPosts = await ctx.db
        .query("posts")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", identity.tokenIdentifier))
        .collect();
      const myPostSlugs = new Set(myPosts.map((post) => post.slug));
      visibleQuizzes = quizzes.filter((quiz) => myPostSlugs.has(quiz.postSlug));
    }

    const sortedQuizzes = visibleQuizzes.sort((a, b) => b.updatedAt - a.updatedAt);

    return sortedQuizzes.map((quiz) => ({
      _id: quiz._id,
      postSlug: quiz.postSlug,
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions,
      published: quiz.published,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
    }));
  },
});

export const getQuizByPostSlug = query({
  args: {
    postSlug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("quizzes"),
      title: v.string(),
      description: v.optional(v.string()),
      questions: v.array(questionValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const quiz = await ctx.db
      .query("quizzes")
      .withIndex("by_postSlug", (q) => q.eq("postSlug", args.postSlug))
      .first();

    if (!quiz || !quiz.published) {
      return null;
    }

    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.postSlug))
      .first();

    if (
      !post ||
      !post.published ||
      !isPublicContentOwner(post.ownerId, post.ownerEmail)
    ) {
      return null;
    }

    return {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions,
    };
  },
});

export const getQuizById = query({
  args: {
    quizId: v.id("quizzes"),
  },
  returns: v.union(
    v.object({
      _id: v.id("quizzes"),
      postSlug: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      questions: v.array(questionValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);

    if (!quiz || !quiz.published) {
      return null;
    }

    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", quiz.postSlug))
      .first();

    if (
      !post ||
      !post.published ||
      !isPublicContentOwner(post.ownerId, post.ownerEmail)
    ) {
      return null;
    }

    return {
      _id: quiz._id,
      postSlug: quiz.postSlug,
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions,
    };
  },
});

// Auth-gated editor query that returns drafts and published quizzes.
export const getQuizByIdForEditor = query({
  args: {
    quizId: v.id("quizzes"),
  },
  returns: v.union(
    v.object({
      _id: v.id("quizzes"),
      postSlug: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      questions: v.array(questionValidator),
      published: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      return null;
    }

    await getOwnedPostForQuiz(ctx, quiz.postSlug);

    return {
      _id: quiz._id,
      postSlug: quiz.postSlug,
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions,
      published: quiz.published,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
    };
  },
});

export const getAllQuizzes = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("quizzes"),
      postSlug: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      questionCount: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const publicPosts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    const publicPostSlugs = new Set(
      publicPosts
        .filter((post) => isPublicContentOwner(post.ownerId, post.ownerEmail))
        .map((post) => post.slug),
    );

    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    return quizzes
      .filter((quiz) => publicPostSlugs.has(quiz.postSlug))
      .map((quiz) => ({
        _id: quiz._id,
        postSlug: quiz.postSlug,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.questions.length,
        createdAt: quiz.createdAt,
      }));
  },
});

export const getMyPreviousSubmission = query({
  args: {
    postSlug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("quizSubmissions"),
      score: v.number(),
      totalQuestions: v.number(),
      percentage: v.number(),
      submittedAt: v.number(),
      answers: v.array(answerValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const submission = await ctx.db
      .query("quizSubmissions")
      .withIndex("by_user_post_submittedAt", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("postSlug", args.postSlug),
      )
      .order("desc")
      .first();

    if (!submission) {
      return null;
    }

    return {
      _id: submission._id,
      score: submission.score,
      totalQuestions: submission.totalQuestions,
      percentage: submission.percentage,
      submittedAt: submission.submittedAt,
      answers: submission.answers,
    };
  },
});

export const getMyQuizProgressForPost = query({
  args: {
    postSlug: v.string(),
  },
  returns: v.union(
    v.object({
      postSlug: v.string(),
      lastScore: v.number(),
      lastSubmittedAt: v.number(),
      nextReviewAt: v.number(),
      reviewBucket: reviewBucketValidator,
      attemptCount: v.number(),
      dueNow: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const progress = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_post", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("postSlug", args.postSlug),
      )
      .first();

    if (!progress) {
      return null;
    }

    return {
      postSlug: progress.postSlug,
      lastScore: progress.lastScore,
      lastSubmittedAt: progress.lastSubmittedAt,
      nextReviewAt: progress.nextReviewAt,
      reviewBucket: progress.reviewBucket,
      attemptCount: progress.attemptCount,
      dueNow: progress.nextReviewAt <= Date.now(),
    };
  },
});

export const getMyDueReviews = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      postSlug: v.string(),
      title: v.string(),
      lastScore: v.number(),
      nextReviewAt: v.number(),
      reviewBucket: reviewBucketValidator,
      attemptCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const limit = Math.max(1, Math.min(args.limit ?? 50, 100));

    const due = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_nextReviewAt", (q) =>
        q.eq("userId", identity.tokenIdentifier).lte("nextReviewAt", Date.now()),
      )
      .take(limit);

    const results = [] as Array<{
      postSlug: string;
      title: string;
      lastScore: number;
      nextReviewAt: number;
      reviewBucket: "excellent" | "good" | "fair" | "needs_review";
      attemptCount: number;
    }>;

    for (const item of due) {
      const post = await ctx.db
        .query("posts")
        .withIndex("by_slug", (q) => q.eq("slug", item.postSlug))
        .first();
      if (!post) continue;
      results.push({
        postSlug: item.postSlug,
        title: post.title,
        lastScore: item.lastScore,
        nextReviewAt: item.nextReviewAt,
        reviewBucket: item.reviewBucket,
        attemptCount: item.attemptCount,
      });
    }

    return results;
  },
});

export const getMyUpcomingReviews = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      postSlug: v.string(),
      title: v.string(),
      lastScore: v.number(),
      nextReviewAt: v.number(),
      reviewBucket: reviewBucketValidator,
      attemptCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const limit = Math.max(1, Math.min(args.limit ?? 50, 100));

    const upcoming = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_nextReviewAt", (q) =>
        q.eq("userId", identity.tokenIdentifier).gt("nextReviewAt", Date.now()),
      )
      .take(limit);

    const results = [] as Array<{
      postSlug: string;
      title: string;
      lastScore: number;
      nextReviewAt: number;
      reviewBucket: "excellent" | "good" | "fair" | "needs_review";
      attemptCount: number;
    }>;

    for (const item of upcoming) {
      const post = await ctx.db
        .query("posts")
        .withIndex("by_slug", (q) => q.eq("slug", item.postSlug))
        .first();
      if (!post) continue;
      results.push({
        postSlug: item.postSlug,
        title: post.title,
        lastScore: item.lastScore,
        nextReviewAt: item.nextReviewAt,
        reviewBucket: item.reviewBucket,
        attemptCount: item.attemptCount,
      });
    }

    return results;
  },
});

export const getMyPracticeOverview = query({
  args: {},
  returns: v.object({
    totalQuizzes: v.number(),
    completedQuizzes: v.number(),
    averageScore: v.number(),
    dueCount: v.number(),
    upcomingCount: v.number(),
    quizzes: v.array(
      v.object({
        _id: v.id("quizzes"),
        postSlug: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        questionCount: v.number(),
        createdAt: v.number(),
        postTitle: v.string(),
        postTags: v.array(v.string()),
        lastScore: v.optional(v.number()),
        lastSubmittedAt: v.optional(v.number()),
        nextReviewAt: v.optional(v.number()),
        dueNow: v.boolean(),
        attemptCount: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const now = Date.now();

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    const publicPosts = posts.filter(
      (post) => isPublicContentOwner(post.ownerId, post.ownerEmail) && !post.unlisted,
    );
    const postBySlug = new Map(publicPosts.map((post) => [post.slug, post]));

    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    const progressRows = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_lastSubmittedAt", (q) =>
        q.eq("userId", identity.tokenIdentifier),
      )
      .collect();

    const progressBySlug = new Map(progressRows.map((row) => [row.postSlug, row]));

    const quizItems = quizzes
      .map((quiz) => {
        const post = postBySlug.get(quiz.postSlug);
        if (!post) return null;

        const progress = progressBySlug.get(quiz.postSlug);
        return {
          _id: quiz._id,
          postSlug: quiz.postSlug,
          title: quiz.title,
          description: quiz.description,
          questionCount: quiz.questions.length,
          createdAt: quiz.createdAt,
          postTitle: post.title,
          postTags: post.tags,
          lastScore: progress?.lastScore,
          lastSubmittedAt: progress?.lastSubmittedAt,
          nextReviewAt: progress?.nextReviewAt,
          dueNow: progress ? progress.nextReviewAt <= now : false,
          attemptCount: progress?.attemptCount ?? 0,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const completedQuizzes = quizItems.filter((item) => item.lastScore !== undefined).length;
    const averageScore =
      completedQuizzes > 0
        ? quizItems
            .filter((item) => item.lastScore !== undefined)
            .reduce((sum, item) => sum + (item.lastScore ?? 0), 0) / completedQuizzes
        : 0;
    const dueCount = quizItems.filter((item) => item.dueNow).length;
    const upcomingCount = quizItems.filter(
      (item) => item.nextReviewAt !== undefined && !item.dueNow,
    ).length;

    return {
      totalQuizzes: quizItems.length,
      completedQuizzes,
      averageScore: Math.round(averageScore * 100) / 100,
      dueCount,
      upcomingCount,
      quizzes: quizItems,
    };
  },
});

// Legacy compatibility endpoint. Auth-only and postSlug-based.
export const getPreviousSubmission = query({
  args: {
    sessionId: v.optional(v.string()),
    postSlug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("quizSubmissions"),
      score: v.number(),
      totalQuestions: v.number(),
      percentage: v.number(),
      submittedAt: v.number(),
      answers: v.array(answerValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const submission = await ctx.db
      .query("quizSubmissions")
      .withIndex("by_user_post_submittedAt", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("postSlug", args.postSlug),
      )
      .order("desc")
      .first();

    if (!submission) {
      return null;
    }

    return {
      _id: submission._id,
      score: submission.score,
      totalQuestions: submission.totalQuestions,
      percentage: submission.percentage,
      submittedAt: submission.submittedAt,
      answers: submission.answers,
    };
  },
});

export const getSubmissionsByPostSlug = query({
  args: {
    postSlug: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("quizSubmissions"),
      score: v.number(),
      totalQuestions: v.number(),
      percentage: v.number(),
      submittedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await getOwnedPostForQuiz(ctx, args.postSlug);

    const submissions = await ctx.db
      .query("quizSubmissions")
      .withIndex("by_postSlug", (q) => q.eq("postSlug", args.postSlug))
      .collect();

    return submissions.map((s) => ({
      _id: s._id,
      score: s.score,
      totalQuestions: s.totalQuestions,
      percentage: s.percentage,
      submittedAt: s.submittedAt,
    }));
  },
});

export const getQuizStats = query({
  args: {
    postSlug: v.string(),
  },
  returns: v.union(
    v.object({
      totalSubmissions: v.number(),
      averageScore: v.number(),
      averagePercentage: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await getOwnedPostForQuiz(ctx, args.postSlug);

    const submissions = await ctx.db
      .query("quizSubmissions")
      .withIndex("by_postSlug", (q) => q.eq("postSlug", args.postSlug))
      .collect();

    if (submissions.length === 0) {
      return null;
    }

    const totalSubmissions = submissions.length;
    const averageScore = submissions.reduce((sum, s) => sum + s.score, 0) / totalSubmissions;
    const averagePercentage =
      submissions.reduce((sum, s) => sum + s.percentage, 0) / totalSubmissions;

    return {
      totalSubmissions,
      averageScore: Math.round(averageScore * 100) / 100,
      averagePercentage: Math.round(averagePercentage * 100) / 100,
    };
  },
});

export const createQuiz = mutation({
  args: {
    postSlug: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    questions: v.array(questionValidator),
    published: v.boolean(),
  },
  returns: v.id("quizzes"),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await getOwnedPostForQuiz(ctx, args.postSlug);

    ensureValidQuestionSet(args.questions);

    const existingQuiz = await ctx.db
      .query("quizzes")
      .withIndex("by_postSlug", (q) => q.eq("postSlug", args.postSlug))
      .first();

    if (existingQuiz) {
      throw new Error(`Quiz for post "${args.postSlug}" already exists.`);
    }

    const now = Date.now();

    return await ctx.db.insert("quizzes", {
      postSlug: args.postSlug,
      title: args.title,
      description: args.description,
      questions: args.questions,
      published: args.published,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    questions: v.optional(v.array(questionValidator)),
    published: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const existing = await ctx.db.get(args.quizId);
    if (!existing) {
      return null;
    }

    await getOwnedPostForQuiz(ctx, existing.postSlug);

    if (args.questions) {
      ensureValidQuestionSet(args.questions);
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.questions !== undefined) updates.questions = args.questions;
    if (args.published !== undefined) updates.published = args.published;

    await ctx.db.patch(args.quizId, updates);

    return null;
  },
});

export const deleteQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const existing = await ctx.db.get(args.quizId);
    if (!existing) {
      return false;
    }

    await getOwnedPostForQuiz(ctx, existing.postSlug);

    await ctx.db.delete(args.quizId);
    return true;
  },
});

export const submitQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
    answers: v.array(
      v.object({
        questionId: v.string(),
        selectedAnswer: v.number(),
      }),
    ),
  },
  returns: v.object({
    submissionId: v.id("quizSubmissions"),
    score: v.number(),
    totalQuestions: v.number(),
    percentage: v.number(),
    answers: v.array(answerValidator),
    nextReviewAt: v.number(),
    reviewBucket: reviewBucketValidator,
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || !quiz.published) {
      throw new Error("Quiz not found");
    }

    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", quiz.postSlug))
      .first();

    if (
      !post ||
      !post.published ||
      !isPublicContentOwner(post.ownerId, post.ownerEmail)
    ) {
      throw new Error("Quiz is not available");
    }

    validateSubmissionAnswers(quiz, args.answers);

    const now = Date.now();

    const gradedAnswers = args.answers.map((answer) => {
      const question = quiz.questions.find((q) => q.id === answer.questionId);
      const isCorrect = question
        ? answer.selectedAnswer === question.correctAnswer
        : false;
      return {
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
      };
    });

    const score = gradedAnswers.filter((answer) => answer.isCorrect).length;
    const totalQuestions = quiz.questions.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    const { reviewBucket, nextReviewAt } = getReviewSchedule(percentage);

    const submissionId = await ctx.db.insert("quizSubmissions", {
      quizId: args.quizId,
      userId: identity.tokenIdentifier,
      postSlug: quiz.postSlug,
      answers: gradedAnswers,
      score,
      totalQuestions,
      percentage,
      submittedAt: now,
    });

    const existingProgress = await ctx.db
      .query("quizProgress")
      .withIndex("by_user_post", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("postSlug", quiz.postSlug),
      )
      .first();

    if (existingProgress) {
      await ctx.db.patch(existingProgress._id, {
        lastScore: percentage,
        lastSubmittedAt: now,
        nextReviewAt,
        reviewBucket,
        attemptCount: existingProgress.attemptCount + 1,
      });
    } else {
      await ctx.db.insert("quizProgress", {
        userId: identity.tokenIdentifier,
        postSlug: quiz.postSlug,
        lastScore: percentage,
        lastSubmittedAt: now,
        nextReviewAt,
        reviewBucket,
        attemptCount: 1,
      });
    }

    return {
      submissionId,
      score,
      totalQuestions,
      percentage,
      answers: gradedAnswers,
      nextReviewAt,
      reviewBucket,
    };
  },
});

export const deleteSubmissionsForPost = mutation({
  args: {
    postSlug: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("quizSubmissions")
      .withIndex("by_postSlug", (q) => q.eq("postSlug", args.postSlug))
      .collect();

    let deleted = 0;
    for (const submission of submissions) {
      await ctx.db.delete(submission._id);
      deleted += 1;
    }

    return deleted;
  },
});

export const syncQuiz = mutation({
  args: {
    quiz: v.object({
      postSlug: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      questions: v.array(questionValidator),
    }),
  },
  returns: v.union(v.id("quizzes"), v.null()),
  handler: async (ctx, args) => {
    ensureValidQuestionSet(args.quiz.questions);

    const post = await ctx.db
      .query("posts")
      .withIndex("by_slug", (q) => q.eq("slug", args.quiz.postSlug))
      .first();

    if (!post) {
      throw new Error(`Post with slug "${args.quiz.postSlug}" not found.`);
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("quizzes")
      .withIndex("by_postSlug", (q) => q.eq("postSlug", args.quiz.postSlug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.quiz.title,
        description: args.quiz.description,
        questions: args.quiz.questions,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("quizzes", {
      postSlug: args.quiz.postSlug,
      title: args.quiz.title,
      description: args.quiz.description,
      questions: args.quiz.questions,
      published: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const syncQuizzes = mutation({
  args: {
    quizzes: v.array(
      v.object({
        postSlug: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        questions: v.array(questionValidator),
      }),
    ),
    pruneMissing: v.optional(v.boolean()),
  },
  returns: v.object({
    upserted: v.number(),
    pruned: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const inputSlugs = new Set(args.quizzes.map((quiz) => quiz.postSlug));

    let upserted = 0;

    for (const quiz of args.quizzes) {
      ensureValidQuestionSet(quiz.questions);

      const post = await ctx.db
        .query("posts")
        .withIndex("by_slug", (q) => q.eq("slug", quiz.postSlug))
        .first();

      if (!post) {
        throw new Error(`Post with slug "${quiz.postSlug}" not found.`);
      }

      const existing = await ctx.db
        .query("quizzes")
        .withIndex("by_postSlug", (q) => q.eq("postSlug", quiz.postSlug))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          title: quiz.title,
          description: quiz.description,
          questions: quiz.questions,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("quizzes", {
          postSlug: quiz.postSlug,
          title: quiz.title,
          description: quiz.description,
          questions: quiz.questions,
          published: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      upserted += 1;
    }

    let pruned = 0;
    if (args.pruneMissing) {
      const existingQuizzes = await ctx.db.query("quizzes").collect();
      for (const existing of existingQuizzes) {
        if (!inputSlugs.has(existing.postSlug)) {
          await ctx.db.delete(existing._id);
          pruned += 1;
        }
      }
    }

    return { upserted, pruned };
  },
});
