import type { BrandKit, FrankConfig } from "./types";

export const fallbackBrandKit: BrandKit = {
  style_guidance:
    "Warm off-white, Frank pink, cherry red, coffee brown, and off-black palette. Cheeky but director-ready body-care attitude. Tactile coffee/body-scrub textures, glossy skin-care detail, warm flash, editorial realism, and packaging that stays clean.",
  negative_prompt:
    "Avoid warped logos, extra lids, plastic skin, over-airbrushed bodies, muddy coffee spills, generic beige spa stock-photo styling, and unreadable packaging labels.",
  reference_notes:
    "Use approved Frank Body pack shots first, then lifestyle/body-care references. Keep source product identity more important than style experiments.",
  sync_status: "local",
  remote_id: null
};

export const fallbackConfig: FrankConfig = {
  tasks: [
    {
      key: "product-shot-lab",
      label: "Product Shot Lab",
      description: "Upload product/reference images, generate variants, approve, and export.",
      providers: ["local", "google", "replicate", "openai"]
    },
    {
      key: "background-remove",
      label: "Background sweep",
      description: "Transparent PNGs and clean product isolation.",
      providers: ["local", "openai"]
    },
    {
      key: "background-replace",
      label: "Background glow-up",
      description: "Frank-branded lifestyle and campaign backdrops.",
      providers: ["local", "google", "openai"]
    },
    {
      key: "product-cleanup",
      label: "Product polish",
      description: "Retouch labels, dust, shadows, and product edges.",
      providers: ["local", "openai"]
    },
    {
      key: "campaign-variants",
      label: "Campaign remix",
      description: "Creative rounds from one approved product direction.",
      providers: ["local", "google", "openai", "replicate"]
    },
    {
      key: "aspect-crops",
      label: "Crop the goods",
      description: "PDP, email, feed, story, and paid-social crops.",
      providers: ["local"]
    },
    {
      key: "upscale-enhance",
      label: "Make it bigger",
      description: "High-res masters with product detail intact.",
      providers: ["local", "openai"]
    },
    {
      key: "prompt-remix",
      label: "Brief remix",
      description: "Sharper directions before another creative round.",
      providers: ["local", "openai", "google"]
    }
  ],
  providers: [
    { key: "local", label: "Local RTX", type: "local", status: "ready" },
    { key: "google", label: "Gemini / Nano Banana", type: "api", status: "curated" },
    { key: "replicate", label: "Replicate", type: "api", status: "curated" },
    { key: "openai", label: "OpenAI image/edit", type: "api", status: "curated" }
  ],
  models: [
    {
      id: "frank-local-comfy",
      label: "Frank Local Comfy Studio",
      short_label: "Local Comfy",
      provider: "local",
      provider_model: "frank-local-comfy",
      status: "ready",
      badge: "Ready",
      max_resolution_label: "4K",
      description:
        "Local Comfy-backed product variants, edits, masked retouch demos, crops, export prep, and storyboard motion without API keys.",
      capabilities: { generation: true, edit: true, masked_edit: true, video: true },
      allowed_aspect_ratios: ["1:1", "4:5", "3:4", "16:9", "9:16", "3:2", "2:3"],
      allowed_image_sizes: ["1K", "2K", "4K"],
      reference_image_limit: 8,
      cost_label: "local",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "google-nb-pro",
      label: "Gemini 3 Pro Image / Nano Banana Pro",
      short_label: "Nano Banana Pro",
      provider: "google",
      provider_model: "gemini-3-pro-image",
      provider_api_version: "v1beta",
      status: "ready",
      badge: "2K",
      max_resolution_label: "2K",
      description: "High-quality Gemini image generation/editing via Lovable AI Gateway. Output size is a prompt hint (1K or 2K).",
      capabilities: { generation: true, edit: true, masked_edit: false, video: false },
      allowed_aspect_ratios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
      allowed_image_sizes: ["1K", "2K"],
      reference_image_limit: 14,
      cost_label: "premium",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "google-nb-2",
      label: "Gemini 3.1 Flash Image / Nano Banana 2",
      short_label: "Nano Banana 2",
      provider: "google",
      provider_model: "gemini-3.1-flash-image",
      provider_api_version: "v1beta",
      status: "ready",
      badge: "2K",
      max_resolution_label: "2K",
      description: "Fast Gemini image generation/editing via Lovable AI Gateway. Output size is a prompt hint (1K or 2K).",
      capabilities: { generation: true, edit: true, masked_edit: false, video: false },
      allowed_aspect_ratios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
      allowed_image_sizes: ["1K", "2K"],
      reference_image_limit: 14,
      cost_label: "fast",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "openai-gpt-image-2",
      label: "OpenAI gpt-image-2",
      short_label: "gpt-image-2",
      provider: "openai",
      provider_model: "gpt-image-2",
      status: "ready",
      badge: "1536",
      max_resolution_label: "1536",
      description: "OpenAI image generation with fixed canvas sizes (square, landscape, portrait).",
      capabilities: { generation: true, edit: true, masked_edit: true, video: false },
      allowed_aspect_ratios: ["1:1", "3:2", "2:3"],
      allowed_image_sizes: ["1024x1024", "1536x1024", "1024x1536"],
      reference_image_limit: 10,
      cost_label: "premium",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "reve-2-1",
      label: "Reve 2.1",
      short_label: "Reve 2.1",
      provider: "replicate",
      provider_model: "reve/reve-2.1",
      status: "ready",
      badge: "2K",
      max_resolution_label: "2K",
      description: "Reve 2.1 — text-to-image + reference-image editing via Replicate. Strong aesthetics and prompt following.",
      capabilities: { generation: true, edit: true, masked_edit: false, video: false },
      allowed_aspect_ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"],
      allowed_image_sizes: ["1K", "2K"],
      reference_image_limit: 4,
      cost_label: "premium",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "mai-image-2-5",
      label: "MAI-Image-2.5 (Microsoft)",
      short_label: "MAI 2.5",
      provider: "replicate",
      provider_model: "microsoft/mai-image-2.5",
      status: "ready",
      badge: "HQ",
      max_resolution_label: "2K",
      description: "Microsoft MAI-Image-2.5 via Replicate — photoreal generation with rich detail.",
      capabilities: { generation: true, edit: false, masked_edit: false, video: false },
      allowed_aspect_ratios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
      allowed_image_sizes: ["1K", "2K"],
      reference_image_limit: 0,
      cost_label: "premium",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "seedream-5-pro",
      label: "Seedream 5.0 Pro (ByteDance)",
      short_label: "Seedream 5 Pro",
      provider: "replicate",
      provider_model: "bytedance/seedream-5-pro",
      status: "ready",
      badge: "4K",
      max_resolution_label: "4K",
      description: "ByteDance Seedream 5.0 Pro via Replicate — sharp 4K text-to-image and multi-reference editing (up to 10 refs).",
      capabilities: { generation: true, edit: true, masked_edit: false, video: false },
      allowed_aspect_ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"],
      allowed_image_sizes: ["1K", "2K", "4K"],
      reference_image_limit: 10,
      cost_label: "premium",
      configured: true,
      missing_env_vars: []
    }

  ],
  backlogModels: [],
  promptPresets: [
    {
      key: "clean-ecom",
      label: "🛒 Clean Ecom",
      description: "Crisp commerce frame with readable packaging.",
      prompt:
        "Frank Body [PRODUCT NAME] product hero image for e-commerce PDP. High-gloss plastic packaging, centred in frame, clean white or soft off-white background, soft box lighting, no harsh shadows, full product visible, label legible. Studio photography style. 4K, photorealistic. Professional beauty brand e-commerce standard. No props, no model, no hands."
    },
    {
      key: "fb-lifestyle",
      label: "📸 FB Lifestyle",
      description: "Warm editorial lifestyle moment.",
      prompt:
        "Frank Body [PRODUCT NAME] warm editorial lifestyle image. Human skin or product-only flat lay — specify which. Warm natural light, bathroom or bedroom setting or marble surface. Product as supporting element or hero. Dried botanicals, minimal props. Vogue Beauty editorial feel, warm cream and terracotta tones. 4K, photorealistic."
    },
    {
      key: "fb-model-image",
      label: "👤 FB Model Image",
      description: "Campaign hero with a real body-care model moment.",
      prompt:
        "Frank Body campaign hero. Young woman, radiant glowing skin, applying or holding [PRODUCT NAME], warm natural light, beauty editorial mood. Authentic skin texture — not AI-smooth. 4K, photorealistic."
    },
    {
      key: "product-texture",
      label: "🧴 Product Texture",
      description: "Macro scrub, cream, and tactile swipes.",
      prompt:
        "Extreme close-up macro photography of [INGREDIENT/TEXTURE] — e.g. coffee grounds, shea butter, vitamin C crystals. Warm studio light, soft shadows, editorial beauty feel."
    },
    {
      key: "retail-mock",
      label: "🏪 Retail Mock",
      description: "Packaging, shelf, display, and type exploration.",
      prompt:
        "Realistic retail shelf or branded display mock for Frank Body [PRODUCT NAME]. Pharmacy or beauty retailer environment — e.g. Chemist Warehouse, MECCA, Target. Correct shelf height, accurate product facings."
    }
  ],
  exportPresets: [
    { key: "pdp", label: "PDP", size: "1600 x 2000", format: "PNG/JPG", media_types: ["image"] },
    { key: "email-hero", label: "Email hero", size: "2400 x 1350", format: "JPG", media_types: ["image"] },
    { key: "instagram-feed", label: "Instagram feed", size: "1080 x 1350", format: "JPG", media_types: ["image"] },
    { key: "instagram-story", label: "Instagram story", size: "1080 x 1920", format: "JPG", media_types: ["image"] },
    { key: "paid-social", label: "Paid social", size: "1200 x 628", format: "JPG", media_types: ["image"] },
    { key: "transparent-png", label: "Transparent PNG", size: "source", format: "PNG", media_types: ["image"] },
    { key: "high-res-master", label: "High-res master", size: "source/upscaled", format: "PNG/TIFF", media_types: ["image"] },
    { key: "video-storyboard", label: "Motion storyboard", size: "source loop", format: "GIF + JSON", media_types: ["video"] }
  ],
  localEngine: {
    active_engine: "frank_renderer",
    diffusion_ready: false,
    checkpoint_count: 0,
    checkpoints: [],
    ignored_checkpoints: [],
    minimum_checkpoint_mb: 100,
    checkpoint_dir: "models\\checkpoints",
    model_root: "models",
    setup_readme: "models\\FRANK_CREATE_MODELS_README.txt",
    setup_steps: [
      "Put a full SDXL-style .safetensors checkpoint in models\\checkpoints for Local Comfy txt2img, reference/edit img2img, and masked inpaint workflows.",
      "Files smaller than 100 MB are treated as incomplete downloads/placeholders.",
      "Use the raw Comfy canvas for FLUX or custom loader workflows until a curated FLUX app workflow is added.",
      "Run Demo Doctor again after adding model files."
    ],
    recommended_checkpoints: [
      {
        label: "SDXL 1.0 Base or an approved SDXL product checkpoint",
        use: "Best first local checkpoint for campaign/image rounds, reference-guided edits, and masked retouching through built-in Comfy txt2img/img2img/inpaint workflows.",
        folder: "models\\checkpoints"
      },
      {
        label: "Frank-approved SDXL LoRA",
        use: "Later brand-tuning layer for open models after the image set and rights are approved.",
        folder: "models\\loras"
      }
    ],
    note: "No diffusion checkpoint detected. Local Comfy uses the Frank renderer until a checkpoint is installed."
  },
  voice: {
    appTitle: "The Art Dept.",
    labTitle: "Frank Body Image Studio",
    primaryAction: "Generate",
    emptyState: "Waiting for the brief...",
    approved: "Approved. Hot."
  },
  advancedGraphUrl: "/comfy/"
};

export const defaultBrief = {
  title: "",
  productName: "",
  taskType: "background-replace",
  channel: "PDP",
  tone: "Cheeky but director-ready",
  prompt: "",
  negativePrompt: ""
};
