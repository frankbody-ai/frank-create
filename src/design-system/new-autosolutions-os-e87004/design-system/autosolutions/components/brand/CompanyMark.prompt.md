Company marks and the company switcher.

```jsx
{/* The standard switcher — every app, every surface. */}
<CompanySwitcher company="frankbody" open={menuOpen} onClick={() => setMenuOpen(o => !o)} />

{/* A mark on its own */}
<CompanyMark company="enxgy" />                    {/* white cut, dark surface */}
<CompanyMark company="enxgy" cut="ink" />          {/* light surface */}
<CompanyMark company="enxgy" size="compact" cut="ink" />  {/* menu row, table cell */}
```

**`CompanySwitcher` is the one treatment across the whole system** — top bar, mobile header, settings. The mark sits on whatever is behind it with a disclosure chevron to its right: transparent at rest, the faintest wash on hover and while open, chevron rotating when the menu opens. **Never put a plate behind it.** A plate makes seven different logos look like seven different buttons, and it fought every brand's own shape.

Three cuts, and the surface decides:

| Cut | Art | Use on |
|---|---|---|
| `white` (default) | single colour, transparent ground | dark surfaces — the `#1A1A1A` top bar |
| `ink` | single colour `#303030`, transparent ground | light surfaces — white cards, switcher menu rows, settings |
| `full` | the brand's own colour plate | only where a brand's colour field is genuinely wanted |

Getting this backwards is the easy mistake: the bar takes `white`, but the **menu that drops out of it is a white popover**, so its rows take `ink`.

**Height is locked; width follows the art.** Each cut carries its own `aspect-ratio`, so `enxgy` and `Senior Snouts` are not padded to the same box. **Never set a width on `.as-company`** — that padding is exactly what made the chevron sit a different distance from every logo.

One thing worth knowing: frank body's own logo is two outlined boxes, so a faint rectangle is correct for them. That is the brand's rectangle at brand weight, not a UI plate.
