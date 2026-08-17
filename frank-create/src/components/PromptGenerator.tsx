import React, { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, IconButton, PageHeader, Spinner, Text, TextField } from "../ds";
import { promptAgentChat, fetchPromptAgentConfig } from "../lib/api";

interface Props {
  onUsePrompt?: (prompt: string) => void;
  onStatus?: (msg: string) => void;
}

type ChatMessage = { role: "user" | "assistant"; content: string; images?: string[] };

const MAX_ATTACHMENTS = 6;

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
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  async function send(text: string) {
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
    try {
      const result = await promptAgentChat({ messages: next, skill });
      setMessages([...next, { role: "assistant", content: result.reply }]);
      onStatus?.("Prompt Generator replied.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The agent could not answer. Try again.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
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

  return (
    <>
      <PageHeader
        title="Prompt generator"
        subtitle="Describe the outcome and the agent assembles the prompt. Runs on GPT-5.6 Sol via Lovable AI."
        actions={
          <Button
            icon="arrow-path"
            disabled={busy || !messages.length}
            onClick={() => {
              setMessages([]);
              setAttachments([]);
              setError(null);
              inputRef.current?.focus();
            }}
          >
            Start a new chat
          </Button>
        }
      />

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
          {messages.length === 0 ? (
            <div className="empty-state empty-state--inset">
              <Text variant="headingSm" as="h3">
                Describe what you want to shoot
              </Text>
              <Text as="p" tone="secondary">
                For example: coffee scrub tub on wet tile, morning bathroom light, glossy skin, hero
                e-commerce shot.
              </Text>
            </div>
          ) : (
            messages.map((message, index) => {
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
                        <Button variant="primary" icon="bolt" onClick={() => onUsePrompt?.(value)}>
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
                  index === messages.length - 1 ? (
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

      <Card>
        <form
          className="agent-composer"
          data-paste-scope="prompt-agent"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
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
              void send(input);
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
