import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Question type used across functions
const questionValidator = v.object({
  id: v.string(),
  question: v.string(),
  options: v.array(v.string()),
  correctAnswer: v.number(),
  explanation: v.optional(v.string()),
});

// Get all quizzes (published and unpublished) for dashboard admin view
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
    })
  ),
  handler: async (ctx) => {
    const quizzes = await ctx.db.query("quizzes").collect();

    // Sort by updatedAt descending (most recently updated first)
    const sortedQuizzes = quizzes.sort(
      (a, b) => b.updatedAt - a.updatedAt
    );

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

// Get all quizzes with full question data (for export)
// Returns complete quiz objects including questions
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
    })
  ),
  handler: async (ctx) => {
    const quizzes = await ctx.db.query("quizzes").collect();

    // Sort by updatedAt descending (most recently updated first)
    const sortedQuizzes = quizzes.sort((a, b) => b.updatedAt - a.updatedAt);

    // Explicitly map fields to exclude system fields like _creationTime
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

// Answer type for submissions
const answerValidator = v.object({
  questionId: v.string(),
  selectedAnswer: v.number(),
  isCorrect: v.boolean(),
});

// Get a published quiz by post slug
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
    v.null()
  ),
  handler: async (ctx, args) => {
    const quiz = await ctx.db
      .query("quizzes")
      .withIndex("by_postSlug", (q) => q.eq("postSlug", args.postSlug))
      .first();

    if (!quiz || !quiz.published) {
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

// Get quiz by ID (for taking the quiz)
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
    v.null()
  ),
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);

    if (!quiz || !quiz.published) {
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

// Get all published quizzes (for admin or quiz listing)
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
    })
  ),
  handler: async (ctx) => {
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    return quizzes.map((quiz) => ({
      _id: quiz._id,
      postSlug: quiz.postSlug,
      title: quiz.title,
      description: quiz.description,
      questionCount: quiz.questions.length,
      createdAt: quiz.createdAt,
    }));
  },
});

// Get previous submission for a session and post
export const getPreviousSubmission = query({
  args: {
    sessionId: v.string(),
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
    v.null()
  ),
  handler: async (ctx, args) => {
    const submission = await ctx.db
      .query("quizSubmissions")
      .withIndex("by_session_post", (q) =>
        q.eq("sessionId", args.sessionId).eq("postSlug", args.postSlug)
      )
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

// Get all submissions for a post (for analytics)
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
    })
  ),
  handler: async (ctx, args) => {
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

// Get quiz statistics for a post
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
    v.null()
  ),
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("quizSubmissions")
      .withIndex("by_postSlug", (q) => q.eq("postSlug", args.postSlug))
      .collect();

    if (submissions.length === 0) {
      return null;
    }

    const totalSubmissions = submissions.length;
    const averageScore =
      submissions.reduce((sum, s) => sum + s.score, 0) / totalSubmissions;
    const averagePercentage =
      submissions.reduce((sum, s) => sum + s.percentage, 0) / totalSubmissions;

    return {
      totalSubmissions,
      averageScore: Math.round(averageScore * 100) / 100,
      averagePercentage: Math.round(averagePercentage * 100) / 100,
    };
  },
});

// Create a new quiz
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
    const now = Date.now();

    const quizId = await ctx.db.insert("quizzes", {
      postSlug: args.postSlug,
      title: args.title,
      description: args.description,
      questions: args.questions,
      published: args.published,
      createdAt: now,
      updatedAt: now,
    });

    return quizId;
  },
});

// Update an existing quiz
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
    const existing = await ctx.db.get(args.quizId);

    if (!existing) {
      return null;
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      updates.title = args.title;
    }
    if (args.description !== undefined) {
      updates.description = args.description;
    }
    if (args.questions !== undefined) {
      updates.questions = args.questions;
    }
    if (args.published !== undefined) {
      updates.published = args.published;
    }

    await ctx.db.patch(args.quizId, updates);

    return null;
  },
});

// Delete a quiz
export const deleteQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.quizId);

    if (!existing) {
      return false;
    }

    await ctx.db.delete(args.quizId);

    return true;
  },
});

// Submit quiz answers
export const submitQuiz = mutation({
  args: {
    quizId: v.id("quizzes"),
    sessionId: v.string(),
    answers: v.array(
      v.object({
        questionId: v.string(),
        selectedAnswer: v.number(),
      })
    ),
  },
  returns: v.object({
    submissionId: v.id("quizSubmissions"),
    score: v.number(),
    totalQuestions: v.number(),
    percentage: v.number(),
    answers: v.array(answerValidator),
  }),
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);

    if (!quiz) {
      throw new Error("Quiz not found");
    }

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

    const score = gradedAnswers.filter((a) => a.isCorrect).length;
    const totalQuestions = quiz.questions.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    const submissionId = await ctx.db.insert("quizSubmissions", {
      quizId: args.quizId,
      postSlug: quiz.postSlug,
      sessionId: args.sessionId,
      answers: gradedAnswers,
      score,
      totalQuestions,
      percentage,
      submittedAt: now,
    });

    return {
      submissionId,
      score,
      totalQuestions,
      percentage,
      answers: gradedAnswers,
    };
  },
});

// Internal mutation to delete all submissions for a post
// Used when a post is deleted or resynced
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
      deleted++;
    }

    return deleted;
  },
});

// Sync quiz from JSON file (used by sync-quizzes.ts script)
// Upserts quiz by postSlug - creates new or updates existing
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
    const now = Date.now();

    // Check if quiz already exists for this post
    const existing = await ctx.db
      .query("quizzes")
      .withIndex("by_postSlug", (q) => q.eq("postSlug", args.quiz.postSlug))
      .first();

    if (existing) {
      // Update existing quiz
      await ctx.db.patch(existing._id, {
        title: args.quiz.title,
        description: args.quiz.description,
        questions: args.quiz.questions,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new quiz
    const quizId = await ctx.db.insert("quizzes", {
      postSlug: args.quiz.postSlug,
      title: args.quiz.title,
      description: args.quiz.description,
      questions: args.quiz.questions,
      published: true,
      createdAt: now,
      updatedAt: now,
    });

    return quizId;
  },
});
