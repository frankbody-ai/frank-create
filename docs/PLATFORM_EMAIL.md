# Platform email — where it should live

## The situation

The core sends auth email (magic links, confirmations, password resets) through
**Supabase's built-in sender**: no custom SMTP, and `rate_limit_email_sent = 2`
— two emails per hour, from Supabase's shared domain.

Create Studio has proper email machinery (queue, retries, dead-letter, send log,
branded templates) which now lives on the core, but the core's auth **send-email
hook is not enabled**, so auth mail bypasses it entirely.

Nobody has noticed because everyone signs in with Google: of 5 accounts, 4 are
Google and 1 is the password test account.

## Why not simply point the hook at Create Studio

Lovable offered to point the core's hook at
`design-studio.autosolutions.app/lovable/email/auth/webhook`. It would work
today, and it is the wrong shape:

- Platform identity mail would depend on **one brand's app** being deployed and
  healthy. If Create Studio breaks, nobody can sign in to anything.
- The templates are Frank Body's. An al.ive or Enxgy person confirming their
  account would receive Frank Body branding — the exact cross-brand leak the
  platform exists to prevent.
- It puts a company-facing app in the identity path, which widens the blast
  radius of a routine studio deploy to every company's sign-in.

## What to do instead

Email is a **platform** concern, so it belongs with the hub (`autosolutions.app`),
which already knows the brand for any tenant:

1. Add a send-email webhook to the hub, and enable the core's auth hook to call
   it (`hook_send_email_enabled`, `hook_send_email_uri`).
2. Resolve branding per recipient with `brand_for(slug)` — the same source the
   apps use — so each company's mail carries its own logo, sender name and
   colours.
3. Enqueue onto the core's existing `pgmq` queues and reuse the send log, so
   retries, cooldowns and the audit trail are shared with transactional mail.
4. Send through a real provider (Resend or SES) on a domain we control, with
   SPF/DKIM, and raise `rate_limit_email_sent` accordingly.

Until that exists, leave the hook off: Supabase's sender is a working fallback
for the handful of password accounts, and enabling a half-branded path is worse
than a plain one.

## When this becomes urgent

The moment onboarding stops being "an admin adds you and you click Sign in with
Google" — invitations, password resets for non-Google accounts, or any
transactional mail to customers. At two emails per hour, the built-in sender
will fail quietly, and quiet failure in an invite flow looks like the product
being broken.
