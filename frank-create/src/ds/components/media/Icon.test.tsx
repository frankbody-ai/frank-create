import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { Icon, ICON_NAMES } from "./Icon";

/*
 * The icon set is inlined at build time by a glob in Icon.tsx. `import.meta.glob`
 * returns {} for a pattern that matches nothing rather than failing, so a wrong
 * relative path there is silent: every icon renders as an empty box and the app
 * still builds, tests still pass, and the geometry still measures correctly.
 * That is exactly what shipped once. These tests make that failure loud.
 */

const { readFileSync, readdirSync } = await import("node:fs");
const { join } = await import("node:path");

describe("Icon", () => {
  it("inlined the whole set, both sizes", () => {
    const on20 = readdirSync("./src/ds/icons/20").filter((f) => f.endsWith(".svg"));
    const on16 = readdirSync("./src/ds/icons/16").filter((f) => f.endsWith(".svg"));
    expect(on20.length).toBeGreaterThan(80);
    expect(on16.length).toBeGreaterThan(50);
    // Every file on disk has to be reachable by name.
    const names = new Set(ICON_NAMES);
    for (const file of [...on20, ...on16]) {
      expect(names.has(file.replace(/\.svg$/, ""))).toBe(true);
    }
  });

  it("renders real path data, not an empty box", () => {
    const { container } = render(<Icon source="bolt" size={20} label="Generate" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("viewBox")).toBe("0 0 20 20");
    // A <path d="…"> with real geometry, not a stub.
    expect(svg!.innerHTML).toMatch(/<path[^>]+d="M[\d.]/);
  });

  it("falls back to the 20px art for a name the 16px set doesn't carry", () => {
    // 'signal' ships at 20 only; asking for 16 must still draw something.
    const { container } = render(<Icon source="signal" size={16} />);
    expect(container.querySelector("svg")!.innerHTML).toMatch(/<path/);
  });

  it("every icon name used in the app exists in the set", () => {
    // A typo'd name renders nothing and says nothing, so check them all.
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) files.push(path);
      }
    };
    walk("./src");

    const names = new Set(ICON_NAMES);
    const missing: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      for (const m of source.matchAll(/(?:source|icon|trailingIcon)="([a-z0-9-]+)"/g)) {
        if (!names.has(m[1])) missing.push(`${file}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every icon named in the navigation model exists", async () => {
    const { NAV_FOOTER, NAV_MAIN } = await import("../../../nav");
    const names = new Set(ICON_NAMES);
    for (const entry of [...NAV_MAIN, ...NAV_FOOTER]) {
      expect(names.has(entry.icon), `nav icon "${entry.icon}"`).toBe(true);
    }
  });
});
