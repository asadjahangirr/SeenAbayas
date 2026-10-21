// Create/synchronise a disposable QA copy without private environment files.
// Useful when the normal workspace drive has insufficient build/trace space.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = process.cwd();
const stateFile = path.join(root, "test-results", "qa-session.json");
const temporaryRoot = path.resolve(os.tmpdir());
const synchronise = process.argv.includes("--sync");
const directory = synchronise ? JSON.parse(fs.readFileSync(stateFile, "utf8")).directory :
  fs.mkdtempSync(path.join(temporaryRoot, "seen-full-qa-"));
if (path.dirname(path.resolve(directory)) !== temporaryRoot || !path.basename(directory).startsWith("seen-full-qa-"))
  throw new Error("QA directory must be this task's direct child of the temporary directory");

const files = [...new Set(execFileSync("git", ["ls-files", "-c", "-o", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean))]
  .filter(file => !/(^|\/)\.env(?:$|\.)/.test(file) || file === ".env.example");
const fingerprint = createHash("sha256");
let copied = 0;
for (const file of files) {
  const source = path.resolve(root, file), target = path.resolve(directory, file);
  if (!source.startsWith(root + path.sep) || !target.startsWith(directory + path.sep)) throw new Error("Invalid QA source path");
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target); copied++;
  if (/\.(?:tsx?|mjs|json|sql|css)$/.test(file)) fingerprint.update(file).update(fs.readFileSync(source));
}
if (!synchronise) fs.cpSync(path.join(root, "node_modules"), path.join(directory, "node_modules"), { recursive: true, dereference: false });
const state = { directory, sourceRoot: root, sourceFingerprint: fingerprint.digest("hex"), copiedFiles: copied, updatedAt: new Date().toISOString(), includesPrivateEnv: false };
fs.mkdirSync(path.dirname(stateFile), { recursive: true });
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
fs.writeFileSync(path.join(directory, "qa-source.json"), JSON.stringify(state, null, 2));
console.log(JSON.stringify(state));
