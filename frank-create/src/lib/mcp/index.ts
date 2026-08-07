import { auth, defineMcp } from "@lovable.dev/mcp-js";
import { DIRECT_SUPABASE_URL } from "./supabase";
import getSessionTool from "./tools/get-session";
import listAssetsTool from "./tools/list-assets";
import listModelsTool from "./tools/list-models";
import listPresetsTool from "./tools/list-presets";
import listSessionsTool from "./tools/list-sessions";
import setAssetApprovalTool from "./tools/set-asset-approval";
import submitFeedbackTool from "./tools/submit-feedback";

export default defineMcp({
  name: "frank-create",
  title: "frank Create",
  version: "0.1.0",
  instructions:
    "Tools for the art-ificial studio (frank Create). Read the signed-in user's generation sessions and assets, approve or reject assets, inspect the available image/video models and prompt presets, and file feedback. Generation itself happens in the app UI.",
  auth: auth.oauth.issuer({
    issuer: `${DIRECT_SUPABASE_URL}/auth/v1`,
    acceptedAudiences: "authenticated",
    jwksUri: `${DIRECT_SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  }),
  tools: [
    listSessionsTool,
    getSessionTool,
    listAssetsTool,
    setAssetApprovalTool,
    listModelsTool,
    listPresetsTool,
    submitFeedbackTool,
  ],
});
