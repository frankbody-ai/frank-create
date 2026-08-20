import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, notAuthenticated, textResult } from "../supabase";
import { frankFetch } from "../frankApi";

export default defineTool({
  name: "write_prompt",
  title: "Write a prompt (Prompt Generator)",
  description:
    "Run the studio's Prompt Generator on a brief and get the crafted image prompt back. Pass the whole conversation so far in `messages` to iterate. The result can be fed straight into generate_image.",
  inputSchema: {
    brief: z
      .string()
      .describe("The brief or instruction. Shortcut for a single user message.")
      .optional(),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
          images: z.array(z.string()).optional(),
        }),
      )
      .describe("Full conversation so far (newest last). Use instead of `brief` for follow-ups.")
      .optional(),
    reference_image_urls: z
      .array(z.string())
      .describe("Public https URLs of reference images to describe alongside the brief.")
      .optional(),
    skill: z
      .string()
      .describe("Prompt Generator skill key, e.g. 'brief-to-prompt'. Defaults to brief-to-prompt.")
      .optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const refs = (input.reference_image_urls ?? []).filter((u) => /^https?:\/\//i.test(u));
    const messages = input.messages?.length
      ? input.messages
      : input.brief?.trim()
        ? [{ role: "user" as const, content: input.brief.trim() }]
        : [];
    if (!messages.length) return errorResult("Provide `brief` or `messages`.");
    if (refs.length) {
      const last = messages[messages.length - 1];
      messages[messages.length - 1] = { ...last, images: [...(last.images ?? []), ...refs] };
    }
    try {
      const data = await frankFetch<{ reply: string; model: string; skill: string }>(
        ctx,
        "/prompt-agent",
        { method: "POST", body: { messages, skill: input.skill || "brief-to-prompt" } },
      );
      return textResult({ prompt: data.reply, model: data.model, skill: data.skill });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
});
