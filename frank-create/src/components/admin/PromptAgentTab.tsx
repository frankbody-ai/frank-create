import { useEffect, useMemo, useState } from "react";
import {
  fetchPromptAgentConfig,
  savePromptAgentConfig,
  type PromptAgentConfig,
  type PromptAgentSkillConfig,
} from "../../lib/api";

type Defaults = Omit<PromptAgentConfig, "updatedAt">;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function PromptAgentTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [persona, setPersona] = useState("");
  const [craftMethod, setCraftMethod] = useState("");
  const [conversationProtocol, setConversationProtocol] = useState("");
  const [blueprint, setBlueprint] = useState("");
  const [rules, setRules] = useState("");
  const [skills, setSkills] = useState<PromptAgentSkillConfig[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  function apply(cfg: PromptAgentConfig | Defaults) {
    setPersona(cfg.persona);
    setCraftMethod(cfg.craftMethod);
    setConversationProtocol(cfg.conversationProtocol ?? "");
    setBlueprint(cfg.blueprint);
    setRules(cfg.rules);
    setSkills(cfg.skills.map((s) => ({ ...s })));
  }


  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPromptAgentConfig()
      .then((res) => {
        if (!alive) return;
        setDefaults(res.defaults);
        apply(res.config);
        setUpdatedAt(res.config.updatedAt ?? null);
        setError(null);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load the prompt agent config.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const dirty = useMemo(() => {
    if (!defaults) return false;
    return true;
  }, [defaults]);

  async function onSave() {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const res = await savePromptAgentConfig({ persona, craftMethod, conversationProtocol, blueprint, rules, skills });
      apply(res.config);
      setUpdatedAt(res.config.updatedAt ?? null);
      setStatus("Saved — the Prompt Generator uses this on the next message.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function updateSkill(key: string, patch: Partial<PromptAgentSkillConfig>) {
    setSkills((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function addSkill() {
    const label = "New skill";
    let key = "new-skill";
    let i = 2;
    while (skills.some((s) => s.key === key)) key = `new-skill-${i++}`;
    setSkills((prev) => [
      ...prev,
      { key, label, hint: "", instruction: "", sort_order: prev.length, is_active: true },
    ]);
  }

  function removeSkill(key: string) {
    setSkills((prev) => prev.filter((s) => s.key !== key));
  }

  function resetSkill(key: string) {
    const d = defaults?.skills.find((s) => s.key === key);
    if (d) updateSkill(key, { ...d });
  }

  if (loading) return <div className="admin-portal-loading">Loading prompt agent…</div>;

  return (
    <section className="prompt-agent-admin">
      <header className="prompt-agent-admin-head">
        <div>
          <h2>Prompt Generator instructions</h2>
          <p>
            This is exactly what the agent runs on. Edits go live on the next message — no redeploy.
            {updatedAt ? ` Last edited ${new Date(updatedAt).toLocaleString()}.` : " Currently running the shipped defaults."}
          </p>
        </div>
        <div className="prompt-agent-admin-actions">
          <button
            className="admin-portal-btn ghost"
            onClick={() => defaults && apply(defaults)}
            disabled={!defaults || saving}
          >Reset all to defaults</button>
          <button className="admin-portal-btn" onClick={onSave} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      {error ? <p className="prompt-agent-admin-error">{error}</p> : null}
      {status ? <p className="prompt-agent-admin-ok">{status}</p> : null}

      <div className="prompt-agent-admin-fields">
        <Field
          label="Persona / role"
          hint="Who the agent is and which models it writes for."
          value={persona}
          onChange={setPersona}
          onReset={defaults ? () => setPersona(defaults.persona) : undefined}
          rows={5}
        />
        <Field
          label="Always-on craft method"
          hint="The base operating method applied on every message, regardless of the selected skill."
          value={craftMethod}
          onChange={setCraftMethod}
          onReset={defaults ? () => setCraftMethod(defaults.craftMethod) : undefined}
          rows={14}
        />
        <Field
          label="Production prompt blueprint"
          hint="The section-by-section structure the final prompt follows."
          value={blueprint}
          onChange={setBlueprint}
          onReset={defaults ? () => setBlueprint(defaults.blueprint) : undefined}
          rows={14}
        />
        <Field
          label="Output rules"
          hint="Hard rules appended last (code blocks, no aspect ratio in prompt, etc.)."
          value={rules}
          onChange={setRules}
          onReset={defaults ? () => setRules(defaults.rules) : undefined}
          rows={9}
        />
      </div>

      <div className="prompt-agent-admin-skills">
        <div className="prompt-agent-admin-skills-head">
          <h3>Skills ({skills.length})</h3>
          <button className="admin-portal-btn ghost" onClick={addSkill}>+ Add skill</button>
        </div>
        {skills.map((skill, index) => (
          <div className="prompt-agent-admin-skill" key={skill.key}>
            <div className="prompt-agent-admin-skill-row">
              <label>
                <span>Label</span>
                <input
                  value={skill.label}
                  onChange={(e) => updateSkill(skill.key, { label: e.target.value })}
                />
              </label>
              <label>
                <span>Key</span>
                <input
                  value={skill.key}
                  onChange={(e) => {
                    const next = slugify(e.target.value) || skill.key;
                    setSkills((prev) => prev.map((s) => (s.key === skill.key ? { ...s, key: next } : s)));
                  }}
                />
              </label>
              <label className="prompt-agent-admin-skill-toggle">
                <input
                  type="checkbox"
                  checked={skill.is_active}
                  onChange={(e) => updateSkill(skill.key, { is_active: e.target.checked })}
                />
                <span>Show chip</span>
              </label>
              <div className="prompt-agent-admin-skill-btns">
                <button
                  className="admin-portal-btn ghost"
                  onClick={() => resetSkill(skill.key)}
                  disabled={!defaults?.skills.some((s) => s.key === skill.key)}
                >Reset</button>
                <button className="admin-portal-btn ghost" onClick={() => removeSkill(skill.key)}>Remove</button>
              </div>
            </div>
            <label className="prompt-agent-admin-field">
              <span>Chip hint</span>
              <input
                value={skill.hint}
                onChange={(e) => updateSkill(skill.key, { hint: e.target.value })}
              />
            </label>
            <label className="prompt-agent-admin-field">
              <span>Instruction sent to the model</span>
              <textarea
                rows={5}
                value={skill.instruction}
                onChange={(e) => updateSkill(skill.key, { instruction: e.target.value })}
              />
            </label>
            <input type="hidden" value={index} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Field(props: {
  label: string;
  hint: string;
  value: string;
  rows: number;
  onChange: (v: string) => void;
  onReset?: () => void;
}) {
  return (
    <div className="prompt-agent-admin-block">
      <div className="prompt-agent-admin-block-head">
        <div>
          <strong>{props.label}</strong>
          <span>{props.hint}</span>
        </div>
        {props.onReset ? (
          <button className="admin-portal-btn ghost" onClick={props.onReset}>Reset to default</button>
        ) : null}
      </div>
      <textarea rows={props.rows} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}
