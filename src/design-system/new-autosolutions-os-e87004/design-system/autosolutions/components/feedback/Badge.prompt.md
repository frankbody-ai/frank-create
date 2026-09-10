Status carriers. Badge marks the state of a record; Banner explains something about the whole view.

```jsx
<Badge tone="success">Active</Badge>
<Badge tone="info">Draft</Badge>
<Badge>12 runs</Badge>                       {/* neutral count */}
<Badge tone="ai" icon="sparkles">Assisted</Badge>

<Banner tone="critical" title="3 runs failed overnight"
        action={<Button size="micro">View runs</Button>} onDismiss={dismiss}>
  The ledger connector returned 401. Reconnect it to resume the schedule.
</Banner>

<Spinner size="small" />
<Skeleton variant="text" lines={3} />
```

Status is never colour alone — a badge always carries text, validation always carries an icon plus a message.
Warning (amber) means "this will cause a problem"; caution (yellow) means "check this". They are not interchangeable.
Skeletons, not spinners, wherever the layout is predictable; the spinner is for indeterminate waits under 3 seconds.
