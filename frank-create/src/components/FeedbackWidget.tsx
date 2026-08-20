import React, { useEffect, useRef, useState } from "react";
import { Banner, Button, Icon, Modal, Text, TextField } from "../ds";
import { submitFeedback } from "../lib/feedback";

function currentPagePath(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || window.location.pathname || "/";
}

function currentRouteName(): string {
  const hash = window.location.hash.replace(/^#/, "").split("?")[0] || "";
  const path = hash || window.location.pathname.replace(/\/$/, "") || "/";
  if (path === "/health") return "health";
  if (path === "/settings") return "settings";
  if (path === "/admin/feedback") return "admin.feedback";
  if (path === "/admin") return "admin";
  const view =
    typeof document !== "undefined" ? document.body.dataset.feedbackView : undefined;
  return view ? `app.${view}` : "app";
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

export function FeedbackWidget({ variant = "fixed" }: { variant?: "fixed" | "inline" }) {
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
      {variant === "inline" ? (
        <Button icon="chat-bubble-left-right" onClick={() => setOpen(true)}>
          Send feedback
        </Button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="feedback-fab">
          <Icon source="chat-bubble-left-right" size={16} tone="inherit" />
          <span>Feedback</span>
        </button>
      )}

      <Modal
        open={open}
        title="Send feedback"
        size="small"
        onClose={close}
        secondaryActions={
          <Button onClick={close} disabled={submitting}>
            Cancel
          </Button>
        }
        primaryAction={
          <Button
            variant="primary"
            onClick={onSubmit}
            loading={submitting}
            disabled={submitting || success || message.trim().length < 3}
          >
            Send feedback
          </Button>
        }
      >
        <div className="feedback-form" data-paste-scope="feedback">
          <div className="feedback-form__page">
            <Text variant="bodySm" tone="secondary">
              Page
            </Text>
            <code>{pagePath}</code>
          </div>

          <TextField
            label="What's broken, confusing, or missing?"
            multiline
            rows={5}
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe what you did, what you expected, and what happened instead."
            disabled={submitting || success}
          />

          <div className="feedback-form__attach">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={onPickFile}
            />
            <Button
              icon="photo"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || success}
            >
              {file ? file.name : "Attach a screenshot"}
            </Button>
            {file ? (
              <Text variant="bodySm" tone="secondary" numeric>
                {Math.round(file.size / 1024)} KB
              </Text>
            ) : null}
          </div>

          {error ? (
            <Banner tone="critical" title="That didn't send">
              <span>{error}</span>
            </Banner>
          ) : null}
          {success ? (
            <Banner tone="success" title="Thanks — feedback captured">
              <span>A triage task was created for it.</span>
            </Banner>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
