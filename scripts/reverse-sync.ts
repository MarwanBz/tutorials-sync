import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import dotenv from "dotenv";

// Load environment variables based on SYNC_ENV
const isProduction = process.env.SYNC_ENV === "production";

if (isProduction) {
  dotenv.config({ path: ".env.production.local" });
  console.log("Reverse syncing from PRODUCTION deployment...\n");
} else {
  dotenv.config({ path: ".env.local" });
}
dotenv.config();

// TUTORIAL SYNC: Point to coding-tutor-tutorials directory
const CONTENT_DIR = path.join(process.env.HOME || process.env.USERPROFILE || "", "coding-tutor-tutorials");

// Main reverse sync function
async function reverseSync() {
  console.log("Starting reverse sync...\n");

  // Get Convex URL from environment
  const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("Error: VITE_CONVEX_URL or CONVEX_URL environment variable is not set");
    process.exit(1);
  }

  // Initialize Convex client
  const client = new ConvexHttpClient(convexUrl);

  // Check if content directory exists
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`Error: Tutorial directory not found: ${CONTENT_DIR}`);
    console.log("Ensure the coding-tutor-tutorials directory exists.");
    process.exit(1);
  }

  // Fetch all posts from Convex
  console.log("Fetching tutorials from Convex...");
  void (await client.query(api.posts.listAll));

  // Filter posts that have quiz results (understanding_score is not null)
  // Note: listAll doesn't return tutorial fields, so we'll create a dummy score for now
  // This script will be functional once quiz results are being saved
  const tutorialsWithScores: Array<{
    slug: string;
    understanding_score: number | null;
    last_quizzed: string | null;
  }> = [];

  // TODO: Once quiz mutations are implemented, fetch actual quiz results
  // For now, this script provides the structure for reverse sync

  console.log(`Found ${tutorialsWithScores.length} tutorials with quiz scores\n`);

  if (tutorialsWithScores.length === 0) {
    console.log("No tutorials with quiz scores found. Nothing to sync.");
    console.log("(This is expected until quiz functionality is implemented)");
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Update each tutorial's markdown file
  for (const tutorial of tutorialsWithScores) {
    const filePath = path.join(CONTENT_DIR, `${tutorial.slug}.md`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping: File not found for "${tutorial.slug}" (${filePath})`);
      skipped++;
      continue;
    }

    try {
      // Read the markdown file
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(fileContent);

      // Check if frontmatter needs updating
      const currentScore = data.understanding_score;
      const currentQuizzed = data.last_quizzed;
      const newScore = tutorial.understanding_score;
      const newQuizzed = tutorial.last_quizzed;

      // Skip if no changes needed
      if (currentScore === newScore && currentQuizzed === newQuizzed) {
        console.log(`No changes: ${tutorial.slug}`);
        skipped++;
        continue;
      }

      // Update frontmatter with quiz results
      const newData = {
        ...data,
        understanding_score: newScore,
        last_quizzed: newQuizzed,
      };

      // Rebuild the file with updated frontmatter
      const newContent = matter.stringify(content, newData);

      // Write back to file
      fs.writeFileSync(filePath, newContent, "utf-8");

      console.log(`Updated: ${tutorial.slug} (score: ${newScore}, quizzed: ${newQuizzed || "N/A"})`);
      updated++;
    } catch (error) {
      console.error(`Error updating ${tutorial.slug}:`, error);
      errors++;
    }
  }

  console.log(`\nReverse sync complete!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);

  if (errors > 0) {
    process.exit(1);
  }
}

// Run the reverse sync
reverseSync().catch(console.error);
