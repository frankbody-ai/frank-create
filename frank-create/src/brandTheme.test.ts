import { describe, expect, it } from "vitest";

// Vitest runs this static contract in Node; the app build does not execute it.
const { readFileSync } = await import("node:fs");
const styles = readFileSync("./src/styles.css", "utf-8") as string;

describe("Frank brand theme", () => {
  it("uses the official frank body fonts and masterbrand colour tokens", () => {
    expect(styles).toContain('font-family: "Michroma"');
    expect(styles).toContain("Michroma-Regular.ttf");
    expect(styles).toContain("--pink: #ffb6a5");
    expect(styles).toContain("--ink: #3f2a2d");
    expect(styles).toContain("--white: #ffffff");
    expect(styles).toContain('--font-heading: "Michroma"');
    expect(styles).toContain('--font-body: "Michroma"');
  });
});
