import React, { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, IconButton, PageHeader, Spinner, Text, TextField } from "../ds";
import { promptAgentChat, fetchPromptAgentConfig } from "../lib/api";
import {
  deletePromptChat,
  listPromptChats,
  loadPromptChat,
  savePromptChat,
  type PromptChatSummary,
} from "../lib/promptChats";


interface Props {
  onUsePrompt?: (prompt: string, images?: string[]) => void;
  onStatus?: (msg: string) => void;
}

type ChatMessage = { role: "user" | "assistant"; content: string; images?: string[]; hidden?: boolean };

const MAX_ATTACHMENTS = 6;

/** The wizard always runs between these bounds — never fewer, never more. */
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 10;

type WizardQuestion = { question: string; why?: string; options: string[] };
type WizardState = { questions: WizardQuestion[]; index: number; answers: string[]; custom: string };

const WIZARD_INSTRUCTION = `Before drafting anything, run the discovery wizard.
Reply with NOTHING but a single fenced json block in exactly this shape:
\`\`\`json
{"questions":[{"question":"...","why":"one short line on why this matters","options":["option A","option B","option C"]}]}
\`\`\`
Rules: between ${MIN_QUESTIONS} and ${MAX_QUESTIONS} questions (never fewer than ${MIN_QUESTIONS}), ordered from most to least decisive for the final image or video. Each question needs exactly 3 concrete, mutually exclusive options written as short art-direction choices — not yes/no. Do not add a free-text option; the interface adds one. No prose outside the json block.`;

/** Reads the wizard question set out of an agent reply. Returns null when the reply isn't one. */
function parseWizardQuestions(reply: string): WizardQuestion[] | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(reply);
  const raw = (fenced ? fenced[1] : reply).trim();
  try {
    const parsed = JSON.parse(raw) as { questions?: unknown };
    const list = Array.isArray(parsed.questions) ? parsed.questions : null;
    if (!list) return null;
    const questions = list
      .map((entry): WizardQuestion | null => {
        const item = entry as { question?: unknown; why?: unknown; options?: unknown };
        const question = typeof item.question === "string" ? item.question.trim() : "";
        const options = Array.isArray(item.options)
          ? item.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).slice(0, 3)
          : [];
        if (!question || options.length < 2) return null;
        const why = typeof item.why === "string" ? item.why : undefined;
        return why ? { question, why, options } : { question, options };
      })
      .filter((q): q is WizardQuestion => q !== null)
      .slice(0, MAX_QUESTIONS);

    return questions.length >= MIN_QUESTIONS ? questions : null;
  } catch {
    return null;
  }
}





function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

const FALLBACK_SKILLS = [
  { key: "brief-to-prompt", label: "Brief → prompt", hint: "One production-ready image prompt from a rough brief." },
  { key: "variations", label: "Variations", hint: "3-5 distinct prompt variants of the same idea." },
  { key: "product-shot", label: "Product shot", hint: "Studio / e-comm product photography direction." },
  { key: "lifestyle", label: "Lifestyle & model", hint: "On-body, editorial and in-situ scenes." },
  { key: "video-prompt", label: "Video prompt", hint: "Camera move, action and pacing for video models." },
  { key: "critique", label: "Critique & fix", hint: "Diagnose a weak prompt and rewrite it." },
];


function extractPrompts(text: string): string[] {
  const blocks: string[] = [];
  const re = /```[a-zA-Z]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const value = (m[1] ?? "").trim();
    if (value) blocks.push(value);
  }
  return blocks;
}

type AgentPhase = "discovery" | "final" | "unknown";

/**
 * The agent labels every reply with DISCOVERY or FINAL PROMPT on the first line
 * (see the conversation protocol in the prompt agent config). We read that label
 * to decide whether a reply is a question round or the deliverable, then strip it
 * so the user never sees the marker.
 */
function parseAgentReply(content: string): { phase: AgentPhase; body: string } {
  const trimmed = content.trim();
  const firstBreak = trimmed.indexOf("\n");
  const head = (firstBreak === -1 ? trimmed : trimmed.slice(0, firstBreak)).trim();
  const normalized = head.replace(/[*_#`:—-]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  const rest = (firstBreak === -1 ? "" : trimmed.slice(firstBreak + 1)).trim();
  if (normalized === "DISCOVERY") return { phase: "discovery", body: rest || trimmed };
  if (normalized === "FINAL PROMPT" || normalized === "FINAL") return { phase: "final", body: rest || trimmed };
  // Unlabelled reply: a fenced block means it delivered a prompt.
  return { phase: extractPrompts(trimmed).length ? "final" : "unknown", body: trimmed };
}

