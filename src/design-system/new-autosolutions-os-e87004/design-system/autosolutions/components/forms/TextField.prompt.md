Form controls. Every field is at least 32px tall with an 8px radius, a 12px/550 label above it, and an explicit error state — validation lives inline under the field, never in a banner.

```jsx
<TextField label="Workflow name" value={name} onChange={e => setName(e.target.value)} helpText="Shown in run history." />
<TextField label="Budget" prefix="A$" type="number" defaultValue="1200" />
<TextField label="Webhook URL" error="Enter a valid https:// URL" defaultValue="htp://" />
<TextField label="Prompt" multiline ai placeholder="Describe what this agent should do" />
<Select label="Trigger" options={['Schedule','Webhook','Manual']} />
<Checkbox label="Retry failed steps" helpText="Up to 3 attempts, 30s apart." defaultChecked />
<RadioButton name="mode" label="Run in sandbox" defaultChecked />
<Switch label="Active" checked={on} onChange={setOn} />
```

Give every `Switch` a `label` — it becomes the accessible name. When a row title or card heading already names the control, add `labelHidden` so the name survives for screen readers but the visible text isn't duplicated beside it.

Error copy states what went wrong then what to do, in that order. Help text is `bodySm` in secondary; it disappears while an error is showing.
`ai` tints a field with the AI token set — use it only for genuinely generated or assisted input, never for decoration.
