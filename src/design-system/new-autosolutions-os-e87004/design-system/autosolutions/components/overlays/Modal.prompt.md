Overlays. `Popover` + `ActionList` is every menu in the product; `Modal` is for a decision that must be made before continuing.

```jsx
<Popover active={open} onClose={() => setOpen(false)} align="end"
  activator={<Button disclosure onClick={() => setOpen(o => !o)}>More actions</Button>}>
  <ActionList sections={[
    { items: [{ content:'Duplicate', icon:'document-duplicate' }, { content:'Export runs', icon:'arrow-down-tray' }] },
    { items: [{ content:'Delete workflow', icon:'trash', destructive:true }] },
  ]} />
</Popover>

<Modal open={open} title="Delete 3 workflows?" size="small" onClose={close}
  primaryAction={<Button variant="primary" tone="critical">Delete workflows</Button>}
  secondaryActions={<Button onClick={close}>Cancel</Button>}>
  <Text>Their run history is kept for 30 days. This can't be undone.</Text>
</Modal>
```

Destructive confirmations name the consequence in the title rather than asking "Are you sure".
Modals trap focus and restore it on close; popovers close on outside click and Escape. Modal 300ms, popover 200ms, both on the custom `ease-out`.
