import { useMemo, useState } from "react";
import { Plus, Sparkles, Trash2, Save, X, Pencil, Copy, Lock } from "lucide-react";
import type { PromptPreset } from "../lib/types";
import { improvePresetPrompt } from "../lib/api";

interface Props {
  builtinPresets: PromptPreset[];
  customPresets: PromptPreset[];
  setCustomPresets: (updater: (prev: PromptPreset[]) => PromptPreset[]) => void;
  onStatus?: (msg: string) => void;
}

type Draft = {
  key: string | null; // null = new
  label: string;
  description: string;
  prompt: string;
};

const emptyDraft: Draft = { key: null, label: "", description: "", prompt: "" };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "preset";
}

export function PresetCreator({ builtinPresets, customPresets, setCustomPresets, onStatus }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [isEditing, setIsEditing] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);

  const customKeys = useMemo(() => new Set(customPresets.map((p) => p.key)), [customPresets]);
  const status = (m: string) => onStatus?.(m);

  function startNew() {
    setDraft({ ...emptyDraft });
    setIsEditing(true);
    setImproveError(null);
  }

  function editPreset(p: PromptPreset, asCopy = false) {
    setDraft({
      key: asCopy ? null : p.key,
      label: asCopy ? `${p.label} (copy)` : p.label,
      description: p.description || "",
      prompt: p.prompt || "",
    });
    setIsEditing(true);
    setImproveError(null);
  }

  function cancelEdit() {
    setDraft(emptyDraft);
    setIsEditing(false);
    setImproveError(null);
  }

  function savePreset(e?: React.FormEvent) {
    e?.preventDefault();
    const label = draft.label.trim();
    const promptText = draft.prompt.trim();
    if (!label || !promptText) {
      setImproveError("Label and prompt are required.");
      return;
    }
    const description = draft.description.trim() || "Custom preset";
    if (draft.key && customKeys.has(draft.key)) {
      setCustomPresets((prev) =>
        prev.map((p) => (p.key === draft.key ? { key: p.key, label, description, prompt: promptText } : p)),
      );
      status(`Updated preset: ${label}`);
    } else {
      const key = `custom-${slugify(label)}-${Math.random().toString(36).slice(2, 6)}`;
      setCustomPresets((prev) => [...prev, { key, label, description, prompt: promptText }]);
      status(`Saved preset: ${label}`);
    }
    cancelEdit();
  }

  function deletePreset(key: string, label: string) {
    if (!window.confirm(`Delete preset "${label}"? This cannot be undone.`)) return;
    setCustomPresets((prev) => prev.filter((p) => p.key !== key));
    if (draft.key === key) cancelEdit();
    status(`Deleted preset: ${label}`);
  }

  async function improveWithAI() {
    const promptText = draft.prompt.trim();
    if (!promptText) {
      setImproveError("Write a draft prompt first, then let AI polish it.");
      return;
    }
    setImproving(true);
    setImproveError(null);
    try {
      const res = await improvePresetPrompt({
        prompt: promptText,
        label: draft.label.trim() || undefined,
        description: draft.description.trim() || undefined,
      });
      if (res?.prompt) {
        setDraft((d) => ({ ...d, prompt: res.prompt }));
        status("AI improved the preset prompt.");
      } else {
        setImproveError("AI returned no content. Try again.");
      }
    } catch (err) {
      setImproveError(err instanceof Error ? err.message : "Failed to improve prompt.");
    } finally {
      setImproving(false);
    }
  }

  return (
    <main className="conversation-column preset-creator-view">
      <header className="studio-topbar">
        <div>
          <p className="eyebrow">Library</p>
          <h2>Preset Creator</h2>
          <p className="studio-topbar-copy">
            Build, refine, and manage your prompt presets. Custom presets show up in the composer's Preset dropdown.
          </p>
        </div>
        <div className="studio-topbar-right">
          <button type="button" className="pc-primary-btn" onClick={startNew}>
            <Plus size={14} /> New preset
          </button>
        </div>
      </header>

      <section className="preset-creator-grid">
        <div className="preset-creator-list-col">
          <div className="section-title">
            <p className="eyebrow">Your presets</p>
            <h3>Custom ({customPresets.length})</h3>
          </div>
          {customPresets.length === 0 ? (
            <div className="pc-empty">
              <p>No custom presets yet.</p>
              <button type="button" className="pc-primary-btn" onClick={startNew}>
                <Plus size={14} /> Create your first preset
              </button>
            </div>
          ) : (
            <ul className="pc-preset-list">
              {customPresets.map((p) => (
                <li key={p.key} className={`pc-preset-row ${draft.key === p.key ? "active" : ""}`}>
                  <div className="pc-preset-row-main" onClick={() => editPreset(p)} role="button" tabIndex={0}>
                    <strong>{p.label}</strong>
                    <small>{p.description}</small>
                    <p className="pc-preset-preview">{p.prompt}</p>
                  </div>
                  <div className="pc-preset-row-actions">
                    <button type="button" title="Edit" aria-label="Edit" onClick={() => editPreset(p)}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" title="Delete" aria-label="Delete" onClick={() => deletePreset(p.key, p.label)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="section-title" style={{ marginTop: 24 }}>
            <p className="eyebrow">Built-in</p>
            <h3>Starter presets</h3>
          </div>
          <ul className="pc-preset-list">
            {builtinPresets.map((p) => (
              <li key={p.key} className="pc-preset-row is-locked">
                <div className="pc-preset-row-main">
                  <strong>
                    <Lock size={12} style={{ display: "inline", marginRight: 6, opacity: 0.6 }} />
                    {p.label}
                  </strong>
                  <small>{p.description}</small>
                  <p className="pc-preset-preview">{p.prompt}</p>
                </div>
                <div className="pc-preset-row-actions">
                  <button type="button" title="Duplicate & edit" aria-label="Duplicate" onClick={() => editPreset(p, true)}>
                    <Copy size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="preset-creator-editor-col">
          {isEditing ? (
            <form className="pc-editor-card" onSubmit={savePreset}>
              <div className="section-title">
                <p className="eyebrow">{draft.key ? "Editing" : "New preset"}</p>
                <h3>{draft.key ? draft.label || "Preset" : "Create a new preset"}</h3>
              </div>

              <label className="pc-field">
                <span>Label</span>
                <input
                  type="text"
                  value={draft.label}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  placeholder="e.g. Coffee-Scrub Hero Pack Shot"
                  maxLength={80}
                  required
                />
              </label>

              <label className="pc-field">
                <span>Short description</span>
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="e.g. Warm editorial pack shot with coffee-grain texture"
                  maxLength={140}
                />
              </label>

              <label className="pc-field">
                <span>Prompt text</span>
                <textarea
                  value={draft.prompt}
                  onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                  rows={12}
                  placeholder="Describe the shot: composition, lighting, camera, materials, mood, negatives. Use [PRODUCT NAME] as a placeholder where the brief slots in."
                  required
                />
              </label>

              {improveError ? <p className="pc-error">{improveError}</p> : null}

              <div className="pc-editor-actions">
                <button
                  type="button"
                  className="pc-improve-btn"
                  onClick={improveWithAI}
                  disabled={improving || !draft.prompt.trim()}
                  title="Rewrite this prompt with AI using image-gen best practices"
                >
                  <Sparkles size={14} />
                  {improving ? "Improving…" : "Improve this with AI"}
                </button>
                <div className="pc-editor-actions-right">
                  <button type="button" className="pc-secondary-btn" onClick={cancelEdit}>
                    <X size={14} /> Cancel
                  </button>
                  <button type="submit" className="pc-primary-btn">
                    <Save size={14} /> {draft.key ? "Save changes" : "Save preset"}
                  </button>
                </div>
              </div>

              <p className="pc-editor-hint">
                Tip: describe subject → composition → lighting → lens → materials → mood → negatives.
                Use <code>[PRODUCT NAME]</code> so the preset adapts to any brief.
                Aspect ratio, resolution, and model are chosen in the composer — don't hard-code them here.
              </p>
            </form>
          ) : (
            <div className="pc-editor-card pc-editor-placeholder">
              <Sparkles size={20} />
              <h3>Pick a preset to edit</h3>
              <p>Select one of your custom presets on the left, duplicate a starter preset, or start a new one.</p>
              <button type="button" className="pc-primary-btn" onClick={startNew}>
                <Plus size={14} /> New preset
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
