import { describe, expect, it } from "vitest";

// Vitest runs this static contract in Node; the app build does not execute it.
const { readFileSync } = await import("node:fs");
const styles = readFileSync("./src/styles.css", "utf-8") as string;
const colors = readFileSync("./src/styles/ds/colors.css", "utf-8") as string;
const typography = readFileSync("./src/styles/ds/typography.css", "utf-8") as string;
const fonts = readFileSync("./src/styles/ds/fonts.css", "utf-8") as string;
const tenants = readFileSync("./src/styles/ds/tenants.css", "utf-8") as string;

describe("AutoSolutions OS design system", () => {
  it("imports the shipped token files rather than hand-copied values", () => {
    for (const file of ["fonts", "colors", "typography", "spacing", "radius", "elevation", "motion", "tenants", "base"]) {
      expect(styles).toContain(`@import "./styles/ds/${file}.css"`);
    }
    expect(styles).not.toContain('font-family: "Jura"');
    expect(styles).not.toContain("Founders Grotesk");
  });

  it("carries the real workspace palette", () => {
    expect(colors).toContain("--brand-magenta:#FE3CF6");
    expect(colors).toContain("--accent:var(--brand-magenta)");
    expect(colors).toContain("--accent-glow:#FF9CF4");
    expect(colors).toContain("--ink:#303030");
    expect(colors).toContain("--muted:#5E5E5E");
    expect(colors).toContain("--canvas:#E3E5E6");
    expect(colors).toContain("--surface:#FFFFFF");
    expect(colors).toContain("--series-1:#4C6FE0");
  });

  it("uses the two shipped faces only, served from the project CDN", () => {
    expect(typography).toContain("--font-display:'Google Sans','Roboto'");
    expect(typography).toContain("--font-body:'Roboto'");
    expect(fonts).toContain('font-family: "Google Sans"');
    expect(fonts).toContain('font-family: "Roboto"');
    expect(fonts).toContain("/__l5e/assets-v1/");
    expect(fonts).not.toContain("fonts.googleapis.com");
  });

  it("keeps the frank body tenant ambient ramp", () => {
    expect(tenants).toContain('[data-tenant="frank"]');
    expect(tenants).toContain("--tenant-accent:#F9ABAA");
    expect(tenants).toContain("--tenant-blob-bottom:#F9C0B9");
    expect(tenants).toContain("--tenant-blob-top:#FDEFE4");
    expect(styles).toContain("var(--tenant-blob-bottom), var(--tenant-blob-top)");
  });
});
