import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const tsconfigs = [
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
];

function logSection(title) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function logConfig(name) {
  try {
    const content = readFileSync(resolve(root, name), "utf8");
    logSection(`Compiler config: ${name}`);
    console.log(content);
  } catch (err) {
    console.error(`Could not read ${name}:`, err.message);
  }
}

function runTsc() {
  logSection("Running TypeScript compiler");
  console.log("Command: tsc -b --verbose");

  try {
    const output = execSync("npx tsc -b --verbose", {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, FORCE_COLOR: "0" },
      maxBuffer: 1024 * 1024 * 10, // 10 MB
    });
    console.log(output);
    return true;
  } catch (err) {
    console.error("\n" + "!".repeat(60));
    console.error("TypeScript build failed");
    console.error("!".repeat(60));

    if (err.stdout) {
      logSection("tsc stdout");
      console.error(err.stdout.toString());
    }
    if (err.stderr) {
      logSection("tsc stderr");
      console.error(err.stderr.toString());
    }

    logSection("Error details");
    console.error(`Exit code: ${err.status ?? "unknown"}`);
    console.error(`Signal: ${err.signal ?? "none"}`);
    if (err.message) {
      console.error(`Message: ${err.message}`);
    }

    tsconfigs.forEach(logConfig);
    return false;
  }
}

function runVite() {
  logSection("Running Vite build");
  try {
    execSync("npx vite build", {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    return true;
  } catch (err) {
    console.error("\nVite build failed");
    return false;
  }
}

// The MCP Vite plugin emits its generated edge function inside this package;
// mirror it into the repo-root functions dir the backend deploys from.
function syncMcpFunction() {
  const from = resolve(root, "supabase", "functions", "mcp", "index.ts");
  const to = resolve(root, "..", "supabase", "functions", "mcp", "index.ts");
  if (!existsSync(from)) return;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log("Synced MCP edge function to supabase/functions/mcp/index.ts");
}

const tscOk = runTsc();
if (!tscOk) {
  process.exit(1);
}

const viteOk = runVite();
if (!viteOk) {
  process.exit(1);
}

syncMcpFunction();
