# Fix Claude MCP connection permanently

## Confirmed diagnosis

- `https://artificial-design-studio.lovable.app/functions/v1/mcp` returns **404** because the published web app has no handler at that path.
- The existing MCP backend is running: its initialize request returns the expected **401 OAuth challenge**, and its protected-resource and authorization-server discovery documents are valid.
- The committed MCP manifest advertises the relative path `/functions/v1/mcp`. Claude/Lovable resolves that against the published app domain, producing the broken URL shown in the screenshot.
- The published OAuth consent deep link also currently returns 404, so completing sign-in would fail even after discovery.

## Implementation

1. **Serve MCP from the published app origin**
   - Move the app shell onto the project’s supported TanStack Start runtime while preserving the current React Studio UI.
   - Switch the MCP integration from the backend-function Vite adapter to the TanStack adapter and mount it at `/mcp`.
   - Keep the existing OAuth-protected tools and user-scoped database access unchanged.

2. **Make OAuth consent a real server-routed page**
   - Add the literal `/.lovable/oauth/consent` TanStack route instead of relying on static-host SPA fallbacks.
   - Preserve the authorization request through Google sign-in and return users to the consent page before approve/deny.

3. **Correct connector registration**
   - Regenerate the MCP manifest so its canonical path is `/mcp` on the published app origin.
   - Remove the obsolete edge-function copy/sync workaround so future builds cannot reintroduce `/functions/v1/mcp` into the manifest.

4. **End-to-end validation**
   - Verify `/mcp` accepts MCP POST requests and returns an OAuth challenge when signed out.
   - Verify protected-resource discovery, dynamic client registration, consent-page loading, approve/deny redirects, authenticated initialization, and tool listing.
   - Confirm the old broken app-domain `/functions/v1/mcp` path is no longer advertised anywhere.

## Release

A fresh publish is required after validation because Claude reads the MCP endpoint and OAuth routes from the published deployment. The release notes entry will briefly identify the Claude connector fix.