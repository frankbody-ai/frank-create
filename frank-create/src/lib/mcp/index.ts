import { auth, defineMcp } from "@lovable.dev/mcp-js";
import { DIRECT_SUPABASE_URL } from "./supabase";
import checkRunTool from "./tools/check-run";
import generateImageTool from "./tools/generate-image";
import listAssetsTool from "./tools/list-assets";
import listStudioOptionsTool from "./tools/list-models";
import upscaleMediaTool from "./tools/upscale-media";
import writePromptTool from "./tools/write-prompt";

const mcp: ReturnType<typeof defineMcp> = defineMcp({
  name: "frank-create",
  title: "frank Create",
  version: "0.2.0",
  instructions:
    "Tools for the art-ificial studio (frank Create). Turn a brief into a crafted prompt with write_prompt, render it with generate_image (check list_studio_options for model ids, aspect ratios and sizes), upscale images or videos with upscale_media, browse past outputs with list_assets, and poll long runs with check_run.",
  auth: auth.oauth.issuer({
    issuer: `${DIRECT_SUPABASE_URL}/auth/v1`,
    acceptedAudiences: "authenticated",
    jwksUri: `${DIRECT_SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  }),
  tools: [
    listStudioOptionsTool,
    writePromptTool,
    generateImageTool,
    upscaleMediaTool,
    checkRunTool,
    listAssetsTool,
  ],
});


export default mcp;
