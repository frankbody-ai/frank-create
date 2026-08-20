#!/usr/bin/env node
// Fails the build if the deployed server bundle still imports anything the Cloudflare
// Workers runtime cannot resolve.
//
// The worker ships no node_modules, so a bare specifier in a *static* import is a
// guaranteed cold-start crash: `Error: No such module "<pkg>". imported from
// "server.js"`. Cloudflare fails at module instantiation, so every route 502s — app
// pages, /mcp and OAuth discovery alike — before a line of app code runs.
//
// Nitro's cloudflare-module preset is supposed to inline all of it. This proves it did,
// rather than trusting that it ran. It deliberately replaces an earlier guard that
// grepped for one hard-coded package name; that guard passed while the bundle imported
// `rou3`, and shipped a dead app.
//
// Static imports are the hard failure. Dynamic import()/require() are reported but not
// fatal: bundled libraries legitimately carry guarded optional-dependency requires
// (`react-native`, `expo-secure-store`) that never execute on Workers.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { builtinModules } from "node:module";

const SERVER_DIR = "dist/server";
const CLIENT_DIR = "dist/client";
const WRANGLER_CONFIG = join(SERVER_DIR, "wrangler.json");
const SCRIPT_EXT = /\.(m?js|cjs)$/;

// Resolvable without node_modules: node: builtins (nodejs_compat is on), the bare
// builtin aliases that compat provides, and Cloudflare's own modules.
const ALLOWED_BARE = new Set(builtinModules);
const ALLOWED_PREFIXES = ["node:", "cloudflare:", "workerd:"];

const isResolvable = (spec) =>
  spec.startsWith(".") ||
  spec.startsWith("/") ||
  ALLOWED_PREFIXES.some((p) => spec.startsWith(p)) ||
  ALLOWED_BARE.has(spec);

/**
 * Blank out comments and template literals, preserving ordinary quoted strings.
 * Without this, JSDoc examples (`* import { AppState } from 'react-native'`) and ajv's
 * codegen templates (`` `require("ajv/...").default` ``) read as real imports — both
 * appear in this app's actual bundle.
 */
function stripCommentsAndTemplates(source) {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      out += " ";
      continue;
    }
    if (c === "`") {
      i++;
      let depth = 0;
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i] === "$" && source[i + 1] === "{") { depth++; i += 2; continue; }
        if (source[i] === "}" && depth > 0) { depth--; i++; continue; }
        if (source[i] === "`" && depth === 0) { i++; break; }
        i++;
      }
      out += '""';
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      out += c;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") { out += source.slice(i, i + 2); i += 2; continue; }
        out += source[i];
        if (source[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// Anchored at statement position: bundler output always emits these at line start.
const STATIC_FROM = /^[ \t]*(?:import|export)\b[^'"]*?\bfrom[ \t]*['"]([^'"]+)['"]/gm;
const STATIC_BARE = /^[ \t]*import[ \t]*['"]([^'"]+)['"]/gm;
const DYNAMIC = /\b(?:import|require)[ \t]*\([ \t]*['"]([^'"]+)['"][ \t]*\)/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (SCRIPT_EXT.test(entry)) out.push(full);
  }
  return out;
}

const failures = [];
const warnings = [];

if (!existsSync(SERVER_DIR)) {
  failures.push(`${SERVER_DIR}/ is missing — the server build did not run.`);
} else {
  const files = walk(SERVER_DIR);
  if (files.length === 0) failures.push(`${SERVER_DIR}/ contains no JavaScript.`);

  for (const file of files) {
    const code = stripCommentsAndTemplates(readFileSync(file, "utf8"));
    const name = relative(".", file);

    const statics = new Set();
    for (const re of [STATIC_FROM, STATIC_BARE]) {
      for (const [, spec] of code.matchAll(re)) if (!isResolvable(spec)) statics.add(spec);
    }
    for (const spec of [...statics].sort()) {
      failures.push(`${name} statically imports "${spec}" — unresolvable on Workers.`);
    }

    const dynamics = new Set();
    for (const [, spec] of code.matchAll(DYNAMIC)) if (!isResolvable(spec)) dynamics.add(spec);
    for (const spec of [...dynamics].sort()) {
      warnings.push(`${name} dynamically loads "${spec}"`);
    }
  }

  if (!existsSync(WRANGLER_CONFIG)) {
    failures.push(`${WRANGLER_CONFIG} is missing — nitro's cloudflare-module preset did not run.`);
  }
}

if (!existsSync(CLIENT_DIR) || readdirSync(CLIENT_DIR).length === 0) {
  failures.push(`${CLIENT_DIR}/ is missing or empty.`);
}

if (warnings.length > 0) {
  console.log(`Note: ${warnings.length} guarded dynamic import(s) left unbundled (expected — optional deps):`);
  for (const warning of warnings) console.log(`  · ${warning}`);
}

if (failures.length > 0) {
  console.error("\nServer bundle check FAILED — this build would 502 in production:\n");
  for (const failure of failures) console.error(`  • ${failure}`);
  console.error("\nThe server build must be self-contained. Confirm nitro ran (vite.config.ts");
  console.error("uses @lovable.dev/vite-tanstack-config with `nitro: true`) rather than adding");
  console.error("package names to ssr.noExternal one at a time.\n");
  process.exit(1);
}

console.log("Server bundle check passed: dist/server has no unresolvable static imports.");
