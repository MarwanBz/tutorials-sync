import fs from "fs";
import path from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import dotenv from "dotenv";

// Load environment variables based on SYNC_ENV
const isProduction = process.env.SYNC_ENV === "production";

if (isProduction) {
  dotenv.config({ path: ".env.production.local" });
  console.log("Syncing quizzes to PRODUCTION deployment...\n");
} else {
  dotenv.config({ path: ".env.local" });
}
dotenv.config();

// Quiz content directory
const QUIZ_DIR = path.join(process.cwd(), "content", "quiz");

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

// Parse a single quiz JSON file
function parseQuizFile(filePath: string): QuizData | null {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const quiz = JSON.parse(fileContent) as QuizData;

    // Validate required fields
    if (!quiz.postSlug || !quiz.title || !quiz.questions) {
      console.warn(`Skipping ${filePath}: missing required fields`);
      return null;
    }

    // Validate questions
    if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      console.warn(`Skipping ${filePath}: no questions found`);
      return null;
    }

    // Validate each question
    for (const q of quiz.questions) {
      if (!q.id || !q.question || !q.options || q.correctAnswer === undefined) {
        console.warn(`Skipping ${filePath}: invalid question structure`);
        return null;
      }
      if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
        console.warn(`Skipping ${filePath}: invalid correctAnswer index`);
        return null;
      }
    }

    return quiz;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

// Get all quiz JSON files from the quiz directory
function getAllQuizFiles(): string[] {
  if (!fs.existsSync(QUIZ_DIR)) {
    console.log(`No quiz directory found at ${QUIZ_DIR}`);
    return [];
  }

  const files = fs.readdirSync(QUIZ_DIR);
  return files
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(QUIZ_DIR, file));
}

// Main sync function
async function syncQuizzes() {
  console.log("Starting quiz sync...\n");

  // Get Convex URL from environment
  const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error(
      "Error: VITE_CONVEX_URL or CONVEX_URL environment variable is not set",
    );
    process.exit(1);
  }

  // Initialize Convex client
  const client = new ConvexHttpClient(convexUrl);

  // Get all quiz files
  const quizFiles = getAllQuizFiles();
  console.log(`Found ${quizFiles.length} quiz files\n`);

  if (quizFiles.length === 0) {
    console.log("No quiz files found. Create quiz JSON files in content/quiz/");
    return;
  }

  // Parse all quiz files
  const quizzes: QuizData[] = [];
  for (const filePath of quizFiles) {
    const quiz = parseQuizFile(filePath);
    if (quiz) {
      quizzes.push(quiz);
      console.log(`Parsed: ${quiz.title} (${quiz.postSlug})`);
    }
  }

  console.log(`\nSyncing ${quizzes.length} quizzes to Convex...\n`);

  // Sync quizzes to Convex
  try {
    for (const quiz of quizzes) {
      await client.mutation(api.quiz.syncQuiz, { quiz });
      console.log(`  Synced: ${quiz.title}`);
    }
    console.log("\nQuiz sync complete!");
  } catch (error) {
    console.error("Error syncing quizzes:", error);
    process.exit(1);
  }
}

// Run the sync
syncQuizzes().catch(console.error);
