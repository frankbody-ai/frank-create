Type primitive — every string of text in the product goes through `Text` so the applied ramp (13/20 body, 14/20 card heading) is never bypassed.

```jsx
<Text variant="headingMd" as="h3">Workflow settings</Text>
<Text tone="secondary">Runs every 15 minutes on the Melbourne node.</Text>
<Text variant="bodySm" tone="critical">0 credits remaining</Text>
<Text numeric>A$10,674.94</Text>
```

Variants: `heading3xl · heading2xl · headingXl · headingLg · headingMd · headingSm · headingXs · bodyLg · bodyMd · bodySm · bodyXs`. Default is `bodyMd` (13px/20px, weight 450) — the base size of the whole product.
Tones map to the semantic text tokens; `secondary` (#616161) is the workhorse for metadata. Use `numeric` for anything in a table column so figures align.
Hierarchy comes from weight and colour, not size: a card heading is only one step above body.
