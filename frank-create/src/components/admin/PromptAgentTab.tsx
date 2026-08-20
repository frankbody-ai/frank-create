import { useEffect, useMemo, useState } from "react";
import { Banner, Button, Card, Checkbox, Spinner, TextField } from "../../ds";
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
  /** What the form was last loaded or saved with — the baseline `dirty` compares against. */
  const [loaded, setLoaded] = useState<Defaults | null>(null);

  function apply(cfg: PromptAgentConfig | Defaults) {
    setPersona(cfg.persona);
    setCraftMethod(cfg.craftMethod);
    setConversationProtocol(cfg.conversationProtocol ?? "");
    setBlueprint(cfg.blueprint);
    setRules(cfg.rules);
    setSkills(cfg.skills.map((s) => ({ ...s })));
    setLoaded({
      persona: cfg.persona,
      craftMethod: cfg.craftMethod,
      conversationProtocol: cfg.conversationProtocol ?? "",
      blueprint: cfg.blueprint,
      rules: cfg.rules,
      skills: cfg.skills.map((s) => ({ ...s })),
    });
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

  // Was `return true`, which meant Save was never disabled. Compare against the
  // snapshot the form loaded with.
  const dirty = useMemo(() => {
    if (!loaded) return false;
    return (
      persona !== loaded.persona ||
      craftMethod !== loaded.craftMethod ||
      conversationProtocol !== loaded.conversationProtocol ||
      blueprint !== loaded.blueprint ||
      rules !== loaded.rules ||
      JSON.stringify(skills) !== JSON.stringify(loaded.skills)
    );
  }, [loaded, persona, craftMethod, conversationProtocol, blueprint, rules, skills]);

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

  if (loading) {
    return (
      <Card>
        <Spinner />
      </Card>
    );
  }

  return (
    <>
      <Banner tone="info" title="Edits go live on the next message">
        <span>
          This is exactly what the agent runs on — no redeploy.
          {updatedAt
            ? ` Last edited ${new Date(updatedAt).toLocaleString()}.`
            : " Currently running the shipped defaults."}
        </span>
      </Banner>

      {error ? <Banner tone="critical" title="That didn't save">{error}</Banner> : null}
      {status ? <Banner tone="success" title={status} /> : null}

      <div className="agent-toolbar">
        <Button
          icon="arrow-path"
          onClick={() => defaults && apply(defaults)}
          disabled={!defaults || saving}
        >
          Reset all to defaults
        </Button>
        <Button variant="primary" onClick={onSave} loading={saving} disabled={saving || !dirty}>
          Save changes
        </Button>
      </div>

      <Field
        label="Persona and role"
        hint="Who the agent is and which models it writes for."
        value={persona}
        onChange={setPersona}
        onReset={defaults ? () => setPersona(defaults.persona) : undefined}
        rows={5}
      />
      <Field
        label="Always-on craft method"
        hint="The base operating method applied on every message, whatever skill is selected."
        value={craftMethod}
        onChange={setCraftMethod}
        onReset={defaults ? () => setCraftMethod(defaults.craftMethod) : undefined}
        rows={14}
      />
      <Field
        label="Conversation protocol"
        hint="How the agent runs the discovery to final-prompt conversation: when to ask, when it may draft."
        value={conversationProtocol}
        onChange={setConversationProtocol}
        onReset={defaults ? () => setConversationProtocol(defaults.conversationProtocol) : undefined}
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
        hint="Hard rules appended last."
        value={rules}
        onChange={setRules}
        onReset={defaults ? () => setRules(defaults.rules) : undefined}
        rows={9}
      />

      <Card
        title={`Skills (${skills.length})`}
        subtitle="A skill adds one instruction on top of the always-on craft method. Inactive skills keep their text but lose their chip."
        actions={
          <Button size="micro" icon="plus" onClick={addSkill}>
            Add skill
          </Button>
        }
        padding="none"
      >
        {skills.map((skill) => (
          <div className="agent-skill" key={skill.key}>
            <div className="agent-skill__row">
              <TextField
                label="Label"
                maxWidth={220}
                value={skill.label}
                onChange={(e) => updateSkill(skill.key, { label: e.target.value })}
              />
              <TextField
                label="Key"
                maxWidth={200}
                value={skill.key}
                onChange={(e) => {
                  const next = slugify(e.target.value) || skill.key;
                  setSkills((prev) => prev.map((s) => (s.key === skill.key ? { ...s, key: next } : s)));
                }}
              />
              <Checkbox
                label="Show chip"
                checked={skill.is_active}
                onChange={(e) => updateSkill(skill.key, { is_active: e.target.checked })}
              />
              <span className="agent-skill__spacer" />
              <Button
                size="micro"
                icon="arrow-path"
                onClick={() => resetSkill(skill.key)}
                disabled={!defaults?.skills.some((s) => s.key === skill.key)}
              >
                Reset
              </Button>
              <Button size="micro" tone="critical" icon="trash" onClick={() => removeSkill(skill.key)}>
                Remove
              </Button>
            </div>
            <TextField
              label="Chip hint"
              value={skill.hint}
              onChange={(e) => updateSkill(skill.key, { hint: e.target.value })}
            />
            <TextField
              label="Instruction sent to the model"
              multiline
              rows={5}
              value={skill.instruction}
              onChange={(e) => updateSkill(skill.key, { instruction: e.target.value })}
            />
          </div>
        ))}
      </Card>
    </>
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
    <Card
      title={props.label}
      subtitle={props.hint}
      actions={
        props.onReset ? (
          <Button size="micro" icon="arrow-path" onClick={props.onReset}>
            Reset to default
          </Button>
        ) : null
      }
    >
      <TextField
        label={props.label}
        labelHidden
        multiline
        rows={props.rows}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Card>
  );
}