/** Renders the reply body, pulling numbered question runs out into a real list. */
function AgentBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const chunks: { type: "text" | "list"; lines: string[] }[] = [];
  for (const line of lines) {
    const isItem = /^\s*\d+[.)]\s+\S/.test(line);
    const last = chunks[chunks.length - 1];
    const type = isItem ? "list" : "text";
    if (last && last.type === type) last.lines.push(line);
    else chunks.push({ type, lines: [line] });
  }
  return (
    <div className="prompt-agent-msg-body">
      {chunks.map((chunk, index) =>
        chunk.type === "list" ? (
          <ol className="prompt-agent-questions" key={index}>
            {chunk.lines.map((line, i) => (
              <li key={i}>{line.replace(/^\s*\d+[.)]\s+/, "")}</li>
            ))}
          </ol>
        ) : chunk.lines.join("\n").trim() ? (
          <p key={index}>{chunk.lines.join("\n").trim()}</p>
        ) : null

      )}
    </div>
  );
}


export function PromptGenerator({ onUsePrompt, onStatus }: Props) {
  const [skill, setSkill] = useState("brief-to-prompt");
  const [SKILLS, setSkills] = useState(FALLBACK_SKILLS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [wizardNotice, setWizardNotice] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<PromptChatSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const savedSignature = useRef<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function refreshChats() {
    listPromptChats()
      .then(setChats)
      .catch(() => {
        /* history is a convenience — never block the composer */
      });
  }

  useEffect(() => {
    inputRef.current?.focus();
    refreshChats();
  }, []);

  /** Every settled exchange is written back so the thread survives navigation. */
  useEffect(() => {
    if (busy || !messages.length) return;
    const signature = `${chatId ?? "new"}:${messages.length}:${messages[messages.length - 1]?.content.slice(0, 80)}`;
    if (savedSignature.current === signature) return;
    savedSignature.current = signature;
    void savePromptChat(chatId, skill, messages)
      .then((id) => {
        if (id && id !== chatId) setChatId(id);
        refreshChats();
      })
      .catch((err) => console.error("[prompt-chat] save failed", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, busy]);

  async function openChat(id: string) {
    try {
      const loaded = await loadPromptChat(id);
      setChatId(id);
      setMessages(loaded);
      setWizard(null);
      setWizardNotice(null);
      setAttachments([]);
      setError(null);
      savedSignature.current = `${id}:${loaded.length}:${loaded[loaded.length - 1]?.content.slice(0, 80) ?? ""}`;
      setHistoryOpen(false);
      onStatus?.("Conversation reopened.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that conversation.");
    }
  }

  function startNewChat() {
    setChatId(null);
    setMessages([]);
    setAttachments([]);
    setWizard(null);
    setWizardNotice(null);
    setError(null);
    savedSignature.current = "";
    inputRef.current?.focus();
  }

  useEffect(() => {
    let alive = true;
    fetchPromptAgentConfig()
      .then((res) => {
        if (!alive) return;
        const active = (res.config.skills || []).filter((s) => s.is_active);
        if (!active.length) return;

        setSkills(active.map((s) => ({ key: s.key, label: s.label || s.key, hint: s.hint })));
        if (!active.some((s) => s.key === skill)) setSkill(active[0]!.key);
      })
      .catch(() => {
        /* keep the built-in chips */
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function addFiles(files: FileList | File[] | null) {
    if (!files) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} reference images.`);
      return;
    }
    try {
      const urls = await Promise.all(images.slice(0, room).map(fileToDataUrl));
      setAttachments((prev) => [...prev, ...urls].slice(0, MAX_ATTACHMENTS));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  // Auto-detect whether a message starts a new run (wizard) or continues the
  // previous conversation (straight to the agent). First message always wizards.
  function shouldRunWizard(text: string): boolean {
    const visible = messages.filter((m) => !m.hidden && m.role === "assistant");
    if (!visible.length) return true;
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    const continuation =
      /^(make|change|swap|replace|remove|add|keep|use|try|adjust|tweak|shorter|longer|more|less|less |again|redo|instead|but|also|now|and|can you|could you|please make|no,|yes,)\b/i.test(
        trimmed
      ) ||
      /\b(it|that|this|the same|previous|last one|above)\b/i.test(trimmed);
    // Short, edit-flavoured follow-ups continue; anything that reads like a
    // fresh brief re-opens discovery.
    if (words <= 25 && continuation) return false;
    return true;
  }

  async function send(text: string, options?: { wizardKickoff?: boolean }) {

    const trimmed = text.trim();
    if ((!trimmed && !attachments.length) || busy) return;
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed, images: attachments.length ? attachments : undefined },
    ];
    setMessages(next);
    setInput("");
    setAttachments([]);
    setBusy(true);
    setError(null);
    setWizardNotice(null);
    try {
      // The wizard kickoff asks for a machine-readable question set. That request
      // and its json answer stay hidden from the thread — the wizard IS their UI.
      const payload: ChatMessage[] = options?.wizardKickoff
        ? [...next, { role: "user", content: WIZARD_INSTRUCTION, hidden: true }]
        : next;
      const result = await promptAgentChat({ messages: payload, skill });
      if (options?.wizardKickoff) {
        const questions = parseWizardQuestions(result.reply);
        if (questions) {
          setMessages([...payload, { role: "assistant", content: result.reply, hidden: true }]);
          setWizard({ questions, index: 0, answers: [], custom: "" });
          onStatus?.(`Discovery wizard ready — ${questions.length} questions.`);
          return;
        }
        // Discovery was requested but the agent did not return a usable question
        // set. Say so, otherwise a skipped wizard looks like a bug.
        setWizardNotice(
          "The agent could not build a discovery round for this brief, so it answered directly. Send the brief again to retry the questions."
        );
      }
      setMessages([...next, { role: "assistant", content: result.reply }]);
      onStatus?.("Prompt Generator replied.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The agent could not answer. Try again.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  /** Records an answer and either advances the wizard or submits the full set. */
  function answerWizard(answer: string) {
    if (!wizard) return;
    const answers = [...wizard.answers];
    answers[wizard.index] = answer;
    if (wizard.index + 1 < wizard.questions.length) {
      setWizard({ ...wizard, index: wizard.index + 1, answers, custom: "" });
      return;
    }
    const summary = wizard.questions
      .map((q, i) => `${i + 1}. ${q.question}\n   → ${answers[i] ?? "no preference — pick the strongest option"}`)
      .join("\n");
    setWizard(null);
    void send(`Here are my answers to the discovery questions:\n\n${summary}\n\nNow write the final production prompt.`);
  }


  async function copyPrompt(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      onStatus?.("Prompt copied to clipboard.");
    } catch {
      onStatus?.("Could not copy — select the text manually.");
    }
  }

  const activeSkill = SKILLS.find((s) => s.key === skill) ?? SKILLS[0];
  // The wizard kickoff request and its json reply are plumbing, not conversation.
  const visibleMessages = messages.filter((message) => !message.hidden);
  const activeQuestion = wizard ? wizard.questions[wizard.index] : null;





  return (
    <>
      <PageHeader
        title="Prompt generator"
        subtitle="Describe the outcome and the agent assembles the prompt. Runs on GPT-5.6 Sol via Lovable AI."
        actions={
          <>
            <Button
              icon="clock"
              pressed={historyOpen}
              onClick={() => setHistoryOpen((open) => !open)}
            >
              History{chats.length ? ` (${chats.length})` : ""}
            </Button>
            <Button icon="arrow-path" disabled={busy || !messages.length} onClick={startNewChat}>
              Start a new chat
            </Button>
          </>
        }
      />

      {historyOpen ? (
        <Card title="Past conversations" subtitle="Reopen a thread to keep working on it.">
          {chats.length ? (
            <ul className="prompt-chat-history">
              {chats.map((chat) => (
                <li key={chat.id} className={chat.id === chatId ? "is-active" : ""}>
                  <button type="button" onClick={() => void openChat(chat.id)}>
                    <span className="prompt-chat-history__title">{chat.title}</span>
                    <span className="prompt-chat-history__meta">
                      {new Date(chat.updated_at).toLocaleString()}
                      {chat.skill ? ` · ${chat.skill}` : ""}
                    </span>
                  </button>
                  <IconButton
                    icon="trash"
                    label="Delete conversation"
                    size="micro"
                    onClick={() => {
                      void deletePromptChat(chat.id)
                        .then(() => {
                          if (chat.id === chatId) startNewChat();
                          refreshChats();
                        })
                        .catch((err) => console.error("[prompt-chat] delete failed", err));
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Text as="p" tone="secondary">
              No saved conversations yet — the thread saves itself as soon as the agent replies.
            </Text>
          )}
        </Card>
      ) : null}


      <Card title="Skill" subtitle={activeSkill?.hint}>
        <div className="skill-chips" role="group" aria-label="Agent skills">
          {SKILLS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`filter-chip ${skill === item.key ? "is-selected" : ""}`}
              aria-pressed={skill === item.key}
              onClick={() => setSkill(item.key)}
              title={item.hint}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      <Card padding="none">
        <div className="agent-thread" ref={scrollRef}>
          {visibleMessages.length === 0 ? (
            <div className="empty-state empty-state--inset">
              <Text variant="headingSm" as="h3">
                Describe what you want to shoot
              </Text>
              <Text as="p" tone="secondary">
                For example: coffee scrub tub on wet tile, morning bathroom light, glossy skin, hero
                e-commerce shot. The agent then walks you through {MIN_QUESTIONS}–{MAX_QUESTIONS}
                {" "}art-direction questions before writing the prompt.
              </Text>
            </div>
          ) : (
            visibleMessages.map((message, index) => {

              const parsed =
                message.role === "assistant"
                  ? parseAgentReply(message.content)
                  : { phase: "unknown" as AgentPhase, body: message.content };
              const prompts = parsed.phase === "discovery" ? [] : extractPrompts(parsed.body);
              return (
                <div key={index} className={`agent-msg agent-msg--${message.role}`}>
                  <div className="agent-msg__role">
                    <Text variant="headingXs" as="span">
                      {message.role === "user" ? "You" : "Agent"}
                    </Text>
                    {message.role === "assistant" && parsed.phase !== "unknown" ? (
                      <Badge tone={parsed.phase === "discovery" ? "info" : "success"}>
                        {parsed.phase === "discovery" ? "Discovery" : "Final prompt"}
                      </Badge>
                    ) : null}
                  </div>
                  {message.images?.length ? (
                    <div className="agent-msg__refs">
                      {message.images.map((src, i) => (
                        <img key={i} src={src} alt={`Reference ${i + 1}`} />
                      ))}
                    </div>
                  ) : null}
                  {parsed.body ? (
                    message.role === "assistant" ? (
                      <AgentBody text={parsed.body} />
                    ) : (
                      <div className="agent-msg__body">{parsed.body}</div>
                    )
                  ) : null}
                  {prompts.map((value, i) => (
                    <React.Fragment key={i}>
                      <pre className="code-block code-block--prompt">{value}</pre>
                      <div className="agent-msg__actions">
                        <Button
                          variant="primary"
                          icon="bolt"
                          onClick={() => onUsePrompt?.(value, conversationImages())}
                        >
                          Send to Studio
                        </Button>
                        <Button icon="document-duplicate" onClick={() => void copyPrompt(value)}>
                          Copy prompt
                        </Button>
                      </div>
                    </React.Fragment>
                  ))}
                  {message.role === "assistant" &&
                  parsed.phase === "discovery" &&
                  index === visibleMessages.length - 1 ? (
                    <div className="agent-msg__actions">
                      <Button
                        icon="bolt"
                        disabled={busy}
                        onClick={() =>
                          void send(
                            "Draft it now — fill any remaining gaps with sensible defaults and list the assumptions you locked."
                          )
                        }
                      >
                        Draft it now
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          {busy ? (
            <div className="agent-msg agent-msg--assistant">
              <div className="agent-msg__role">
                <Text variant="headingXs" as="span">
                  Agent
                </Text>
              </div>
              <div className="agent-msg__body agent-msg__typing">
                <Spinner size="small" /> Thinking
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {wizard && activeQuestion ? (
        <Card padding="none">
          <section className="prompt-wizard" aria-label="Discovery wizard">
            <header className="prompt-wizard__head">
              <div>
                <p className="prompt-wizard__eyebrow">Discovery</p>
                <p className="prompt-wizard__step">
                  Question {wizard.index + 1} of {wizard.questions.length}
                </p>
              </div>
              <div className="prompt-wizard__dots" aria-hidden="true">
                {wizard.questions.map((_, i) => (
                  <span
                    key={i}
                    className={`prompt-wizard__dot${i < wizard.index ? " is-done" : ""}${i === wizard.index ? " is-active" : ""}`}
                  />
                ))}
              </div>
            </header>
            <div className="prompt-wizard__progress" aria-hidden="true">
              <span style={{ width: `${(wizard.index / wizard.questions.length) * 100}%` }} />
            </div>
            <div className="prompt-wizard__body">
              <h3 className="prompt-wizard__question">{activeQuestion.question}</h3>
              {activeQuestion.why ? <p className="prompt-wizard__why">{activeQuestion.why}</p> : null}
              <div className="prompt-wizard__options">
                {activeQuestion.options.map((option, i) => (
                  <button
                    key={option}
                    type="button"
                    className="prompt-wizard__option"
                    onClick={() => answerWizard(option)}
                  >
                    <span className="prompt-wizard__key">{String.fromCharCode(65 + i)}</span>
                    <span>{option}</span>
                  </button>
                ))}
                <div className="prompt-wizard__option prompt-wizard__option--custom">
                  <span className="prompt-wizard__key">D</span>
                  <TextField
                    label="Your own answer"
                    labelHidden
                    value={wizard.custom}
                    placeholder="Something else — type it here"
                    onChange={(event) => setWizard({ ...wizard, custom: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || event.shiftKey) return;
                      event.preventDefault();
                      if (wizard.custom.trim()) answerWizard(wizard.custom.trim());
                    }}
                  />
                  <Button
                    variant="primary"
                    icon="arrow-right"
                    disabled={!wizard.custom.trim()}
                    onClick={() => answerWizard(wizard.custom.trim())}
                  >
                    Use this
                  </Button>
                </div>
              </div>
            </div>
            <footer className="prompt-wizard__foot">
              <Button
                icon="arrow-left"
                disabled={wizard.index === 0}
                onClick={() => setWizard({ ...wizard, index: Math.max(0, wizard.index - 1), custom: "" })}
              >
                Back
              </Button>
              <span className="agent-composer__spacer" />
              <Button icon="arrow-right" onClick={() => answerWizard("no preference — pick the strongest option")}>
                Skip this one
              </Button>
              <Button
                icon="bolt"
                onClick={() => {
                  setWizard(null);
                  void send(
                    "Skip the rest of the questions — draft the final prompt now with sensible defaults and list the assumptions you locked."
                  );
                }}
              >
                Draft it now
              </Button>
            </footer>
          </section>
        </Card>
      ) : null}

      <Card>
        {wizardNotice ? (
          <div className="agent-composer__notice" role="status">
            <Text variant="bodySm" tone="caution">
              {wizardNotice}
            </Text>
          </div>
        ) : null}
        <form
          className="agent-composer"
          data-paste-scope="prompt-agent"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input, { wizardKickoff: shouldRunWizard(input) });
          }}
        >

          {attachments.length ? (
            <div className="agent-attachments">
              {attachments.map((src, index) => (
                <div className="agent-attachment" key={index}>
                  <img src={src} alt={`Attached reference ${index + 1}`} />
                  <IconButton
                    icon="x-mark"
                    label="Remove reference image"
                    size="micro"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <TextField
            label="Message"
            labelHidden
            multiline
            rows={3}
            value={input}
            inputRef={inputRef as never}
            error={error ?? undefined}
            placeholder="Brief the agent. Enter to send, Shift+Enter for a new line. Paste or drop reference images here."
            onChange={(event) => setInput(event.target.value)}
            onPaste={(event: React.ClipboardEvent) => {
              const files = Array.from(event.clipboardData?.files ?? []);
              if (files.length) {
                event.preventDefault();
                void addFiles(files);
              }
            }}
            onDragOver={(event: React.DragEvent) => event.preventDefault()}
            onDrop={(event: React.DragEvent) => {
              if (event.dataTransfer?.files?.length) {
                event.preventDefault();
                void addFiles(event.dataTransfer.files);
              }
            }}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line.
              if (event.key !== "Enter") return;
              if (event.shiftKey) return;
              event.preventDefault();
              void send(input, { wizardKickoff: shouldRunWizard(input) });
            }}

          />
          <div className="agent-composer__actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <Button
              icon="photo"
              onClick={() => fileRef.current?.click()}
              disabled={busy || attachments.length >= MAX_ATTACHMENTS}
            >
              Attach reference
            </Button>
            <span className="agent-composer__spacer" />
            <Text variant="bodySm" tone="secondary">
              Up to {MAX_ATTACHMENTS} references
            </Text>
            <Button
              variant="primary"
              icon="paper-airplane"
              type="submit"
              loading={busy}
              disabled={busy || (!input.trim() && !attachments.length)}
            >
              Send message
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
