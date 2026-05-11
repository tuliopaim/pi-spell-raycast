#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "src/pi-spell.tsx"), "utf8");

const requiredFlags = [
  "--model",
  "--thinking",
  "-nt",
  "--no-session",
  "--no-extensions",
  "--no-skills",
  "--no-prompt-templates",
  "--no-themes",
  "-nc",
  "--print",
];

const missingFlags = requiredFlags.filter((flag) => !source.includes(`"${flag}"`));
const requiredSnippets = [
  "child.stdin.end(prompt)",
  "process.env.PI_SPELL_PI_BIN",
  "process.env.PI_BIN",
  "terminateProcess(child)",
];
const missingSnippets = requiredSnippets.filter((snippet) => !source.includes(snippet));

if (missingFlags.length > 0 || missingSnippets.length > 0) {
  console.error("Pi CLI contract check failed.");
  if (missingFlags.length > 0) {
    console.error(`Missing required Pi flags: ${missingFlags.join(", ")}`);
  }
  if (missingSnippets.length > 0) {
    console.error(`Missing required runtime behavior snippets: ${missingSnippets.join(", ")}`);
  }
  process.exit(1);
}

console.log("Pi CLI contract check passed.");
