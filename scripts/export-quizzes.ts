import fs from "fs";
import path from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import dotenv from "dotenv";

// Load environment variables based on SYNC_ENV
const isProduction = process.env.SYNC_ENV === "production";

if (isProduction) {
  dotenv.config({ path: ".env.production.local" });
  console.log("Exporting quizzes from PRODUCTION deployment...\n");
} else {
  dotenv.config({ path: ".env.local" });
}
dotenv.config();

// Quiz content directory
const QUIZ_OUTPUT_DIR = path.join(process.cwd(), "content", "quiz");

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) {
  console.error("Error: VITE_CONVEX_URL not found in environment");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface Quiz {
  postSlug: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
}

interface QuizWithMetadata extends Quiz {
  _id: string;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

// Format quiz data for local file (remove Convex-specific metadata)
function formatQuizForFile(quiz: QuizWithMetadata): Quiz {
  return {
    postSlug: quiz.postSlug,
    title: quiz.title,
    description: quiz.description,
    questions: quiz.questions,
  };
}

async function main() {
  console.log("Exporting quizzes from Convex to JSON files...\n");

  // Ensure output directory exists
  if (!fs.existsSync(QUIZ_OUTPUT_DIR)) {
    fs.mkdirSync(QUIZ_OUTPUT_DIR, { recursive: true });
  }

  // Get all quizzes with full question data
  const quizzes = (await client.query(api.quiz.listAllWithQuestions)) as QuizWithMetadata[];

  console.log(`Found ${quizzes.length} quizzes to export\n`);

  if (quizzes.length === 0) {
    console.log("No quizzes found in Convex.");
    return;
  }

  let exportedCount = 0;
  let skippedCount = 0;

  for (const quiz of quizzes) {
    const fileName = `${quiz.postSlug}.json`;
    const filePath = path.join(QUIZ_OUTPUT_DIR, fileName);

    // Check if file already exists and compare timestamps
    if (fs.existsSync(filePath)) {
      const existing = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Quiz;
      if (existing.postSlug === quiz.postSlug && existing.title === quiz.title) {
        // Could add content comparison here if desired
        // For now, we overwrite to ensure sync
      }
    }

    try {
      const quizData = formatQuizForFile(quiz);
      fs.writeFileSync(filePath, JSON.stringify(quizData, null, 2), "utf-8");
      console.log(`  Exported: ${fileName} (${quiz.questions.length} questions)`);
      exportedCount++;
    } catch (error) {
      console.error(`  Error exporting ${fileName}:`, error);
      skippedCount++;
    }
  }

  console.log("\n-------------------------------------------");
  console.log(`Export complete!`);
  console.log(`  Exported: ${exportedCount}`);
  if (skippedCount > 0) {
    console.log(`  Skipped: ${skippedCount}`);
  }
  console.log("-------------------------------------------\n");

  if (exportedCount > 0) {
    console.log("Next steps:");
    console.log("  1. Review the exported files in content/quiz/");
    console.log("  2. Commit to git if desired");
    console.log("  3. Run 'npm run sync:quiz' to re-import if needed");
  }
}

main().catch(console.error);
