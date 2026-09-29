# Cliff's request: Alex video access + Annie onboarding

## What I found (checked against the live accounts system)

- **Alex (alex.t@frankbody.com)** already has an account and already has Create Studio access under Frank Body. He has no feature row at all, so video is off for him.
- **Annie (annie@alivebody.com.au)** has no account yet and no pending invitation. Her al.ive company already allows the `alivebody.com.au` email domain and automatically hands out Create Studio, so once she signs in with her work Google account she gets into the Design Studio by herself.

## What I'll do

1. **Turn video on for Alex** — add his Create Studio feature record under Frank Body with video enabled and access approved. He sees the video tools next time he loads the app.
2. **Pre-invite Annie** — record an invitation for annie@alivebody.com.au under al.ive for Create Studio, so her access is on record before she signs in for the first time. Video stays off for her (nobody asked for it); it's one toggle in the admin screen later if she needs it.
3. **Verify** both records read back correctly, and confirm Annie's company really auto-grants Create Studio so her first sign-in works without any further action.

Nothing in the app's code or design changes - this is account data only.

## Technical notes

- Alex: insert into `studio.user_features` (`tenant_id` = Frank Body, `user_id` = his id) with `video_enabled = true`, `access_approved = true`.
- Annie: insert into `public.invitations` (`email`, `tenant_id` = al.ive, `os_role = member`, `app_keys = ['frank_create']`). al.ive's `entitlements` row for `frank_create` already has `auto_assign = true` and the tenant's `allowed_email_domains` includes `alivebody.com.au`.
- Both tables live in the shared AutoSolutions core project, so the writes go through the service-role API rather than this project's database tools.
