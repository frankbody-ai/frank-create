import React, { useMemo, useState } from "react";
import { Badge, Button, Card, Icon, IconButton, PageHeader, Text, TextField } from "../ds";
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
    <>
      <PageHeader
        title="Presets"
        subtitle="A preset is a reusable paragraph appended to the brief. Custom presets appear in the Studio composer."
        actions={
          <Button variant="primary" icon="plus" onClick={startNew}>
            Add preset
          </Button>
        }
      />

      <div className="preset-columns">
        <div className="preset-list-col">
          <Card
            title="Your presets"
            subtitle={`${customPresets.length} ${customPresets.length === 1 ? "preset" : "presets"}`}
            padding="none"
          >
            {customPresets.length === 0 ? (
              <div className="empty-state empty-state--inset">
                <Text as="p" tone="secondary">
                  No custom presets yet. A preset saves the part of a brief you keep retyping.
                </Text>
                <Button variant="primary" icon="plus" onClick={startNew}>
                  Add preset
                </Button>
              </div>
            ) : (
              <ul className="preset-list">
                {customPresets.map((p) => (
                  <li key={p.key} className={`preset-row ${draft.key === p.key ? "is-selected" : ""}`}>
                    <button type="button" className="preset-row__main" onClick={() => editPreset(p)}>
                      <span className="preset-row__label">{p.label}</span>
                      <span className="preset-row__description">{p.description}</span>
                      <span className="preset-row__preview">{p.prompt}</span>
                    </button>
                    <span className="preset-row__actions">
                      <IconButton icon="pencil-square" label={`Edit ${p.label}`} size="micro" onClick={() => editPreset(p)} />
                      <IconButton
                        icon="trash"
                        label={`Delete ${p.label}`}
                        size="micro"
                        tone="critical"
                        onClick={() => deletePreset(p.key, p.label)}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Starter presets" subtitle="Read only. Duplicate one to edit it." padding="none">
            <ul className="preset-list">
              {builtinPresets.map((p) => (
                <li key={p.key} className="preset-row is-locked">
                  <span className="preset-row__main preset-row__main--static">
                    <span className="preset-row__label">
                      <Icon source="lock-closed" size={16} tone="secondary" />
                      {p.label}
                    </span>
                    <span className="preset-row__description">{p.description}</span>
                    <span className="preset-row__preview">{p.prompt}</span>
                  </span>
                  <span className="preset-row__actions">
                    <Button size="micro" icon="document-duplicate" onClick={() => editPreset(p, true)}>
                      Duplicate
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="preset-editor-col">
          {isEditing ? (
            <Card
              title={draft.key ? "Editing preset" : "New preset"}
              subtitle="Describe subject, composition, lighting, lens, materials, mood, then negatives."
              actions={<Badge tone="ai" icon="sparkles">AI assisted</Badge>}
            >
              <form className="preset-editor" onSubmit={savePreset}>
                <TextField
                  label="Label"
                  value={draft.label}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  placeholder="Coffee-scrub hero pack shot"
                  helpText="Shown in the composer's preset list."
                  maxLength={80}
                  requiredIndicator
                />
                <TextField
                  label="Short description"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Warm editorial pack shot with coffee-grain texture"
                  maxLength={140}
                />
                <TextField
                  label="Preset text"
                  multiline
                  rows={12}
                  ai
                  value={draft.prompt}
                  onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                  placeholder="Subject, composition, light, lens, materials, grade, then negatives."
                  error={improveError ?? undefined}
                  helpText="Use [PRODUCT NAME] where the brief slots in. Don't hard-code aspect ratio, resolution or model — those are run settings."
                  requiredIndicator
                />
                <div className="preset-editor__actions">
                  <Button
                    icon="sparkles"
                    loading={improving}
                    disabled={!draft.prompt.trim()}
                    onClick={improveWithAI}
                  >
                    Rewrite with AI
                  </Button>
                  <span className="preset-editor__spacer" />
                  <Button onClick={cancelEdit}>Discard changes</Button>
                  <Button variant="primary" type="submit">
                    Save preset
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card title="No preset open" subtitle="Pick one on the left, duplicate a starter, or start a new one.">
              <div className="empty-state">
                <Text as="p" tone="secondary">
                  A preset is a paragraph the composer appends to every brief that uses it.
                </Text>
                <Button variant="primary" icon="plus" onClick={startNew}>
                  Add preset
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
