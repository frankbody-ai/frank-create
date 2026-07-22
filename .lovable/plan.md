## Plan to fix Reve failures

I checked the current Reve path and the live connector. The Replicate connection is linked and the Reve model is reachable through the Lovable gateway; its schema confirms the app should send only `prompt`, `aspect_ratio`, and optional `reference_images`.

### What I’ll change
1. **Use the correct Replicate connector secret consistently**
   - Update the `frank-generate` function so Replicate calls read the linked connector secret expected by the gateway.
   - Keep `LOVABLE_API_KEY` as the gateway bearer token.

2. **Add live provider diagnostics for Reve**
   - Log the Replicate create/poll status and provider error body when Reve fails.
   - Preserve the user-facing mapped errors, but include enough raw detail in the expandable panel to know whether it is auth, invalid params, quota, timeout, or empty output.

3. **Harden the Reve output parser**
   - Reve returns a plain string URL on success, but I’ll keep support for arrays/objects so future output changes don’t show “Provider returned no image.”

4. **Validate the deployed function with a real Reve request**
   - Deploy `frank-generate`.
   - Call it with a simple Reve prompt and a known-supported ratio like `16:9`.
   - Confirm it returns an image URL instead of the stale `401` / `Provider returned no image` failure.

### Technical notes
- No database schema changes are needed.
- No UI redesign is needed unless the deployed test reveals a frontend-only handling issue.
- The center Quality control should remain `Auto from aspect` for Reve because the model schema has no size/quality field.