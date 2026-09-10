Layout primitives — `Box` is a token-bound div, `Stack` is flex with a gap, `Grid` is a column grid. Compose these instead of writing bare divs with hand-rolled padding.

```jsx
<Box background="bg-surface" padding="400" borderRadius="300" shadow="100">
  <Stack gap="300">
    <Text variant="headingMd">Today</Text>
    <Grid columns={3} gap="400">…</Grid>
  </Stack>
</Box>
```

`Stack` defaults to a column with an 8px gap; pass `direction="inline"` for a row. All spacing props take space-token keys ('400' = 16px) — pass raw px only for optical one-offs.
`Grid` accepts `minColumnWidth="280px"` for an auto-fit responsive grid instead of a fixed `columns` count.
