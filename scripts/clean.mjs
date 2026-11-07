import { lstat, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(fileURLToPath(new URL("../", import.meta.url)));
const dryRun = process.argv.includes("--dry-run");
if (process.argv.slice(2).some((arg) => arg !== "--dry-run"))
  throw new Error("Usage: npm run clean -- [--dry-run]");

// Explicitly list disposable output. Credentials, dependencies, database
// exports, migration references and Vercel project settings are never targets.
const directories = [
  "frontend/dist",
  ...["", "backend/", "frontend/"].flatMap((prefix) =>
    ["coverage", "test-results", "playwright-report"].map(
      (name) => prefix + name,
    ),
  ),
];
const logs = ["backend", "frontend"].flatMap((directory) =>
  [
    "dev-error.log",
    "dev-output.log",
    "dev-session-error.log",
    "dev-session-output.log",
  ].map((name) => `${directory}/${name}`),
);
let count = 0;
for (const relative of [...directories, ...logs]) {
  const target = path.resolve(root, relative);
  const inside = (value) => {
    const relativePath = path.relative(root, value);
    return (
      relativePath &&
      !relativePath.startsWith("..") &&
      !path.isAbsolute(relativePath)
    );
  };
  if (!inside(target))
    throw new Error("Cleanup target is outside the workspace");
  let info;
  try {
    info = await lstat(target);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  if (info.isSymbolicLink() || !inside(await realpath(target)))
    throw new Error(`Refusing cleanup through a link: ${relative}`);
  if (!dryRun) await rm(target, { recursive: info.isDirectory(), force: true });
  console.log(`${dryRun ? "Would remove" : "Removed"} ${relative}`);
  count++;
}
console.log(`${dryRun ? "Previewed" : "Cleaned"} ${count} generated paths.`);
