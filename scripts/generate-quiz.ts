#!/usr/bin/env -S npx tsx
/**
 * AI Quiz Generator
 *
 * Usage: npm run generate-quiz <post-slug>
 *
 * Generates quiz questions from tutorial content using AI.
 */

import fs from "fs";
import path from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { siteConfig } from "../src/config/siteConfig";

// Load environment variables
const isProduction = process.env.SYNC_ENV === "production";

if (isProduction) {
  dotenv.config({ path: ".env.production.local" });
  console.log("Using PRODUCTION Convex deployment...\n");
} else {
  dotenv.config({ path: ".env.local" });
}
dotenv.config();

const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;

if (!convexUrl) {
  console.error("Error: VITE_CONVEX_URL or CONVEX_URL environment variable is not set");
  process.exit(1);
}

if (!anthropicApiKey) {
  console.error("Error: ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN environment variable is not set");
  process.exit(1);
}

if (anthropicBaseUrl) {
  console.log(`Using custom Anthropic base URL: ${anthropicBaseUrl}`);
}

// Get post slug from CLI argument
const postSlug = process.argv[2];

if (!postSlug) {
  console.error("Usage: npm run generate-quiz <post-slug>");
  console.error("Example: npm run generate-quiz react-query-mutations-best-practices");
  process.exit(1);
}

// Quiz output directory
const QUIZ_OUTPUT_DIR = path.join(process.cwd(), "content", "quiz");

// Ensure quiz directory exists
if (!fs.existsSync(QUIZ_OUTPUT_DIR)) {
  fs.mkdirSync(QUIZ_OUTPUT_DIR, { recursive: true });
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface QuizData {
  postSlug: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
}

/**
 * Generate a unique ID for a question
 */
function generateQuestionId(index: number): string {
  return `q-${Date.now()}-${index}`;
}

/**
 * Fetch post content from Convex using the public API
 */
async function fetchPostContent(slug: string): Promise<{ title: string; content: string; description: string } | null> {
  const client = new ConvexHttpClient(convexUrl!);

  try {
    // Use the public api to get all posts, then find the one we need
    const posts = await client.query(api.posts.listAll, {});
    const post = posts.find((p) => p.slug === slug);

    if (!post) {
      console.error(`Post with slug "${slug}" not found`);
      return null;
    }

    return {
      title: post.title,
      content: post.content,
      description: post.description,
    };
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
}

/**
 * Generate quiz questions using AI
 */
async function generateQuizWithAI(
  title: string,
  content: string,
  description: string
): Promise<QuizQuestion[]> {
  const anthropic = new Anthropic({
    apiKey: anthropicApiKey!,
    ...(anthropicBaseUrl && { baseURL: anthropicBaseUrl }),
  });

  // Truncate content if too long (Claude has context limits)
  const maxContentLength = 15000;
  const truncatedContent =
    content.length > maxContentLength
      ? content.slice(0, maxContentLength) + "\n\n[Content truncated...]"
      : content;

  const prompt = `You are an expert educational content creator. Generate 5-10 multiple choice quiz questions based on the following tutorial.

Tutorial Title: ${title}
Tutorial Description: ${description}

Tutorial Content:
${truncatedContent}

Requirements:
1. Generate 5-10 questions that test understanding of key concepts
2. Focus on practical knowledge and important concepts, not trivial details
3. Each question must have exactly 4 options (A, B, C, D)
4. Only one option should be correct
5. Include a brief explanation for why the correct answer is right
6. Questions should be challenging but fair

Return ONLY valid JSON in this exact format:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Brief explanation of why this is correct"
  }
]

Note: correctAnswer is a 0-based index (0 = first option, 1 = second, etc.)`;

  try {
    console.log("Generating quiz questions with AI...\n");

    const response = await anthropic.messages.create({
      model: siteConfig.aiDashboard?.defaultTextModel ?? "gemini-3-flash-preview",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const contentBlock = response.content[0];
    if (contentBlock.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const responseText = contentBlock.text.trim();

    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const questions = JSON.parse(jsonStr) as QuizQuestion[];

    // Add unique IDs to questions
    return questions.map((q, index) => ({
      ...q,
      id: generateQuestionId(index),
    }));
  } catch (error) {
    console.error("Error generating quiz with AI:", error);
    throw error;
  }
}

/**
 * Save quiz to JSON file
 */
function saveQuizToFile(quizData: QuizData): void {
  const filePath = path.join(QUIZ_OUTPUT_DIR, `${quizData.postSlug}.json`);

  // Pretty print JSON with 2 space indentation
  const jsonContent = JSON.stringify(quizData, null, 2);

  fs.writeFileSync(filePath, jsonContent, "utf-8");
  console.log(`Quiz saved to: ${filePath}`);
}

/**
 * Sync quiz to Convex
 */
async function syncQuizToConvex(quizData: QuizData): Promise<void> {
  const client = new ConvexHttpClient(convexUrl!);

  try {
    await client.mutation(api.quiz.syncQuiz, { quiz: quizData });
    console.log("Quiz synced to Convex successfully");
  } catch (error) {
    console.error("Error syncing quiz to Convex:", error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`📝 AI Quiz Generator`);
  console.log(`Generating quiz for post: ${postSlug}\n`);

  // Fetch post content
  console.log("Fetching post content...");
  const postData = await fetchPostContent(postSlug);

  if (!postData) {
    console.error(`Failed to fetch post "${postSlug}"`);
    process.exit(1);
  }

  console.log(`✓ Found post: ${postData.title}`);
  console.log(`✓ Content length: ${postData.content.length} characters\n`);

  // Generate quiz questions with AI
  let questions: QuizQuestion[];
  try {
    questions = await generateQuizWithAI(postData.title, postData.content, postData.description);
    console.log(`✓ Generated ${questions.length} quiz questions\n`);
  } catch (error) {
    console.error("Failed to generate quiz questions");
    process.exit(1);
  }

  // Create quiz data object
  const quizData: QuizData = {
    postSlug,
    title: `Quiz: ${postData.title}`,
    description: `Test your understanding of ${postData.title}`,
    questions,
  };

  // Save quiz to file
  saveQuizToFile(quizData);

  // Sync to Convex
  console.log("\nSyncing quiz to Convex...");
  try {
    await syncQuizToConvex(quizData);
  } catch (error) {
    console.error("Warning: Quiz saved to file but failed to sync to Convex");
    process.exit(1);
  }

  console.log("\n✅ Quiz generation complete!");
  console.log(`   Questions: ${questions.length}`);
  console.log(`   File: content/quiz/${postSlug}.json`);
  console.log(`   Run 'npm run sync:quiz' to sync manually if needed`);
}

main().catch(console.error);
