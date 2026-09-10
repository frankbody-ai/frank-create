Button is the product's action control: 28px tall, 8px radius, a 12/16 label at weight 550. Secondary is the default — reach for `primary` only once per view.

```jsx
<ButtonGroup align="end">
  <Button>Export</Button>
  <Button icon="arrow-up-tray">Import</Button>
  <Button disclosure>More actions</Button>
  <Button variant="primary">Add workflow</Button>
</ButtonGroup>

<Button variant="primary" tone="critical">Delete 3 workflows</Button>
<Button variant="plain">Learn more</Button>
<Button loading>Saving</Button>
```

Labels are verb + object in sentence case, never title case and never a bare verb: "Add workflow", not "Add" or "Create New Workflow".
Primary carries a gradient plus a triple inset shadow (including a 0.5px white top line) — that treatment is what makes it read as a physical key; don't flatten it.
Pressed states swap the bevel for `--shadow-inset-200` so the control visibly depresses. Disabled never uses opacity.
`IconButton` is the 28×28 square version for toolbars and table rows and always takes a `label`.
