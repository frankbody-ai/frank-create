import { describe, expect, it } from "vitest";

/*
 * A static contract over the vendored design system.
 *
 * These are the values the system calls load-bearing — the ones where being
 * approximately right is being wrong. It runs in Node against the files on
 * disk; the app build never executes it.
 *
 * If a re-sync of src/ds/ changes one of these, that is a real design change
 * and should be read, not silently absorbed by loosening the assertion.
 */
const { readFileSync } = await import("node:fs");
const read = (p: string) => readFileSync(p, "utf-8") as string;

const app = read("./src/app.css");
const entry = read("./src/ds/ds.css");
const colors = read("./src/ds/tokens/colors.css");
const typography = read("./src/ds/tokens/typography.css");
const fonts = read("./src/ds/tokens/fonts.css");
const shape = read("./src/ds/tokens/shape.css");
const spacing = read("./src/ds/tokens/spacing.css");
const elevation = read("./src/ds/tokens/elevation.css");
const layout = read("./src/ds/tokens/layout.css");
const themes = read("./src/ds/tokens/themes.css");
const brand = read("./src/ds/components/brand/brand.css");

describe("AutoSolutions OS design system", () => {
  it("is imported once, as a whole, from the app stylesheet", () => {
    expect(app).toContain('@import "./ds/ds.css"');
    for (const file of [
      "fonts", "colors", "typography", "spacing", "shape", "elevation",
      "motion", "layout", "logo", "company", "app", "themes", "base",
    ]) {
      expect(entry).toContain(`@import url("./tokens/${file}.css")`);
    }
    expect(entry).toContain('@import url("./components/components.css")');
  });

  it("does not import the marketing layer into a product surface", () => {
    // Layer A and Layer B are different languages; the system says never mix
    // them in one view, and this app is entirely Layer A.
    expect(entry).not.toMatch(/@import[^;\n]*brand-marketing/);
  });

  it("runs Inter at the system's non-standard optical weights", () => {
    // 400/500/600/700 will not match: the raised body weight and the
    // suppressed bold are why the UI reads evenly.
    expect(typography).toContain("--font-weight-regular:450");
    expect(typography).toContain("--font-weight-medium:550");
    expect(typography).toContain("--font-weight-semibold:600");
    expect(typography).toContain("--font-weight-bold:650");
  });

  it("sets body at 13px/20px, one step below the default card heading", () => {
    expect(typography).toContain("--font-size-325:.8125rem");
    expect(typography).toContain("--type-body-md-size:var(--font-size-325)");
    expect(typography).toContain("--type-body-md-line:var(--font-line-height-500)");
    // The card heading is 14/20 at 600 — one step above body, not three.
    expect(typography).toContain("--type-heading-md-size:var(--font-size-350)");
  });

  it("self-hosts the two Inter cuts and never reaches for a CDN", () => {
    expect(fonts).toContain('font-family:"Inter"');
    expect(fonts).toContain('font-family:"Inter Display"');
    expect(fonts).toContain("/fonts/InterVariable.woff2");
    expect(fonts).toContain("/fonts/InterDisplay-SemiBold.woff2");
    expect(fonts).not.toContain("fonts.googleapis.com");
    expect(fonts).not.toContain("fonts.gstatic.com");
    // The faces this replaced.
    expect(fonts).not.toContain("Google Sans");
    expect(fonts).not.toContain("Roboto-Variable");
  });

  it("carries the 17-step neutral ramp end to end", () => {
    expect(colors).toContain("--color-gray-0:#FFFFFF");
    expect(colors).toContain("--color-gray-1000:#0A0A0A");
    // The three asymmetries that give the system its character.
    expect(colors).toContain("--color-text:var(--color-gray-950)"); // #303030, not black
    expect(colors).toContain("--color-icon:var(--color-gray-900)"); // one step lighter than text
    expect(colors).toContain("--color-bg:var(--color-gray-150)"); // #F1F1F1 page, white cards
    expect(colors).toContain("--color-bg-surface:var(--color-gray-0)");
  });

  it("keeps warning and caution distinct, and text-on-fill hue-tinted", () => {
    expect(colors).toContain("--color-warning-fill:#FFB800");
    expect(colors).toContain("--color-caution-fill:#FFE600");
    // Caution fails with white; it carries its own dark on-fill text.
    expect(colors).toContain("--color-caution-text-on-fill:#332E00");
    // "Text on fill" is never pure white.
    expect(colors).toContain("--color-success-text-on-fill:#FAFFFB");
    expect(colors).toContain("--color-critical-text-on-fill:#FFFAFB");
  });

  it("keeps the hairline ring inside the card shadow", () => {
    // The page is #F1F1F1 and cards are white — about 6% apart. Without this
    // ring the card has no edge at all.
    expect(elevation).toContain("0 0 0 1px rgba(0,0,0,.06)");
    expect(elevation).toContain("--shadow-card:var(--shadow-100)");
    // The primary button is a fill plus gradient plus triple inset.
    expect(elevation).toContain("--button-primary-gradient:linear-gradient(180deg,rgba(48,48,48,0) 63.53%");
  });

  it("holds the two-radius rhythm and the measured density", () => {
    expect(shape).toContain("--radius-200:.5rem"); // 8 — anything you click
    expect(shape).toContain("--radius-300:.75rem"); // 12 — anything containing things
    expect(shape).toContain("--radius-control:var(--radius-200)");
    expect(shape).toContain("--radius-container:var(--radius-300)");
    expect(spacing).toContain("--control-height:1.75rem"); // 28px buttons
    expect(spacing).toContain("--badge-height:1.25rem"); // 20px badges
    expect(spacing).toContain("--field-min-height:var(--space-800)"); // 32px fields
    expect(spacing).toContain("--row-height:3.25rem"); // 52px table rows
    expect(spacing).toContain("--card-padding:var(--space-400)"); // 16px
    expect(spacing).toContain("--card-gap:var(--space-400)"); // 16px
  });

  it("holds the shell geometry the layout depends on", () => {
    expect(layout).toContain("--topbar-height:3.5rem"); // 56
    expect(layout).toContain("--sidenav-width:15rem"); // 240
    expect(layout).toContain("--nav-appname-height:3rem"); // 48 plate
    expect(layout).toContain("--page-max-width:78.75rem"); // 1260
    expect(layout).toContain("--breakpoint-sm:30.625rem"); // 490
  });

  it("ships all seven themes and leaves status colours alone", () => {
    for (const id of ["marina", "moondust", "sapphire", "neptune", "amethyst", "opaline"]) {
      expect(themes).toContain(`[data-theme="${id}"]`);
    }
    // ink is the default and carries no attribute, so it must not appear as a scope.
    expect(themes).not.toContain('[data-theme="ink"]');
    // A theme re-points the accent, canvas and nav tint — never the status ramps.
    expect(themes).not.toContain("--color-success-fill:");
    expect(themes).not.toContain("--color-critical-fill:");
  });

  it("serves brand art from /public and ships only the marks this app uses", () => {
    expect(brand).toContain('url("/brand/logo.png")');
    expect(brand).toContain('url("/brand/companies/frankbody-plain.png")');
    expect(brand).toContain('url("/brand/apps/design-studio-label.png")');
    // App labels are wordmarks: one shared cap height, width from the
    // per-label aspect-ratio. A fixed width is what makes a switcher ragged.
    expect(brand).toContain("aspect-ratio:8.2214");
    expect(brand).toMatch(/\.as-app\{[^}]*width:auto/);
    expect(brand).not.toMatch(/\.as-app--[a-z-]+\{[^}]*width:\s*\d/);
  });

  it("leaves the previous system behind entirely", () => {
    const everything = [app, entry, colors, typography, fonts].join("\n");
    expect(everything).not.toContain("#FE3CF6"); // the old magenta accent
    expect(everything).not.toContain("--tenant-blob");
    expect(everything).not.toContain("data-tenant");
    expect(everything).not.toContain("Founders Grotesk");
  });
});
