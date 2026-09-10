Card is the level-1 container for everything in the product: white, 12px radius, 16px padding, `--shadow-100`. It never gets a visible border — the hairline ring lives inside the shadow.

```jsx
<Card title="Run summary" subtitle="Last 30 days" actions={<Button>Export</Button>}>
  <Section title="Failures" variant="flat">…</Section>
  <Section variant="divided">…</Section>
</Card>

<Card title="Workflows" padding="none">
  <DataTable … />   {/* bleeds to the card edge */}
</Card>
```

Nesting changes the treatment automatically: level 1 is elevated, level 2 (`Section variant="flat"`) is a flat inset group, level 3 is a labelled block. Heading level follows nesting depth.
Card gap and padding are both 16px — don't introduce a third spacing value inside one card.
