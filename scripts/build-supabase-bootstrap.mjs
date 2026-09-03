import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationsDir = resolve(root, "infra/supabase/migrations");
const output = resolve(root, "infra/supabase/bamboo-icongen-bootstrap.sql");
const files = (await readdir(migrationsDir))
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort();

if (files.length === 0) {
  throw new Error("No Supabase migrations found.");
}

const sections = await Promise.all(files.map(async (file) => {
  const sql = await readFile(resolve(migrationsDir, file), "utf8");
  return `-- ============================================================================\n-- ${file}\n-- ============================================================================\n\nbegin;\n\n${sql.trim()}\n\ncommit;\n`;
}));

const header = `-- Bamboo IconGen initial Supabase database setup\n-- Generated from infra/supabase/migrations in filename order.\n-- Run once on a new Supabase project using Dashboard -> SQL Editor.\n\n`;

await writeFile(output, `${header}${sections.join("\n")}`, "utf8");
console.log(`Generated ${output} from ${files.length} migrations.`);
