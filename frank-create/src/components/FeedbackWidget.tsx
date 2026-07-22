import React, { useEffect, useRef, useState } from "react";
import { MessageSquarePlus, X, Paperclip, Check, Loader2 } from "lucide-react";
import { submitFeedback } from "../lib/feedback";

function currentPagePath(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || window.location.pathname || "/";
}

function currentRouteName(): string {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("/review/")) return "review";
  if (hash === "/health") return "health";
  if (hash === "/cliff-access") return "cliff-access";
  if (hash === "/admin/feedback") return "admin.feedback";
  return "app";
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pagePath, setPagePath] = useState(() => currentPagePath());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setPagePath(currentPagePath());
  }, [open]);

  const reset = () => {
    setMessage("");
    setFile(null);
    setError(null);
    setSuccess(false);
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0] ?? null;
    if (!f) return setFile(null);
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Screenshot must be PNG, JPEG, or WEBP.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("Screenshot must be 3 MB or smaller.");
      return;
    }
    setFile(f);
  };

  const onSubmit = async () => {
    if (message.trim().length < 3) return;
    setSubmitting(true);
    setError(null);
    try {
      let screenshotBase64: string | null = null;
      let screenshotMime: string | null = null;
      if (file) {
        screenshotBase64 = await fileToBase64(file);
        screenshotMime = file.type;
      }
      await submitFeedback({
        message,
        pagePath,
        routeName: currentRouteName(),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent.slice(0, 500),
        screenshotBase64,
        screenshotMime,
      });
      setSuccess(true);
      setTimeout(() => close(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send feedback.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="feedback-fab"
        aria-label="Send feedback"
      >
        <span className="feedback-fab-ring" aria-hidden />
        <span className="feedback-fab-inner">
          <MessageSquarePlus size={16} />
          <span>Feedback</span>
        </span>
      </button>

      {open && (
        <div className="feedback-backdrop" onClick={close}>
          <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-modal-header">
              <h2>Send feedback</h2>
              <button type="button" onClick={close} className="feedback-icon-btn" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="feedback-modal-body">
              <div className="feedback-page-chip">
                <span>Page</span>
                <code>{pagePath}</code>
              </div>

              <textarea
                rows={5}
                maxLength={4000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's broken, confusing, or missing?"
                className="feedback-textarea"
                disabled={submitting || success}
              />

              <div className="feedback-attach-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={onPickFile}
                />
                <button
                  type="button"
                  className="feedback-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting || success}
                >
                  <Paperclip size={14} />
                  {file ? file.name : "Attach screenshot"}
                </button>
                {file && (
                  <span className="feedback-attach-size">{Math.round(file.size / 1024)} KB</span>
                )}
              </div>

              {error && <div className="feedback-error">{error}</div>}
              {success && (
                <div className="feedback-success">
                  <Check size={16} /> Thanks — feedback captured and a task was created.
                </div>
              )}
            </div>
            <div className="feedback-modal-footer">
              <button type="button" onClick={close} className="feedback-btn-ghost" disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="feedback-btn-primary"
                disabled={submitting || success || message.trim().length < 3}
              >
                {submitting ? <><Loader2 size={14} className="feedback-spin" /> Sending…</> : "Send feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
