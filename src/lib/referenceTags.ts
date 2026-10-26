/**
 * @ref tags in the Prompt generator, matching the Studio brief: @ref1 is the
 * first reference image attached in the chat, @ref2 the second, and so on.
 */
import { referenceTagFor } from "./studio";

export const REFERENCE_TAG_PATTERN = /@ref\d+\b/i;

/** Sent to the agent, hidden, when a message uses a tag. */
export const REFERENCE_TAG_NOTE =
  "Reference tags: @ref1 is the first reference image attached in this chat, @ref2 the second, and so on, in the order they were attached. Keep the same tags in the prompt you write: the Studio uses them for the same images.";

/** The tag being typed at the caret, if any: "@", "@re", "@ref2". */
export function detectReferenceMention(value: string, caret: number) {
  const before = value.slice(0, caret);
  const match = /(?:^|\s)@([A-Za-z0-9_]*)$/.exec(before);
  if (!match) return null;
  const query = match[1] ?? "";
  return { start: caret - query.length - 1, query };
}

export function referenceTagOptions(images: string[]) {
  return images.map((src, index) => ({ tag: referenceTagFor(index), src }));
}
