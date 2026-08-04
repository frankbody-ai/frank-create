import type { Asset, BriefFormState } from "./types";

export function createBriefPayload(
  form: BriefFormState,
  projectId: string,
  referenceImagePath?: string
) {
  const productName = clean(form.productName);
  const title = clean(form.title) || (productName ? `${productName} product shot` : "Frank product shot");

  return {
    project_id: projectId,
    title,
    product_name: productName,
    task_type: form.taskType,
    channel: clean(form.channel),
    tone: clean(form.tone),
    prompt: clean(form.prompt),
    negative_prompt: clean(form.negativePrompt),
    reference_image_path: referenceImagePath,
    status: "draft"
  };
}

export function assetStatusCopy(status: Asset["approval_status"]) {
  if (status === "approved") {
    return "Approved. Hot.";
  }
  if (status === "rejected") {
    return "Not the one.";
  }
  return "In review";
}

function clean(value?: string) {
  return (value || "").trim();
}

