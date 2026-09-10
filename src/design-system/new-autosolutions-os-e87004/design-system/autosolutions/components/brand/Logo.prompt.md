The redesigned AutoSolutions OS lockup. Two official colour cuts and three locked sizes - pick one, never type your own dimensions.

```jsx
<Logo slot />              {/* 20px tall, centred in the 240×56 shell slot - what TopBar uses */}
<Logo size="compact" />    {/* 16px tall - marketing nav, footers, dense headers */}
<Logo size="large" />      {/* 28px tall - marketing hero, covers, title slides */}
```

Geometry is fixed in `tokens/logo.css`: the slot is exactly as wide as the side navigation (240px) and as tall as the top bar (56px), with the lockup centred inside it. Source art uses the official 2898.7×280.87 viewBox (10.3205:1) on a transparent ground.

Rules: never scale it freehand, stretch it, re-crop it, recolour it, add a glow or place it on a busy photograph. It needs clear space of at least half its height on every side. Use the pink cut by default and the official white cut where the pink would clash.
