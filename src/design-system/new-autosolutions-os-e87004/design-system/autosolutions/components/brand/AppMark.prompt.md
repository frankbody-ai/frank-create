The label for one application in the hub. It sits in the nav plate at the top of the side navigation, where a typed app name would otherwise go, and doubles as the app switcher.

```jsx
<AppMark app="ops-hub" />                    {/* 159×48, the nav plate */}
<AppMark app="franks-kitchen" size="compact" /> {/* 106×32, switcher rows and lists */}
```

Thirteen apps ship, grouped as `APP_GROUPS`: **Marketing** (Revenue · Content & Social · Design), **Operations**, **Sales**, **Internal Comms**.

The artwork is generated, not hand-set: every label is 1234×372 — the same box as a company mark, so the app label at top-left and the tenant mark at top-right read as a matched pair — set in Inter Display SemiBold ink at one cap height across the whole set, behind the magenta pipe borrowed from the `autosolutions|OS` lockup. Adding an app means generating a label the same way, never typing the name into the plate.

Labels are ink on transparent, for light surfaces. `label-maker` carries a `url` and opens externally.
