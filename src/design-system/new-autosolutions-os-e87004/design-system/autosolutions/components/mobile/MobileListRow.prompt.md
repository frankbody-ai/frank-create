`MobileList` + `MobileListRow` are the mobile resource index. Anywhere the desktop shows a `DataTable`, the phone shows these.

```jsx
<MobileList title="Failing" action={<Button variant="plain" size="micro">See all</Button>}>
  <MobileListRow
    media={<Thumbnail size="medium" />}
    title="Contract summariser"
    subtitle="Legal · manual trigger"
    value="11"
    badge={<Badge tone="critical">Failing</Badge>}
    onClick={() => open('wf_0987')}
  />
</MobileList>
```

The columns a table would have given their own headers collapse into two lines: `title` carries the record's name at weight 550, `subtitle` carries the metadata that mattered most, and everything else is dropped rather than crammed. If three lines are genuinely needed, `meta` is there — but a fourth means the row wants to be a detail screen.

Rows are 64px (56px single-line) with a 44px floor, hairline-divided by an inset shadow so the divider never doubles at a block edge. `inset` (the default) puts the block in a 12px-radius card inside the gutter; `inset={false}` runs it edge-to-edge, which is right for settings-style bands.

`value` gets tabular numerals automatically. The chevron only appears on tappable rows — a static row with a chevron promises navigation that isn't there.
