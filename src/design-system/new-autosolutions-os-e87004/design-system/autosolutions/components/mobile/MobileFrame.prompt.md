The phone shell. `MobileFrame` is to a phone what `AppFrame` is to the desktop: it owns the status strip, the header, the scroll region and the tab bar, and every screen lives inside one.

```jsx
<PhoneFrame label="Workflows">
  <MobileFrame
    topBar={<MobileTopBar size="large" title="Workflows" app="ops-hub"
              actions={<IconButton icon="plus" label="Add workflow" variant="primary" />} />}
    tabBar={<TabBar tabs={TABS} selected={tab} onSelect={setTab} />}
  >
    <SegmentedControl options={['All','Active','Failing']} selected={view} onSelect={setView} />
    <MobileList>
      <MobileListRow title="Invoice triage" subtitle="Active · every 15 min"
        media={<Thumbnail size="medium" />} value="1,044" onClick={open} />
    </MobileList>
  </MobileFrame>
</PhoneFrame>
```

**Four things change from desktop, and only these four.** Targets grow from 28px to 44px. Type steps up one notch — 13/20 body becomes 15/20, and any input is 16px minimum because iOS Safari zooms the viewport on a smaller focused field. Tables become `MobileList` + `MobileListRow`, because a `DataTable` cannot survive 390px. Popovers and modals become `Sheet`, because anchored overlays need a cursor.

Colour, radius, elevation, motion and every semantic token are identical. Don't introduce a mobile-only colour or a second radius scale.

**The mobile top bar is light, not the desktop's `#1A1A1A`.** A dark 56px bar eats a tenth of a 390px screen and leaves no canvas; the phone keeps the inverse surface for nothing. Use `size="large"` on root screens and `size="default"` with `backAction` on pushed ones.

`MobileFrame` also resizes the shared components for you — `Button`, `TextField`, `Switch`, `Checkbox`, `Badge`, `Card` and `ActionList` all pick up touch sizing from one rule set inside the frame, so there is no mobile twin of any component to keep in sync.

Primary actions on form screens belong in `MobileToolbar` at the bottom, not in a header the thumb can't reach. `PhoneFrame` is a preview bezel only — never ship it inside an app.
