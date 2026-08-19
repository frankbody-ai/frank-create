# Fix: Prompt Generator skips the discovery wizard on the second brief

## What's actually happening

The wizard is not decided by the agent — it is gated in the app by a single condition: it only fires when the conversation is **completely empty**.

In `PromptGenerator.tsx` the send call is `send(input, { wizardKickoff: !messages.length })`. On the first brief of a chat, `messages` is empty, so the app appends a hidden instruction asking for a JSON question set and renders it as the wizard. On every later message in that same chat, `wizardKickoff` is `false`, no question set is requested, and the brief goes to the agent as plain conversation. The agent's own protocol says anything after a delivered FINAL PROMPT is a revision, not fresh discovery — so it answers with a finished prompt instead of questions.

Your session confirms it: both sends went to the same conversation, the first came back as `DISCOVERY`, the second came back as `FINAL PROMPT`.

So today the only way to get the wizard is "+ New chat". A second, unrelated brief typed into an open chat silently loses discovery.

## What to change

1. **Treat a new brief as a new brief.** Run the wizard whenever the user submits a brief that is not a wizard answer and the thread is not mid-discovery — specifically when the thread is empty, or when the last assistant reply was a delivered final prompt. Genuine follow-ups ("make the background darker") still need to reach the agent as revisions, so the check keys off the last reply's phase, which `parseAgentReply` already gives us, and off whether the new text reads as a fresh brief rather than a tweak.

2. **Give the user explicit control instead of relying only on inference.** Add a small toggle beside the send button — "Discovery wizard: on/off" — that decides whether the next submitted brief starts the wizard. It defaults to on for the first brief and after a delivered prompt, and off while iterating on a prompt just delivered. This makes the behaviour visible and lets you force questions on any message, or skip them when you want a straight rewrite.

3. **Keep the fallback honest.** If the agent returns something that isn't a valid question set (fewer than 5 questions, malformed JSON), the reply currently drops through as a normal message with no explanation. Show a short inline note that discovery could not be built and the agent answered directly, so a silent skip is never mistaken for the bug above.

## Technical detail

- `frank-create/src/components/PromptGenerator.tsx`
  - Replace both `wizardKickoff: !messages.length` call sites with a computed `shouldRunWizard` derived from: no visible messages, or the last visible assistant reply parses as phase `final`, combined with the new toggle state.
  - Add `wizardEnabled` state, defaulting per the rule above and recomputed when a reply lands or a chat is reopened; render it as a compact toggle in the composer row.
  - In `send`, when `wizardKickoff` was requested and `parseWizardQuestions` returns `null`, set a non-blocking notice alongside the delivered reply.
- No backend or `promptAgent.ts` changes: the hidden kickoff instruction and the DISCOVERY/FINAL protocol already work; only the client's gate is wrong.
- Verify by sending two unrelated briefs in one conversation and confirming the wizard opens both times, then a tweak message after a delivered prompt goes straight to a revised prompt with no questions.
