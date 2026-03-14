import fs from "fs";
import path from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import dotenv from "dotenv";

const isProduction = process.env.SYNC_ENV === "production";

if (isProduction) {
  dotenv.config({ path: ".env.production.local" });
  console.log("Syncing quizzes to PRODUCTION deployment...\n");
} else {
  dotenv.config({ path: ".env.local" });
}
dotenv.config();

const QUIZ_DIR = path.join(process.cwd(), "content", "quiz");
const shouldPrune = process.argv.includes("--prune");

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

function parseQuizFile(filePath: string): QuizData | null {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const quiz = JSON.parse(fileContent) as QuizData;

    if (!quiz.postSlug || !quiz.title || !quiz.questions) {
      console.warn(`Skipping ${filePath}: missing required fields`);
      return null;
    }

    if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      console.warn(`Skipping ${filePath}: no questions found`);
      return null;
    }

    const questionIds = new Set<string>();
    for (const [index, q] of quiz.questions.entries()) {
      if (!q.id || !q.question || !Array.isArray(q.options) || q.correctAnswer === undefined) {
        console.warn(`Skipping ${filePath}: invalid question structure at index ${index}`);
        return null;
      }

      if (questionIds.has(q.id)) {
        console.warn(`Skipping ${filePath}: duplicate question id "${q.id}"`);
        return null;
      }
      questionIds.add(q.id);

      if (q.options.length !== 4) {
        console.warn(`Skipping ${filePath}: question "${q.id}" must have exactly 4 options`);
        return null;
      }

      if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
        console.warn(`Skipping ${filePath}: invalid correctAnswer index for question "${q.id}"`);
        return null;
      }
    }

    return quiz;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

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

async function syncQuizzes() {
  console.log("Starting quiz sync...\n");
  if (shouldPrune) {
    console.log("Prune mode enabled: quizzes missing from content/quiz will be deleted in Convex.\n");
  }

  const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("Error: VITE_CONVEX_URL or CONVEX_URL environment variable is not set");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);

  const quizFiles = getAllQuizFiles();
  console.log(`Found ${quizFiles.length} quiz files\n`);

  if (quizFiles.length === 0) {
    console.log("No quiz files found. Create quiz JSON files in content/quiz/");
    return;
  }

  const publishedPosts = await client.query(api.posts.getAllPosts, {});
  const validPostSlugs = new Set(publishedPosts.map((post) => post.slug));

  const quizzes: QuizData[] = [];
  let skippedInvalid = 0;

  for (const filePath of quizFiles) {
    const quiz = parseQuizFile(filePath);
    if (!quiz) {
      skippedInvalid += 1;
      continue;
    }

    if (!validPostSlugs.has(quiz.postSlug)) {
      console.warn(
        `Skipping ${filePath}: postSlug "${quiz.postSlug}" does not exist in published posts (run npm run sync first).`,
      );
      skippedInvalid += 1;
      continue;
    }

    quizzes.push(quiz);
    console.log(`Parsed: ${quiz.title} (${quiz.postSlug})`);
  }

  if (quizzes.length === 0) {
    console.error("\nNo valid quiz files to sync.");
    if (skippedInvalid > 0) {
      console.error(`Skipped ${skippedInvalid} invalid file(s).`);
    }
    process.exit(1);
  }

  console.log(`\nSyncing ${quizzes.length} quizzes to Convex...\n`);

  try {
    const result = await client.mutation(api.quiz.syncQuizzes, {
      quizzes,
      pruneMissing: shouldPrune,
    });

    console.log("Quiz sync complete!");
    console.log(`  Upserted: ${result.upserted}`);
    if (shouldPrune) {
      console.log(`  Pruned: ${result.pruned}`);
    }

    if (skippedInvalid > 0) {
      console.log(`  Skipped invalid: ${skippedInvalid}`);
    }
  } catch (error) {
    console.error("Error syncing quizzes:", error);
    process.exit(1);
  }
}

syncQuizzes().catch(console.error);
