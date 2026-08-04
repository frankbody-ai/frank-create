import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Copy, Wand2, RotateCcw, Loader2 } from "lucide-react";
import { promptAgentChat } from "../lib/api";

interface Props {
  onUsePrompt?: (prompt: string) => void;
  onStatus?: (msg: string) => void;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

const SKILLS = [
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
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
            A prompt-engineering agent with Frank Body craft skills. Runs on GPT-5.6 Sol via Lovable AI.
          </p>
        </div>
        <div className="studio-topbar-right">
          <button
            type="button"
            className="pc-secondary-btn"
            onClick={() => {
              setMessages([]);
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
                  <div className="prompt-agent-msg-body">{message.content}</div>
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
          <textarea
            ref={inputRef}
            value={input}
            rows={3}
            placeholder="Brief the agent…"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void send(input);
              }
            }}
          />
          <button type="submit" className="pc-primary-btn" disabled={busy || !input.trim()}>
            <Send size={14} /> Send
          </button>
        </form>
      </section>
    </main>
  );
}
