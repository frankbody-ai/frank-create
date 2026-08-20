# Fix Claude connector registration at the production runtime

## Confirmed diagnosis

- The Claude error is not currently an OAuth Client ID configuration problem.
- The published app, `/mcp`, OAuth discovery, and the consent route all return **502 Internal server error**.
- Production logs identify the startup failure exactly: `No such module "h3-v2" imported from "server.js"`.
- The generated server bundle leaves `h3-v2` as a runtime import. The deployment runtime cannot resolve that package alias, so the entire published app fails before MCP discovery or dynamic client registration runs.
- Local development works because local `node_modules` can resolve the transitive alias, which is why the issue was not visible in the local MCP checks.

## Implementation

1. **Make the server bundle self-contained**
   - Update `frank-create/vite.config.ts` so the TanStack server build bundles `h3-v2` rather than leaving it as an external runtime import.
   - Add the matching `h3-v2` npm alias as an explicit app dependency in `frank-create/package.json` and refresh the active lockfile, preventing it from being omitted as an implicit transitive dependency.

2. **Guard the production artifact**
   - Add a post-build verification to the root build flow that fails if `dist/server/server.js` still imports `h3-v2` externally.
   - Keep the existing root `dist/client` and `dist/server` output layout required by publishing.

3. **Verify MCP and OAuth end to end**
   - Confirm the production-shaped server artifact starts without unresolved imports.
   - Verify `/` loads, `/mcp` returns the expected signed-out OAuth challenge, protected-resource discovery returns JSON, and `/.lovable/oauth/consent` loads.
   - Probe the advertised authorization server’s discovery and dynamic client registration endpoints using the exact URLs returned by MCP discovery.

4. **Publish and retest Claude**
   - Add a short new entry at the top of `frank-create/src/lib/releaseNotes.ts` for this publish.
   - Publish the corrected runtime, verify the live endpoints no longer return 502, then retry the Claude connector and confirm registration proceeds without requesting a manual OAuth Client ID.

## Files

- `frank-create/vite.config.ts`
- `frank-create/package.json`
- `frank-create/package-lock.json` / `frank-create/bun.lock` as required by the package update
- Root `package.json` build verification
- `frank-create/src/lib/releaseNotes.ts`