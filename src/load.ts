/**
 * Load the script entry point. Loads environment variables from .env, runs the
 * Excel-to-Elasticsearch pipeline (see loadUtils.runLoader), and logs how many rows were indexed.
 */
import path from "node:path";
import dotenv from "dotenv";
import { runLoader } from "./loadUtils";

const rootDir = path.join(__dirname, "..");
dotenv.config({ path: path.join(rootDir, ".env") });

/** Runs the loader and prints the result. */
async function main(): Promise<void> {
  const { indexed, indexName } = await runLoader();
  console.log("Indexed", indexed, "rows into", indexName);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
