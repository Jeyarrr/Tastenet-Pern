import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const templates = [
  ".env.example",
  "backend/.env.example",
  "frontend/.env.example",
];
const isEnvironmentFile = (filename) => {
  const basename = filename.split("/").at(-1);
  return basename.startsWith(".env") || /\.env(?:\.|$)/i.test(basename);
};

const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const exposed = tracked.filter(
  (filename) => isEnvironmentFile(filename) && !templates.includes(filename),
);
if (exposed.length) {
  throw new Error(
    `Private environment files are tracked: ${exposed.join(", ")}`,
  );
}

const privateExamples = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  ".env.backup",
  "backend/.env",
  "backend/.env.local",
  "backend/credentials.env",
  "frontend/.env",
  "frontend/.env.local",
  "nested/.env",
  "nested/.env.other.example",
];
const result = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], {
  cwd,
  encoding: "utf8",
  input: [...privateExamples, ...templates].join("\n") + "\n",
});
if (result.error || ![0, 1].includes(result.status)) {
  throw (
    result.error ??
    new Error(result.stderr || "Unable to check environment ignore rules")
  );
}
const ignored = new Set(result.stdout.trim().split(/\r?\n/));
const missing = privateExamples.filter((filename) => !ignored.has(filename));
const ignoredTemplates = templates.filter((filename) => ignored.has(filename));
if (missing.length || ignoredTemplates.length) {
  throw new Error(
    `Invalid environment ignore rules: ${[...missing, ...ignoredTemplates].join(", ")}`,
  );
}
console.log(
  "Environment check passed: private files are ignored; only example templates may be tracked.",
);
