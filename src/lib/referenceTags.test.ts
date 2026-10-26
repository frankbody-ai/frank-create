import { describe, expect, it } from "vitest";

import { REFERENCE_TAG_PATTERN, detectReferenceMention, referenceTagOptions } from "./referenceTags";

describe("Prompt generator reference tags", () => {
  it("numbers images in the order they were attached, like the Studio", () => {
    expect(referenceTagOptions(["a.png", "b.png"])).toEqual([
      { tag: "@ref1", src: "a.png" },
      { tag: "@ref2", src: "b.png" }
    ]);
  });

  it("finds the tag being typed at the caret", () => {
    expect(detectReferenceMention("Use @", 5)).toEqual({ start: 4, query: "" });
    expect(detectReferenceMention("Use @ref", 8)).toEqual({ start: 4, query: "ref" });
    expect(detectReferenceMention("@r", 2)).toEqual({ start: 0, query: "r" });
  });

  it("ignores an @ inside a word, like an email address", () => {
    expect(detectReferenceMention("cliff@frank", 11)).toBeNull();
    expect(detectReferenceMention("Use @ref1 now", 13)).toBeNull();
  });

  it("knows when a message uses a tag", () => {
    expect(REFERENCE_TAG_PATTERN.test("keep the bottle from @ref2")).toBe(true);
    expect(REFERENCE_TAG_PATTERN.test("no tags here")).toBe(false);
  });
});
