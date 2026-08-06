import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Copy, Wand2, RotateCcw, Loader2, ImagePlus, X } from "lucide-react";
import { promptAgentChat } from "../lib/api";

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
    <main className="conversation-column prompt-agent-view">
      <header className="studio-topbar">
        <div>
          <p className="eyebrow">Agent</p>
          <h2>Prompt Generator</h2>
          <p className="studio-topbar-copy">
            Craft Image Prompts skill is always on — every message is worked through the reference-led
            blueprint. Runs on GPT-5.6 Sol via Lovable AI.
          </p>
        </div>
        <div className="studio-topbar-right">
          <button
            type="button"
            className="pc-secondary-btn"
            onClick={() => {
              setMessages([]);
              setAttachments([]);
              setError(null);
              inputRef.current?.focus();
            }}
            disabled={busy || !messages.length}
          >
            <RotateCcw size={14} /> New chat
          </button>
        </div>
      </header>

      <section className="prompt-agent-shell">
        <div className="prompt-agent-skills" role="group" aria-label="Agent skills">
          {SKILLS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`prompt-agent-skill ${skill === item.key ? "active" : ""}`}
              onClick={() => setSkill(item.key)}
              title={item.hint}
            >
              <Sparkles size={12} />
              {item.label}
            </button>
          ))}
        </div>
        <p className="prompt-agent-skill-hint">{activeSkill?.hint}</p>

        <div className="prompt-agent-thread" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="pc-empty">
              <Wand2 size={28} />
              <strong>Describe what you want to shoot.</strong>
              <span>
                e.g. “Coffee scrub tub on wet tile, morning bathroom light, glossy skin, hero e-comm shot.”
              </span>
            </div>
          ) : (
            messages.map((message, index) => {
              const prompts = message.role === "assistant" ? extractPrompts(message.content) : [];
              return (
                <div key={index} className={`prompt-agent-msg ${message.role}`}>
                  <p className="prompt-agent-msg-role">{message.role === "user" ? "You" : "Agent"}</p>
                  {message.images?.length ? (
                    <div className="prompt-agent-msg-refs">
                      {message.images.map((src, i) => (
                        <img key={i} src={src} alt={`Reference ${i + 1}`} />
                      ))}
                    </div>
                  ) : null}
                  {message.content ? <div className="prompt-agent-msg-body">{message.content}</div> : null}
                  {prompts.map((value, i) => (
                    <div className="prompt-agent-actions" key={i}>
                      <button type="button" className="pc-primary-btn" onClick={() => onUsePrompt?.(value)}>
                        <Wand2 size={14} /> Use in Studio
                      </button>
                      <button type="button" className="pc-secondary-btn" onClick={() => void copyPrompt(value)}>
                        <Copy size={14} /> Copy prompt
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
          {busy ? (
            <div className="prompt-agent-msg assistant">
              <p className="prompt-agent-msg-role">Agent</p>
              <div className="prompt-agent-msg-body prompt-agent-typing">
                <Loader2 size={14} className="spin" /> Thinking…
              </div>
            </div>
          ) : null}
        </div>

        {error ? <p className="prompt-agent-error">{error}</p> : null}

        <form
          className="prompt-agent-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          {attachments.length ? (
            <div className="prompt-agent-attachments">
              {attachments.map((src, index) => (
                <div className="prompt-agent-attachment" key={index}>
                  <img src={src} alt={`Attached reference ${index + 1}`} />
                  <button
                    type="button"
                    aria-label="Remove reference image"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <textarea
            ref={inputRef}
            value={input}
            rows={3}
            placeholder="Brief the agent… (paste or drop reference images here)"
            onChange={(event) => setInput(event.target.value)}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData?.files ?? []);
              if (files.length) {
                event.preventDefault();
                void addFiles(files);
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              if (event.dataTransfer?.files?.length) {
                event.preventDefault();
                void addFiles(event.dataTransfer.files);
              }
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void send(input);
              }
            }}
          />
          <div className="prompt-agent-composer-actions">
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
            <button
              type="button"
              className="pc-secondary-btn"
              onClick={() => fileRef.current?.click()}
              disabled={busy || attachments.length >= MAX_ATTACHMENTS}
              title="Attach reference images (or paste / drop them in the box)"
            >
              <ImagePlus size={14} /> Reference image
            </button>
            <button
              type="submit"
              className="pc-primary-btn"
              disabled={busy || (!input.trim() && !attachments.length)}
            >
              <Send size={14} /> Send
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
