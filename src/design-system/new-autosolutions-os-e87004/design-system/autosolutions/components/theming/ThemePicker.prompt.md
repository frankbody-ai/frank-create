The tenant theme control — seven palettes, one selected. Put it on a settings screen; it writes `data-theme` on `<html>` and the whole product re-tints.

```jsx
<Card title="Appearance" subtitle="Applies to everyone in this workspace">
  <ThemePicker value={theme} onChange={setTheme} columns={4} />
</Card>
```

Restore the saved choice once on boot, before first paint of the shell:

```jsx
React.useEffect(() => {
  const saved = localStorage.getItem('as-theme');
  if (saved && saved !== 'ink') document.documentElement.dataset.theme = saved;
}, []);
```

Themes: `ink` (default, achromatic), `marina`, `moondust`, `sapphire`, `neptune`, `amethyst`, `opaline`.
A theme changes the accent family, the page canvas, the nav tint and the large `--theme-field` surface. It never changes the neutral ramp or the status colours — success/critical/warning/caution/info/ai stay constant so learned meaning survives a re-theme.
For a preview tile that must not change the live page, pass `apply={false}` and set `data-theme` on the tile element yourself.
