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
    { key: "google", label: "Gemini / Nano Banana", type: "api", status: "curated" },
    { key: "replicate", label: "Replicate", type: "api", status: "curated" },
    { key: "openai", label: "OpenAI image/edit", type: "api", status: "curated" }
  ],
  models: [
    {
      id: "google-nb-pro",
      label: "Gemini 3 Pro Image / Nano Banana Pro",
      short_label: "Nano Banana Pro",
      provider: "replicate",
      provider_model: "google/nano-banana-pro",
      status: "ready",
      badge: "4K",
      max_resolution_label: "4K",
      description: "Nano Banana Pro (Google) via Replicate — 1K / 2K / 4K, wide aspect enum, up to 14 reference images.",
      capabilities: { generation: true, edit: true, masked_edit: false, video: false },
      // Exact Replicate schema enum for google/nano-banana-pro.
      allowed_aspect_ratios: [
        "match_input_image", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
      ],
      allowed_image_sizes: ["1K", "2K", "4K"],
      reference_image_limit: 14,
      max_count: 4,
      cost_label: "premium",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "google-nb-2",
      label: "Gemini 3.1 Flash Image / Nano Banana 2",
      short_label: "Nano Banana 2",
      provider: "replicate",
      provider_model: "google/nano-banana-2",
      status: "ready",
      badge: "4K",
      max_resolution_label: "4K",
      description: "Nano Banana 2 (Google) via Replicate — 1K / 2K / 4K, extended aspect enum (incl. 1:4, 4:1, 8:1), up to 14 refs.",
      capabilities: { generation: true, edit: true, masked_edit: false, video: false },
      // Exact Replicate schema enum for google/nano-banana-2.
      allowed_aspect_ratios: [
        "match_input_image", "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"
      ],
      allowed_image_sizes: ["1K", "2K", "4K"],
      reference_image_limit: 14,
      max_count: 4,
      cost_label: "fast",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "openai-gpt-image-2",
      label: "OpenAI gpt-image-2",
      short_label: "gpt-image-2",
      provider: "replicate",
      provider_model: "openai/gpt-image-2",
      status: "ready",
      badge: "4K",
      max_resolution_label: "4K",
      description: "OpenAI gpt-image-2 via Replicate — full aspect enum plus pixel presets up to 4K (3840x2160). Sizes above 2560x1440 are experimental.",
      capabilities: { generation: true, edit: true, masked_edit: true, video: false },
      // Ratio-style aspect entries; pixel presets are exposed via image_size.
      allowed_aspect_ratios: ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
      allowed_image_sizes: [
        "auto",
        "1024x1024", "1536x1024", "1024x1536",
        "1536x1152", "1152x1536",
        "2048x2048", "2048x1152", "1152x2048",
        "3840x2160", "2160x3840"
      ],
      reference_image_limit: 10,
      max_count: 10,
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
      badge: "HQ",
      max_resolution_label: "auto",
      description: "Reve 2.1 (Replicate) — text-to-image + reference remix (up to 8 refs). Model picks its own resolution from the aspect ratio.",
      capabilities: { generation: true, edit: true, masked_edit: false, video: false },
      // Full Reve 2.1 aspect enum from the model schema.
      allowed_aspect_ratios: [
        "auto", "1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16",
        "5:4", "4:5", "21:9", "17:9", "2:1", "1:2", "3:1", "1:3", "4:1", "1:4"
      ],
      // Reve does not expose a size/resolution knob — output size is derived from the aspect.
      allowed_image_sizes: [],
      reference_image_limit: 8,
      max_count: 4,
      cost_label: "premium",
      configured: true,
      missing_env_vars: [],
      // Reve's hosted model is currently returning ModelError (E001) on every
      // prediction — including plain text-to-image with no references. Flip this
      // back to false once the provider recovers.
      degraded: true,
      degraded_note: "Reve 2.1 is failing upstream on Replicate (ModelError E001). Use Nano Banana Pro, Seedream 5 Pro, or GPT-image-2 until it recovers."
    },
    {
      id: "mai-image-2-5",
      label: "MAI-Image-2.5 (Microsoft)",
      short_label: "MAI 2.5",
      provider: "replicate",
      provider_model: "microsoft/mai-image-2.5",
      // Microsoft has not published MAI-Image on Replicate (or any public API) —
      // it is only available inside playground.microsoft.ai. Kept as a disabled
      // tile so it reappears automatically once a public endpoint ships.
      status: "disabled",
      badge: "SOON",
      max_resolution_label: "—",
      description: "Not yet on Replicate — Microsoft only exposes MAI-Image via playground.microsoft.ai. Enabled the moment a public API ships.",
      capabilities: { generation: false, edit: false, masked_edit: false, video: false },
      allowed_aspect_ratios: [],
      allowed_image_sizes: [],
      reference_image_limit: 0,
      cost_label: "premium",
      configured: false,
      missing_env_vars: []
    },
    {
      id: "seedream-5-pro",
      label: "Seedream 5.0 Pro (ByteDance)",
      short_label: "Seedream 5 Pro",
      provider: "replicate",
      provider_model: "bytedance/seedream-5-pro",
      status: "ready",
      badge: "2K",
      max_resolution_label: "2K",
      description: "ByteDance Seedream 5.0 Pro (Replicate) — 1K or 2K text-to-image + up to 10 reference images.",
      capabilities: { generation: true, edit: true, masked_edit: false, video: false },
      // Exact aspect enum from the Seedream 5 Pro schema.
      allowed_aspect_ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
      // Seedream exposes only 1K / 2K (no 4K).
      allowed_image_sizes: ["1K", "2K"],
      reference_image_limit: 10,
      max_count: 6,
      cost_label: "premium",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "grok-imagine-video",
      label: "Grok Imagine Video 720p",
      short_label: "Grok Imagine",
      provider: "replicate",
      provider_model: "xai/grok-imagine-video",
      media: "video",
      status: "ready",
      badge: "720p",
      max_resolution_label: "720p",
      description: "xAI Grok Imagine Video (Replicate) — cheapest of the roster. Text-to-video or image-to-video, 1–15s at 480p / 720p.",
      capabilities: { generation: true, edit: false, masked_edit: false, video: true },
      allowed_aspect_ratios: ["auto", "16:9", "4:3", "1:1", "9:16", "3:4", "3:2", "2:3"],
      allowed_image_sizes: [],
      allowed_durations: [3, 5, 8, 10, 15],
      allowed_resolutions: ["480p", "720p"],
      reference_image_limit: 1,
      max_count: 1,
      cost_label: "cheapest",
      price_per_second: 0.05,
      price_tier: "cheapest",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "dreamina-seedance-2",
      label: "Dreamina Seedance 2.0 (ByteDance)",
      short_label: "Seedance 2.0",
      provider: "replicate",
      provider_model: "bytedance/seedance-2.0",
      media: "video",
      status: "ready",
      badge: "4K",
      max_resolution_label: "4K",
      description: "ByteDance Seedance 2.0 (Replicate) — native audio, 480p → 4K, 5–15s, first/last frame plus up to 9 reference images. Billed per output second by resolution: 480p $0.08, 720p $0.18, 1080p $0.45, 4K $1.00.",
      capabilities: { generation: true, edit: false, masked_edit: false, video: true },
      allowed_aspect_ratios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "9:21", "adaptive"],
      allowed_image_sizes: [],
      allowed_durations: [5, 7, 10, 12, 15],
      allowed_resolutions: ["480p", "720p", "1080p", "4k"],
      reference_image_limit: 9,
      max_count: 1,
      cost_label: "premium",
      // Replicate bills Seedance per output second, scaled by target resolution.
      // These are the non_video_in rates (text/image-to-video, what this app sends).
      price_per_second_by_resolution: { "480p": 0.08, "720p": 0.18, "1080p": 0.45, "4k": 1.0 },
      price_tier: "standard",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "grok-imagine-video-1-5",
      label: "Grok Imagine Video 1.5 720p",
      short_label: "Grok 1.5",
      provider: "replicate",
      provider_model: "xai/grok-imagine-video-1.5",
      media: "video",
      status: "ready",
      badge: "720p",
      max_resolution_label: "720p",
      description: "xAI Grok Imagine Video 1.5 (Replicate) — image-to-video with synchronized audio. Needs a source frame. 1–15s at 480p / 720p.",
      capabilities: { generation: true, edit: false, masked_edit: false, video: true },
      allowed_aspect_ratios: ["auto", "16:9", "4:3", "1:1", "9:16", "3:4", "3:2", "2:3"],
      allowed_image_sizes: [],
      allowed_durations: [3, 5, 8, 10, 15],
      allowed_resolutions: ["480p", "720p"],
      requires_source_image: true,
      reference_image_limit: 1,
      max_count: 1,
      cost_label: "premium",
      price_per_second: 0.08,
      price_tier: "standard",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "happyhorse-1-0",
      label: "Happy Horse 1.0 (Alibaba)",
      short_label: "Happy Horse",
      provider: "replicate",
      provider_model: "alibaba/happyhorse-1.0",
      media: "video",
      status: "ready",
      badge: "1080p",
      max_resolution_label: "1080p",
      description: "Alibaba Happy Horse 1.0 (Replicate) — text-to-video or single-image animation, 3–15s at 720p / 1080p.",
      capabilities: { generation: true, edit: false, masked_edit: false, video: true },
      allowed_aspect_ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
      allowed_image_sizes: [],
      allowed_durations: [3, 5, 8, 10, 15],
      allowed_resolutions: ["720p", "1080p"],
      reference_image_limit: 1,
      max_count: 1,
      cost_label: "premium",
      price_per_second: 0.05,
      price_max_per_second: 0.11,
      price_tier: "standard",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "wan-2-7-i2v",
      label: "Wan 2.7 (image-to-video)",
      short_label: "Wan 2.7",
      provider: "replicate",
      provider_model: "wan-video/wan-2.7-i2v",
      media: "video",
      status: "ready",
      badge: "1080p",
      max_resolution_label: "1080p",
      description: "Alibaba Wan 2.7 image-to-video (Replicate) — needs a first frame, adds synchronized audio. 2–15s at 720p / 1080p, output keeps the source frame's ratio.",
      capabilities: { generation: true, edit: false, masked_edit: false, video: true },
      allowed_aspect_ratios: ["match_input_image"],
      allowed_image_sizes: [],
      allowed_durations: [2, 5, 8, 10, 15],
      allowed_resolutions: ["720p", "1080p"],
      requires_source_image: true,
      reference_image_limit: 2,
      max_count: 1,
      cost_label: "premium",
      price_per_second: 0.05,
      price_max_per_second: 0.11,
      price_tier: "standard",
      configured: true,
      missing_env_vars: []
    },
    {
      id: "hailuo-2-3",
      label: "Minimax Hailuo 2.3",
      short_label: "Hailuo 2.3",
      provider: "replicate",
      provider_model: "minimax/hailuo-2.3",
      media: "video",
      status: "ready",
      badge: "1080p",
      max_resolution_label: "1080p",
      description: "Minimax Hailuo 2.3 (Replicate) — most expensive, best realistic human motion and cinematic VFX. 6s or 10s (10s is 768p only), 1080p is 6s only.",
      capabilities: { generation: true, edit: false, masked_edit: false, video: true },
      allowed_aspect_ratios: ["match_input_image"],
      allowed_image_sizes: [],
      allowed_durations: [6, 10],
      allowed_resolutions: ["768p", "1080p"],
      reference_image_limit: 1,
      max_count: 1,
      cost_label: "premium",
      // Priced per output video on Replicate: 6s/768p $0.28, 10s/768p $0.56, 6s/1080p $0.49.
      price_table: { "6@768p": 0.28, "10@768p": 0.56, "6@1080p": 0.49 },
      price_flat: 0.28,
      price_tier: "premium",
      configured: true,
      missing_env_vars: []
    }

  ],

  backlogModels: [],
  promptPresets: [
    {
      key: "product-shot-lab",
      label: "🧪 Product Shot Lab",
      description: "Clean product image for PDP, retouching, and channel crops.",
      prompt:
        "Frank Body [PRODUCT NAME] product-first composition. Clean label facing camera, honest skin-care texture, Frank pink accent, channel-ready negative space. Studio photography, soft realistic shadow, high-conversion PDP finish. 4K, photorealistic."
    },
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
        "Frank Body campaign hero. Young woman, radiant glowing skin, applying or holding [PRODUCT NAME], warm natural light, beauty editorial mood. Authentic skin texture — not AI-smooth. Inclusive casting, confident body-care moment, warm direct flash, tactile product use, no plastic retouching. 4K, photorealistic."
    },
    {
      key: "campaign-variants",
      label: "🎯 Campaign Variants",
      description: "Creative rounds from one approved product direction.",
      prompt:
        "Frank Body [PRODUCT NAME] campaign variant. Keep product recognizable and label clean, push set styling, leave channel-ready headline space in the composition. Sharpen the Frank Body attitude — cheeky, warm, director-ready. Editorial realism, warm flash, tactile surfaces. 4K, photorealistic."
    },
    {
      key: "product-texture",
      label: "🧴 Product Texture",
      description: "Macro scrub, cream, and tactile swipes.",
      prompt:
        "Extreme close-up macro photography of [INGREDIENT/TEXTURE] — e.g. coffee grounds, shea butter, vitamin C crystals, creamy body-care texture, tactile swipes. Warm studio light, soft shadows, high detail, editorial beauty feel. Delicious but skin-care appropriate. 4K, photorealistic."
    },
    {
      key: "retail-mock",
      label: "🏪 Retail Mock",
      description: "Packaging, shelf, display, and type exploration.",
      prompt:
        "Realistic retail shelf or branded display mock for Frank Body [PRODUCT NAME]. Pharmacy or beauty retailer environment — e.g. Chemist Warehouse, MECCA, Target. Correct shelf height, accurate product facings, packaging readable, brand block clear, campaign headline space, sharp typography."
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
  voice: {
    appTitle: "The Art Dept.",
    labTitle: "Frank Body Image Studio",
    primaryAction: "Generate",
    emptyState: "Waiting for the brief...",
    approved: "Approved. Hot."
  }
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
