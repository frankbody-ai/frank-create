`Sheet` replaces both `Popover` and `Modal` on a phone. Menus, filters, pickers and short forms all rise from the bottom edge into the thumb.

```jsx
<Sheet open={menu} title="Workflow actions" onClose={close}>
  <ActionList sections={[
    { items: [{ content:'Run now', icon:'play' }, { content:'Duplicate', icon:'document-duplicate' }] },
    { items: [{ content:'Delete workflow', icon:'trash', destructive:true }] },
  ]} />
</Sheet>

<Sheet open={edit} size="full" title="Edit schedule" onClose={close}
  primaryAction={<Button variant="primary" onClick={save}>Save</Button>}
  secondaryAction={<Button onClick={close}>Cancel</Button>}>
  <Select label="Trigger" options={['Schedule','Webhook','Manual']} />
</Sheet>
```

Three sizes: `auto` hugs its content (menus), `half` for pickers, `full` (88%) for a task that owns the screen. The grabber is drawn by default because it tells the user the surface is dismissible.

Inside a `MobileFrame`, `ActionList` items automatically become 44px full-bleed rows with hairline dividers — so a menu sheet needs no extra styling. Footer actions split the row equally; the primary sits on the right, same order as a desktop modal.

The layer is positioned `absolute` against the frame, not `fixed` to the window, so sheets stay inside the phone bezel in a preview.
