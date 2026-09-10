Icon renders a masked SVG from `/assets/icons` so it always paints in `currentColor`-compatible token colours.

```jsx
<Icon source="bolt" />                       {/* 20px, #4A4A4A */}
<Icon source="check-circle" tone="success" />
<Icon source="chevron-down" size={16} tone="secondary" />
```

Two sizes only: **20** for the vast majority, **16** for inline/dense contexts (both sets ship in `/assets/icons/20` and `/assets/icons/16`).
Before mounting, set the base path once: `window.AS_ICON_BASE = '../../assets/icons'` (relative to the page). Inside buttons and links pass `tone="inherit"` so the icon follows the label colour.
Never use `tone="secondary"` for an icon that carries meaning alone — #8A8A8A on white is ~3.5:1 and only passes as a non-text graphic.
