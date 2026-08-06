import { describe, expect, it } from "vitest";

// Vitest runs this static contract in Node; the app build does not execute it.
const { readFileSync } = await import("node:fs");
const styles = readFileSync("./src/styles.css", "utf-8") as string;

describe("Frank brand theme", () => {
  it("uses the AutoSolutions OS skin fonts and colour tokens", () => {
    expect(styles).not.toContain('font-family: "Jura"');
    expect(styles).not.toContain("Founders Grotesk");
    expect(styles).toContain('--font-display: "Google Sans", "Roboto"');
    expect(styles).toContain('--font-body: "Roboto"');
    expect(styles).toContain('--font-mono: "Roboto"');
    expect(styles).toContain("--ink: #303030");
    expect(styles).toContain("--muted: #5E5E5E");
    expect(styles).toContain("--surface: #FFFFFF");
    expect(styles).toContain("--canvas: #E3E5E6");
    expect(styles).toContain("--tenant-tint: #FDF1F4");
    expect(styles).toContain("--shadow-card-glow: 0 0 10px rgba(0, 0, 0, 0.1)");
  });
});


