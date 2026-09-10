The application shell. `AppFrame` wires the three fixed pieces together; everything else scrolls inside it.

```jsx
<AppFrame
  topBar={<TopBar notificationCount={1} company="frankbody" />}
  navigation={<SideNav app="ops-hub" appAction={openAppMenu} items={NAV} selected={page} onSelect={setPage}
                       footerItems={[{ id:'settings', label:'Settings', icon:'cog-6-tooth' }]} />}
>
  <PageHeader title="Workflows" icon="bolt" actions={<ButtonGroup>…</ButtonGroup>} />
  <Tabs tabs={[{id:'all',label:'All',count:24},{id:'mine',label:'Mine'}]} selected={tab} onSelect={setTab} />
  <Card>…</Card>
</AppFrame>
```

Fixed geometry, don't retune it: top bar 56px on `#1A1A1A` (the only inverse surface, sticky at the top), nav 240px on `#EBEBEB` (sticky under the bar, full viewport height), content region on `#F1F1F1` with a 12px top-left radius, page column capped at 1260px with 16px gutters and 16px between sections.
The nav's own item list scrolls; `footerItems` are pinned to the bottom edge above a hairline and stay visible at every scroll position — Settings belongs there, never in the scrolling list.
The top of the nav always carries a fixed 48px white plate holding the application's label (`app`), the same 3.32:1 box as the tenant mark in the top-right — so the two read as a matched pair. It is rendered whether or not an app is set, so the nav geometry is identical in every product built on the system, and with `appAction` it becomes the app switcher.
Nav icons stay `#4A4A4A` in every state — only the row background changes, and the selected row also shifts its label to weight 550.
Page actions read secondary → secondary → menu → primary, left to right.
