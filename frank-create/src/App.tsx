import {
  ArrowLeft,

  Box,
  CheckCircle2,
  ChevronLeft,
  SlidersHorizontal,
  ChevronRight,
  Clipboard,
  Cpu,
  Download,
  GitBranch,
  ExternalLink,
  Heart,
  ImageIcon,
  Layers3,
  Loader2,
  MessageSquareText,
  Paperclip,
  Paintbrush,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Bell,
  Sparkles,
  Square,
  Upload,
  Wand2,
  X,
  XCircle
} from "lucide-react";
import {
  CSSProperties,
  ChangeEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

import {
  fetchActivationChecklist,
  assetWorkflowReceiptUrl,
  createAsset,
  createAssetChannelSet,
  createBrief,
  createBrandContextReceipt,
  createDemoCallBrief,
  createDemoEvidence,
  createDemoReadinessPack,
  createProviderEnvTemplate,
  createExport,
  createInferenceTurn,
  fetchTurnStatus,
  createProject,
  createProviderReadinessReceipt,
  createReference,
  createSession,
  createSessionHandoff,
  createVideoStoryboard,
  deleteAsset,
  deleteTurn,
  exportDownloadUrl,
  fetchBrandKit,
  fetchConfig,
  fetchDemoDoctor,
  fetchHealth,
  fetchProviderAudit,
  fetchProviderEnvStatus,
  fetchProviderStatus,
  listBriefs,
  listExports,
  listAssets,
  listProjects,
  listSessions,
  listTurns,
  preflightProvider,
  reloadProviderEnv,
  remixPrompt,
  resetDemo,
  saveProviderEnvKeys,
  sessionReviewBoardUrl,
  sessionSyncManifestUrl,
  updateAsset,
  updateBrief,
  updateBrandKit,
  updateSession
} from "./lib/api";

import { fallbackBrandKit, fallbackConfig } from "./lib/presets";
import { supabase, hardSignOut } from "./lib/supabaseClient";
import { assetStatusCopy, createBriefPayload } from "./lib/frankWorkflow";
import {
  buildTurnRequest,
  aspectRatioParts,
  defaultStudioSettings,
  filterSizesForAspect,
  inferenceStatusCopy,
  makeLocalId,
  normalizeStudioSettingsForModel,
  parseJsonList,
  selectModelOptions,
  validateStudioSettings,
  hasStudioFieldErrors,
  preflightModel,
  maxCountForModel,
  modelsForMedia,
  normalizeVideoSettings,
  isVideoModel,
  resolveForModel,
  groupCompareRows,
  parseCompareMeta,
  estimateVideoCost,
  composeReferencePrompt,
  referenceTagFor,
  taggedReferences,
  insertTagAtCaret,
  unknownReferenceTags,
  buildReferenceManifest,
  expandReferenceTags,
  thumbnailUrl
} from "./lib/studio";
import type { StudioFieldErrors } from "./lib/studio";

import { FeedbackWidget } from "./components/FeedbackWidget";
import { StudioRail } from "./components/StudioRail";
import { PresetCreator } from "./components/PresetCreator";
import { PromptGenerator } from "./components/PromptGenerator";
import Enhancer from "./components/Enhancer";

import type {
  ActivationChecklist,
  Asset,
  BrandKit,
  Brief,
  BriefFormState,
  DemoDoctorStatus,
  DemoCallDecision,
  DemoReadinessPackResult,
  ExportRecord,
  ExportPreset,
  FrankConfig,
  FrankTask,
  ProviderAdapterAudit,
  ProviderEnvStatus,
  ProviderPreflight,
  ProviderReadiness,
  PromptPreset,
  PromptRemixVariant,
  Project,
  StudioModel,
  StudioSession,
  StudioSettings,
  StudioTurn
} from "./lib/types";
import { loadLocalAssets, saveLocalAssets } from "./lib/localAssets";
import { AspectPreview } from "./components/AspectPreview";
import osLogo from "./assets/ds/autosolutions-os-md.png";


type WalkthroughTarget =
  | "app-header"
  | "feedback-button"
  | "reference-dock"
  | "composer"
  | "output-thread"
  | "review-panel"
  | "review-actions"
  | "review-metadata"
  | "variant-controls"
  | "edit-controls"
  | "export-controls"
  | "admin-entry";

interface WalkthroughStep {
  title: string;
  detail: string;
  points?: string[];
  target: WalkthroughTarget;
  openSettings?: boolean;
  selectOutput?: boolean;
}

interface WalkthroughAnchor {
  highlightStyle: CSSProperties;
  popoverStyle: CSSProperties;
  placement: "above" | "below";
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    title: "Sessions and sidebar",
    detail: "The left sidebar is your control strip. Each session is a separate creative thread — switch, rename in place, or start a new one from here.",
    points: [
      "Sessions auto-name from your first prompt; click the title to rename.",
      "Image Studio is the active lab. Product Shot Lab and Video Lab are on the roadmap.",
      "Your profile and sign-out live at the bottom of the sidebar."
    ],
    target: "app-header"
  },
  {
    title: "Feedback, any time",
    detail: "Hit the Feedback button at the top-right of the studio to report a bug or drop an idea. You can attach a screenshot and it goes straight to the admin triage board.",
    points: [
      "Works from any page while signed in.",
      "Optional screenshot upload for context.",
      "Admins triage it as tasks in the Admin portal."
    ],
    target: "feedback-button"
  },
  {
    title: "Reference dock",
    detail: "Upload as many reference images as the selected model accepts. All loaded references are used for the next generation. Click the X on a thumbnail to remove it from the dock.",
    points: [
      "Multimodal models read selected refs as visual guidance.",
      "Refs are consumed once and the dock clears as soon as you generate.",
      "Any generated pick can be reused as a reference from the review desk."
    ],
    target: "reference-dock"
  },
  {
    title: "The composer",
    detail: "Write the brief in plain English, then dial in Model, Aspect, Size, Count, Quality, and Thinking Mode right inside this card. Sizes are automatically filtered to match the chosen aspect and model.",
    points: [
      "Model roster: Nano Banana Pro/2, gpt-image-2, Reve 2.1, Seedream 5.0 Pro (all via Replicate).",
      "Aspect preview shows the exact canvas shape before you generate.",
      "Thinking Mode (Off / Low / High) is available on models that support it."
    ],
    target: "composer"
  },
  {
    title: "Frank Body Mode + presets",
    detail: "Toggle Frank Body Mode to inject brand voice and guardrails. The preset library at the bottom of the right panel gives you 5 curated Frank Body starting points — plus a “+ New preset” tile to save your own.",
    points: [
      "Off = neutral, prompt only. On = Frank Body brand brain.",
      "Custom presets are saved locally and reusable across sessions.",
      "The active mode is recorded with each round for auditability."
    ],
    target: "composer"
  },
  {
    title: "Generate, stop, run in parallel",
    detail: "Press Generate and a pending card appears immediately in the thread. You can queue additional rounds in parallel, or hit Stop to cancel the current run.",
    points: [
      "Parallel generations are capped so providers don't rate-limit you.",
      "Stop cancels the in-flight request cleanly.",
      "The three-step progress indicator shows queue → provider → download."
    ],
    target: "composer"
  },
  {
    title: "Rounds thread",
    detail: "Every run lands here, newest on top. A “New” badge pulses on the freshest round. Each card keeps the prompt, model, references, timestamp, and status attached.",
    points: [
      "Copy the round ID, delete a round, or expand any image to a lightbox.",
      "Retry, Retry missing, and Retry safely rebuild the exact settings for another attempt.",
      "Errors expand inline with a mapped explanation so you know what to change."
    ],
    target: "output-thread"
  },
  {
    title: "Review desk",
    detail: "Click any image to open the review desk on the right. Approvals, rejects, and favorites sync between the thread and this panel — and every decision is written to the audit trail.",
    points: [
      "Click the image itself to expand it full-screen.",
      "Approve / Reject / Favorite are one click and instantly reflected everywhere.",
      "Audit trail logs who decided what and when."
    ],
    target: "review-panel",
    selectOutput: true
  },
  {
    title: "Approve, reject, favorite",
    detail: "These three actions are the creative-director controls. Approved picks feed the export flow; favorites are your softer shortlist; rejects stay on record without cluttering the shortlist.",
    target: "review-actions",
    selectOutput: true
  },
  {
    title: "Run metadata",
    detail: "Everything needed to reproduce or explain a pick lives here: model, aspect/size, references used, Frank Body Mode, prompt, and provider IDs.",
    points: [
      "Copy the prompt or the round/asset ID.",
      "Useful for client notes and repeat runs.",
      "Feeds the audit trail on approve/reject."
    ],
    target: "review-metadata",
    selectOutput: true
  },
  {
    title: "Iterate from a pick",
    detail: "Turn a selected result into the next brief: more like this, clean it up, or campaign remix. The prompt and settings update automatically.",
    target: "variant-controls",
    selectOutput: true
  },
  {
    title: "Edit and reuse",
    detail: "Edit with the selected model, paint a mask where supported, or reuse a good pick as a reference for the next round.",
    target: "edit-controls",
    selectOutput: true
  },
  {
    title: "Export",
    detail: "Once a pick is selected you can export it directly, retry a failed download, or grab the original untouched provider file.",
    target: "export-controls",
    selectOutput: true
  },
  {
    title: "Admin portal",
    detail: "Admins get a portal for managing user roles and triaging feedback as tasks on a Kanban board. First-time sign-ins default to the standard user role.",
    points: [
      "Users tab: promote or demote anyone (including admin).",
      "Feedback Tasks tab: move items across Open / In progress / Done / Dismissed.",
      "Only visible if your account has the admin role."
    ],
    target: "admin-entry"
  }
];

export default function App() {
  const [config, setConfig] = useState<FrankConfig>(fallbackConfig);
  const [connection, setConnection] = useState<"checking" | "online" | "offline">("checking");
  const [projects, setProjects] = useState<Project[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeBrief, setActiveBrief] = useState<Brief | null>(null);
  const [projectName, setProjectName] = useState("Frank Body Campaign");
  const [briefDraft, setBriefDraft] = useState<BriefFormState>(() => makeBriefDraft());
  const [sessions, setSessions] = useState<StudioSession[]>([]);
  const [activeSession, setActiveSession] = useState<StudioSession | null>(null);
  const [turns, setTurns] = useState<StudioTurn[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [prompt, setPrompt] = useState("");
  const [promptRemixes, setPromptRemixes] = useState<PromptRemixVariant[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(() => preferredStudioModel(fallbackConfig.models).id);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(null);
  const [attachedPresetSnapshot, setAttachedPresetSnapshot] = useState<string | null>(null);
  const [customPresets, setCustomPresets] = useState<PromptPreset[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("frank.customPromptPresets") : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.key === "string" && typeof p.label === "string" && typeof p.prompt === "string") : [];
    } catch { return []; }
  });
  const customPresetKeys = useMemo(() => new Set(customPresets.map((p) => p.key)), [customPresets]);
  const [newPresetOpen, setNewPresetOpen] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState("");
  const [newPresetPrompt, setNewPresetPrompt] = useState("");
  useEffect(() => {
    try { window.localStorage.setItem("frank.customPromptPresets", JSON.stringify(customPresets)); } catch { /* ignore */ }
  }, [customPresets]);
  const [frankBodyMode, setFrankBodyMode] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let cancelled = false;
    import("./lib/admin").then(({ isCurrentUserAdmin }) => {
      isCurrentUserAdmin().then((v) => { if (!cancelled) setIsAdmin(v); }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [userEmail]);
  const handleSignOut = async () => {
    await hardSignOut();
    window.location.replace("/");
  };
  const [studioMode, setStudioMode] = useState<"image-studio" | "product-shot-lab" | "video-lab" | "approved-hot" | "preset-creator" | "prompt-generator" | "enhancer">(() =>
    initialStudioMode()
  );
  useEffect(() => {
    document.body.dataset.feedbackView = studioMode;
    return () => {
      delete document.body.dataset.feedbackView;
    };
  }, [studioMode]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [walkthroughAnchor, setWalkthroughAnchor] = useState<WalkthroughAnchor | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "approved">("all");
  const [settings, setSettings] = useState<StudioSettings>(defaultStudioSettings(fallbackConfig.models[0]));
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [lightboxAsset, setLightboxAsset] = useState<Asset | null>(null);
  const [referencePreviewAsset, setReferencePreviewAsset] = useState<Asset | null>(null);
  const [referenceDropActive, setReferenceDropActive] = useState(false);
  const [referencePickerOpen, setReferencePickerOpen] = useState(false);
  const [referenceLibrary, setReferenceLibrary] = useState<Asset[]>([]);
  const [referencePickerSelection, setReferencePickerSelection] = useState<string[]>([]);
  const [referencePickerBusy, setReferencePickerBusy] = useState(false);
  const [referencePickerNote, setReferencePickerNote] = useState<string | null>(null);
  const [referenceLibraryLoading, setReferenceLibraryLoading] = useState(false);


  useEffect(() => {
    if (!referencePickerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [referencePickerOpen]);
  const referencePickerInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [hoveredReferenceTag, setHoveredReferenceTag] = useState<string | null>(null);

  const [compareBaseAsset, setCompareBaseAsset] = useState<Asset | null>(null);
  const [compareTargetAsset, setCompareTargetAsset] = useState<Asset | null>(null);
  const [editSourceAsset, setEditSourceAsset] = useState<Asset | null>(null);
  const [maskAsset, setMaskAsset] = useState<Asset | null>(null);
  const [maskPainterAsset, setMaskPainterAsset] = useState<Asset | null>(null);
  const [sessionCancelTarget, setSessionCancelTarget] = useState<StudioSession | null>(null);
  // Explicit composer-only attachments. Historical reference assets remain
  // saved for run provenance but are never hydrated into a new run.
  const [activeReferenceIds, setActiveReferenceIds] = useState<string[]>([]);

  const [assetNotesDraft, setAssetNotesDraft] = useState("");
  const [providerReadiness, setProviderReadiness] = useState<ProviderReadiness | null>(null);
  const [activationChecklist, setActivationChecklist] = useState<ActivationChecklist | null>(null);
  const [providerEnvStatus, setProviderEnvStatus] = useState<ProviderEnvStatus | null>(null);
  const [providerKeyDraft, setProviderKeyDraft] = useState<Record<string, string>>({});
  const [providerPreflight, setProviderPreflight] = useState<ProviderPreflight | null>(null);
  const [providerAudit, setProviderAudit] = useState<ProviderAdapterAudit | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit>(fallbackBrandKit);
  const [brandKitDraft, setBrandKitDraft] = useState<BrandKit>(fallbackBrandKit);
  const [demoDoctor, setDemoDoctor] = useState<DemoDoctorStatus | null>(null);
  const [checkingProviders, setCheckingProviders] = useState(false);
  const [checkingProviderPreflight, setCheckingProviderPreflight] = useState(false);
  const [checkingProviderAudit, setCheckingProviderAudit] = useState(false);
  const [savingProviderReceipt, setSavingProviderReceipt] = useState(false);
  const [checkingDemoDoctor, setCheckingDemoDoctor] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [savingDemoEvidence, setSavingDemoEvidence] = useState(false);
  const [savingCallBrief, setSavingCallBrief] = useState(false);
  const [buildingReadinessPack, setBuildingReadinessPack] = useState(false);
  const [demoEvidencePath, setDemoEvidencePath] = useState("");
  const [demoEvidenceUrl, setDemoEvidenceUrl] = useState("");
  const [callBriefPath, setCallBriefPath] = useState("");
  const [callBriefUrl, setCallBriefUrl] = useState("");
  const [callDecision, setCallDecision] = useState<DemoCallDecision | null>(null);
  const [providerReceiptPath, setProviderReceiptPath] = useState("");
  const [providerReceiptUrl, setProviderReceiptUrl] = useState("");
  const [brandContextPath, setBrandContextPath] = useState("");
  const [brandContextUrl, setBrandContextUrl] = useState("");
  const [activationChecklistPath, setActivationChecklistPath] = useState("");
  const [activationChecklistUrl, setActivationChecklistUrl] = useState("");
  const [readinessPackPath, setReadinessPackPath] = useState("");
  const [readinessPackUrl, setReadinessPackUrl] = useState("");
  const [readinessPackSha, setReadinessPackSha] = useState("");
  const [implementationManifestPath, setImplementationManifestPath] = useState("");
  const [implementationManifestUrl, setImplementationManifestUrl] = useState("");
  const [readinessPackManifest, setReadinessPackManifest] = useState<DemoReadinessPackResult["manifest"] | null>(null);
  const [providerEnvBusy, setProviderEnvBusy] = useState(false);
  const [maskPainterBusy, setMaskPainterBusy] = useState(false);
  const [brandKitBusy, setBrandKitBusy] = useState(false);
  const [brandContextBusy, setBrandContextBusy] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffProofText, setHandoffProofText] = useState("");
  const [remixBusy, setRemixBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  type InflightGen = { id: string; modelId: string; modelLabel: string; prompt: string; aspect: string; count: number };
  const [inflightGens, setInflightGens] = useState<InflightGen[]>([]);

  const [roundSearch, setRoundSearch] = useState("");
  const [statusText, setStatusText] = useState("Waiting for the brief...");
  const [retrySafePayload, setRetrySafePayload] = useState<Record<string, unknown> | null>(null);
  type GenPhase = "idle" | "queued" | "running" | "completed" | "failed";
  const [genPhase, setGenPhase] = useState<GenPhase>("idle");
  const [genError, setGenError] = useState<{ message: string; code?: string; retryable?: boolean; httpStatus?: number; raw?: string; requestId?: string } | null>(null);
  const [genErrorOpen, setGenErrorOpen] = useState(false);
  const [desktopNotice, setDesktopNotice] = useState<string | null>(null);
  const [videoStartedAt, setVideoStartedAt] = useState<number | null>(null);
  const [videoNowTick, setVideoNowTick] = useState(Date.now());
  const videoAbortRef = useRef<AbortController | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);
  // Set by "Switch model and retry": once the picker has re-rendered on the new
  // model, the effect below fires the generation with the fresh selection.
  const [autoRetryModelId, setAutoRetryModelId] = useState<string | null>(null);
  const [settingsRailOpen, setSettingsRailOpen] = useState(true);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | "compare">("image");
  // Video: explicit first/last frame picks (no implicit "newest still" guessing).
  const [videoFirstFrameId, setVideoFirstFrameId] = useState<string | null>(null);
  const [videoLastFrameId, setVideoLastFrameId] = useState<string | null>(null);
  const [armedFrameSlot, setArmedFrameSlot] = useState<"first" | "last" | null>(null);
  const [compareMedia, setCompareMedia] = useState<"image" | "video">("image");
  const [compareModelBId, setCompareModelBId] = useState<string>("");
  const [compareApproved, setCompareApproved] = useState(false);

  useEffect(() => {
    if (videoStartedAt == null) return;
    const iv = setInterval(() => setVideoNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [videoStartedAt]);

  useEffect(() => {
    function handleDrawerKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setSettingsOpen(false);
    }

    window.addEventListener("keydown", handleDrawerKeyDown);
    return () => window.removeEventListener("keydown", handleDrawerKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        await fetchHealth();
        const freshConfig = mergeConfig(await fetchConfig());
        const sessionResult = await listSessions();
        let nextSession = chooseLaunchSession(sessionResult.sessions);
        let nextSessions = sessionResult.sessions;

        if (!nextSession) {
          const created = await createSession({ name: "Launch Image Studio", mode: "image" });
          nextSession = created.session;
          nextSessions = [created.session];
        }

        const [
          turnResult,
          assetResult,
          exportResult,
          providerEnvResult,
          activationChecklistResult,
          brandKitResult,
          projectResult
        ] = await Promise.all([
          listTurns(nextSession.id),
          listAssets({ sessionId: nextSession.id }),
          listExports().catch(() => ({ exports: [] })),
          fetchProviderEnvStatus().catch(() => null),
          fetchActivationChecklist().catch(() => null),
          fetchBrandKit().catch(() => null),
          listProjects().catch(() => ({ projects: [] }))
        ]);
        const projectForSession =
          projectResult.projects.find((project) => project.id === nextSession.project_id) ?? projectResult.projects[0] ?? null;
        const briefResult = projectForSession ? await listBriefs(projectForSession.id).catch(() => ({ briefs: [] })) : { briefs: [] };

        if (cancelled) {
          return;
        }

        setConfig(freshConfig);
        setSelectedModelId(preferredStudioModel(freshConfig.models).id);
        setProjects(projectResult.projects);
        setActiveProject(projectForSession);
        setProjectName(projectForSession?.name ?? "Frank Body Campaign");
        const initialBrief = briefResult.briefs[0] ?? null;
        setBriefs(briefResult.briefs);
        setActiveBrief(initialBrief);
        if (initialBrief) {
          setBriefDraft(briefToDraft(initialBrief));
          hydratePromptFromBrief(initialBrief);
        }
        setSessions(nextSessions);
        setActiveSession(nextSession);
        setActiveReferenceIds([]);
        setTurns(turnResult.turns);
        setAssets(assetResult.assets);
        setExports(filterExportsForAssets(exportResult.exports, assetResult.assets));
        setProviderEnvStatus(providerEnvResult);
        setActivationChecklist(activationChecklistResult);
        if (brandKitResult?.brandKit) {
          setBrandKit(brandKitResult.brandKit);
          setBrandKitDraft(brandKitResult.brandKit);
        }
        setSelectedAsset(firstReviewableAsset(assetResult.assets));
        setConnection("online");
        setStatusText("Studio is connected.");
      } catch {
        if (cancelled) {
          return;
        }
        const localSession = makeLocalSession();
        setSessions([localSession]);
      setActiveSession(localSession);
      setConnection("offline");
      setExports([]);
      const persisted = loadLocalAssets();
      if (persisted.length) {
        setAssets(persisted);
        setSelectedAsset(firstReviewableAsset(persisted));
      }
        setStatusText("Preview backend offline. You can stage rounds here; live provider runs happen locally.");
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (connection !== "offline") return;
    saveLocalAssets(assets);
  }, [assets, connection]);

  useEffect(() => {
    if (connection !== "online" || providerAudit || checkingProviderAudit || !shouldAutoOpenProviderAudit()) {
      return;
    }
    void checkProviderAdapterAudit();
  }, [connection, providerAudit, checkingProviderAudit]);


  const selectedModel = useMemo(
    () => config.models.find((model) => model.id === selectedModelId) ?? config.models[0],
    [config.models, selectedModelId]
  );
  // First healthy alternative, used for the one-click "switch model and retry"
  // action when the selected model is down on the provider side.
  const fallbackModel = useMemo(
    () =>
      config.models.find(
        (model) => model.id !== selectedModelId && model.status === "ready" && !model.degraded
      ) ?? null,
    [config.models, selectedModelId]
  );
  useEffect(() => {
    if (!autoRetryModelId || selectedModelId !== autoRetryModelId) return;
    setAutoRetryModelId(null);
    void handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRetryModelId, selectedModelId]);
  const providerAuditMode = shouldAutoOpenProviderAudit();
  const modelOptions = useMemo(() => selectModelOptions(config.models, selectedModelId), [config.models, selectedModelId]);
  const allowedSizesForAspect = useMemo(
    () => filterSizesForAspect(modelOptions.allowedImageSizes, settings.aspect_ratio),
    [modelOptions.allowedImageSizes, settings.aspect_ratio]
  );
  const modelHasSizes = (modelOptions.allowedImageSizes?.length ?? 0) > 0;
  // In side-by-side mode the model pool follows the compare sub-media toggle.
  const effectiveMedia: "image" | "video" = mediaKind === "compare" ? compareMedia : mediaKind;
  const mediaModels = useMemo(() => modelsForMedia(config.models, effectiveMedia), [config.models, effectiveMedia]);
  const compareModelB = useMemo(
    () => config.models.find((model) => model.id === compareModelBId) ?? null,
    [config.models, compareModelBId]
  );

  function pickModelForMedia(kind: "image" | "video", exceptId?: string) {
    const pool = modelsForMedia(config.models, kind).filter(
      (model) => model.status !== "disabled" && model.id !== exceptId
    );
    return pool.find((model) => model.status === "ready" && !model.degraded) ?? pool[0] ?? null;
  }

  function switchMediaKind(kind: "image" | "video" | "compare") {
    setMediaKind(kind);
    setCompareApproved(false);
    const media = kind === "compare" ? compareMedia : kind;
    const next = pickModelForMedia(media);
    if (next && next.id !== selectedModelId) setSelectedModelId(next.id);
    if (kind === "compare") {
      const primaryId = next?.id ?? selectedModelId;
      const second = pickModelForMedia(media, primaryId);
      setCompareModelBId((current) => {
        const stillValid = current && modelsForMedia(config.models, media).some((m) => m.id === current) && current !== primaryId;
        return stillValid ? current : second?.id ?? "";
      });
      setSettings((current) => ({ ...current, count: 1 }));
      setStatusText("Side-by-side — two models, one brief, one output each.");
      return;
    }
    setStatusText(kind === "video" ? "Video mode — pick a source frame and brief the motion." : "Image mode.");
  }

  function switchCompareMedia(media: "image" | "video") {
    setCompareMedia(media);
    setCompareApproved(false);
    const primary = pickModelForMedia(media);
    if (primary && primary.id !== selectedModelId) setSelectedModelId(primary.id);
    const second = pickModelForMedia(media, primary?.id ?? selectedModelId);
    setCompareModelBId(second?.id ?? "");
    setStatusText(media === "video" ? "Comparing two video models." : "Comparing two image models.");
  }


  function resetStudioSettings() {
    const model = config.models.find((item) => item.id === selectedModelId);
    if (!model) return;
    const base = defaultStudioSettings(model);
    setSettings(isVideoModel(model)
      ? normalizeVideoSettings(base, model)
      : normalizeStudioSettingsForModel(base, model));
    setStatusText("Settings reset to defaults.");
  }

  const handleAspectChange = (nextAspect: string) => {
    setSettings((current) => {
      const sizes = filterSizesForAspect(modelOptions.allowedImageSizes, nextAspect);
      if (!modelOptions.allowedImageSizes.length) {
        return { ...current, aspect_ratio: nextAspect, image_size: "" };
      }
      const nextSize = sizes.includes(current.image_size)
        ? current.image_size
        : sizes[sizes.length - 1] ?? "";
      return { ...current, aspect_ratio: nextAspect, image_size: nextSize };
    });
  };

  // When the selected model changes, snap aspect/size to what that model actually supports.
  // Without this, switching from Seedream (size "2K") to Reve (no size) leaves image_size="2K",
  // which validateStudioSettings flags as unsupported and silently blocks Generate.
  useEffect(() => {
    const model = config.models.find((m) => m.id === selectedModelId);
    if (!model) return;
    if (isVideoModel(model)) {
      setSettings((current) => normalizeVideoSettings(current, model));
      return;
    }
    setSettings((current) => {
      const nextAspect = model.allowed_aspect_ratios.includes(current.aspect_ratio)
        ? current.aspect_ratio
        : model.allowed_aspect_ratios[0] ?? current.aspect_ratio;
      const sizes = filterSizesForAspect(model.allowed_image_sizes, nextAspect);
      let nextSize: string;
      if (!model.allowed_image_sizes || model.allowed_image_sizes.length === 0) {
        nextSize = "";
      } else if (sizes.includes(current.image_size)) {
        nextSize = current.image_size;
      } else {
        nextSize = sizes[sizes.length - 1] ?? "";
      }
      if (nextAspect === current.aspect_ratio && nextSize === current.image_size) return current;
      return { ...current, aspect_ratio: nextAspect, image_size: nextSize };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModelId, config.models]);

  const providerSetupState = useMemo(
    () => (connection === "online" ? providerSetup(config.models) : { waitingModels: [], envVars: [] }),
    [config.models, connection]
  );
  const providerUnlockRows = useMemo(() => (connection === "online" ? providerUnlockPlan(config.models) : []), [config.models, connection]);
  const providerKeyEnvVars = useMemo(() => {
    if (connection !== "online") {
      return [];
    }
    const missingFromStatus = providerEnvStatus?.missingEnvVars ?? [];
    if (missingFromStatus.length) {
      return orderProviderEnvVars(missingFromStatus, providerUnlockRows);
    }
    if (providerSetupState.envVars.length) {
      return providerSetupState.envVars;
    }
    return orderProviderEnvVars(providerEnvStatus?.envVars ?? [], providerUnlockRows);
  }, [connection, providerEnvStatus?.envVars, providerEnvStatus?.missingEnvVars, providerSetupState.envVars, providerUnlockRows]);
  const providerKeyDraftHasValues = useMemo(
    () => Object.values(providerKeyDraft).some((value) => value.trim().length > 0),
    [providerKeyDraft]
  );
  const promptPresets = useMemo(
    () => [...config.promptPresets, ...customPresets],
    [config.promptPresets, customPresets]
  );
  const activePreset = useMemo(
    () => promptPresets.find((preset) => preset.key === selectedPresetKey) ?? promptPresets[0],
    [promptPresets, selectedPresetKey]
  );
  const productTaskShortcuts = useMemo(
    () => config.tasks.filter((task) => !["product-shot-lab", "prompt-remix"].includes(task.key)),
    [config.tasks]
  );

  function clearEditSource() {
    setEditSourceAsset(null);
    setMaskAsset(null);
    setMaskPainterAsset(null);
  }

  function startEditFromAsset(asset: Asset) {
    setEditSourceAsset(asset);
    setMaskAsset(null);
    setMaskPainterAsset(null);
  }

  function startMaskPainter(asset: Asset) {
    setEditSourceAsset(asset);
    setMaskAsset(null);
    setMaskPainterAsset(asset);
  }

  useEffect(() => {
    if (!selectedModel) {
      return;
    }

    setSettings((current) => normalizeStudioSettingsForModel(current, selectedModel));
    if (!selectedModel.capabilities.masked_edit) {
      setMaskAsset(null);
    }
    setProviderPreflight(null);
  }, [selectedModel]);

  useEffect(() => {
    setAssetNotesDraft(selectedAsset?.notes ?? "");
  }, [selectedAsset?.id]);

  const activeReferenceIdSet = useMemo(() => new Set(activeReferenceIds), [activeReferenceIds]);
  const referenceAssets = assets.filter(
    (asset) => asset.kind === "reference" && activeReferenceIdSet.has(asset.id)
  );
  // All loaded references are used for the next generation; the only way to
  // exclude one is to remove it from the dock with the X button.
  const selectedReferenceAssets = referenceAssets;

  function detachReferences(targets: Asset[], deleteRemote = false) {
    if (!targets.length) {
      return;
    }
    const ids = targets.map((asset) => asset.id);
    const idSet = new Set(ids);
    setActiveReferenceIds((current) => current.filter((id) => !idSet.has(id)));
    setReferencePreviewAsset((current) => (current && idSet.has(current.id) ? null : current));
    if (deleteRemote && connection === "online") {
      setAssets((current) => current.filter((asset) => !idSet.has(asset.id)));
      void Promise.all(
        targets
          .filter((asset) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(asset.id))
          .map((asset) => deleteAsset(asset.id).catch(() => undefined))
      );
    }
  }

  const videoFirstFrame = useMemo(
    () => assets.find((asset) => asset.id === videoFirstFrameId) ?? null,
    [assets, videoFirstFrameId]
  );
  const videoLastFrame = useMemo(
    () => assets.find((asset) => asset.id === videoLastFrameId) ?? null,
    [assets, videoLastFrameId]
  );

  function clearReferenceDock() {
    setActiveReferenceIds([]);
    setReferencePreviewAsset(null);
    setVideoFirstFrameId(null);
    setVideoLastFrameId(null);
    setArmedFrameSlot(null);
  }

  function assignFrameSlot(slot: "first" | "last", assetId: string) {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset || asset.media_type === "video") {
      setStatusText("Frames must be still images.");
      return;
    }
    if (slot === "last") {
      if (!videoFirstFrameId) {
        setStatusText("Pick a first frame before the last frame.");
        return;
      }
      setVideoLastFrameId(asset.id);
      setStatusText(`Last frame set — ${asset.title}.`);
    } else {
      setVideoFirstFrameId(asset.id);
      setStatusText(`First frame set — ${asset.title}.`);
    }
    setArmedFrameSlot(null);
  }


  const baseFieldErrors = useMemo(
    () => validateStudioSettings(modelOptions.model, settings, { referenceCount: selectedReferenceAssets.length }),
    [modelOptions.model, settings, selectedReferenceAssets.length]
  );
  // Side-by-side: resolve the shared settings against each model and surface
  // every snap so the user can approve it before we spend two calls.
  const compareResolved = useMemo(() => {
    if (mediaKind !== "compare" || !modelOptions.model || !compareModelB) return null;
    const referenceCount = selectedReferenceAssets.length;
    return {
      a: resolveForModel(modelOptions.model, settings, { referenceCount }),
      b: resolveForModel(compareModelB, settings, { referenceCount })
    };
  }, [mediaKind, modelOptions.model, compareModelB, settings, selectedReferenceAssets.length]);
  const compareAdjustments = useMemo(() => {
    if (!compareResolved) return [];
    return [
      { side: "A" as const, modelLabel: modelOptions.model?.short_label ?? modelOptions.model?.label ?? "Model A", items: compareResolved.a.adjustments },
      { side: "B" as const, modelLabel: compareModelB?.short_label ?? compareModelB?.label ?? "Model B", items: compareResolved.b.adjustments }
    ];
  }, [compareResolved, modelOptions.model, compareModelB]);
  const compareNeedsApproval = compareAdjustments.some((entry) => entry.items.length > 0);
  const fieldErrors = useMemo(() => {
    if (mediaKind !== "compare") return baseFieldErrors;
    // In compare mode each model gets snapped settings, so per-field validation
    // against model A alone would block valid runs — only gate on real blockers.
    const errors: StudioFieldErrors = {};
    if (!compareModelB) errors.compare = "Pick a second model to compare against.";
    else if (compareModelB.id === modelOptions.model?.id) errors.compare = "Pick two different models.";
    else if (compareNeedsApproval && !compareApproved) errors.compare = "Approve the adjusted settings to continue.";
    return errors;
  }, [mediaKind, baseFieldErrors, compareModelB, modelOptions.model?.id, compareNeedsApproval, compareApproved]);
  const compareCostLabel = useMemo(() => {
    if (mediaKind !== "compare" || compareMedia !== "video" || !compareResolved) return null;
    const a = estimateVideoCost(modelOptions.model, compareResolved.a.settings);
    const b = estimateVideoCost(compareModelB, compareResolved.b.settings);
    if (!a && !b) return null;
    return `A ${a ?? "—"} · B ${b ?? "—"}`;
  }, [mediaKind, compareMedia, compareResolved, modelOptions.model, compareModelB]);

  const searchedTurns = useMemo(() => {
    const needle = roundSearch.trim().toLowerCase();
    if (!needle) return turns;
    return turns.filter((turn) => {
      const haystack = [turn.prompt, turn.model, turn.id, activeSession?.name].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [turns, roundSearch, activeSession?.name]);

  const outputAssets = assets.filter((asset) => !["reference", "mask"].includes(asset.kind));
  const firstOutputAsset = outputAssets[0] ?? null;
  const displayOutputAssets =
    reviewFilter === "approved" || studioMode === "approved-hot"
      ? outputAssets.filter((asset) => asset.approval_status === "approved")
      : outputAssets;
  const approvedCount = outputAssets.filter((asset) => asset.approval_status === "approved").length;
  const approvedMotionCount = outputAssets.filter(
    (asset) => asset.approval_status === "approved" && asset.media_type === "video"
  ).length;
  const favoriteCount = outputAssets.filter((asset) => asset.favorite).length;
  const promptMode = editSourceAsset ? (maskAsset ? "masked_edit" : "edit") : "generate";
  const primaryActionLabel =
    mediaKind === "compare"
      ? "Generate both"
      : mediaKind === "video"
        ? "Generate video"
        : promptMode === "masked_edit"
          ? "Edit"
          : promptMode === "edit"
            ? "Edit"
            : "Generate";

  const selectedExportPresets = useMemo(
    () => (selectedAsset ? exportPresetsForAsset(config.exportPresets, selectedAsset) : []),
    [config.exportPresets, selectedAsset]
  );
  const imageExportPresetCount = useMemo(
    () => config.exportPresets.filter((preset) => (preset.media_types ?? ["image"]).includes("image")).length,
    [config.exportPresets]
  );
  const selectedAssetMetadata = useMemo(
    () => (selectedAsset ? selectedAssetReviewMetadata(selectedAsset, assets, config, turns) : null),
    [assets, config, selectedAsset, turns]
  );
  const cliffGuideSteps = useMemo(
    () => buildCliffGuideSteps(outputAssets, referenceAssets, approvedCount, approvedMotionCount),
    [approvedCount, approvedMotionCount, outputAssets, referenceAssets]
  );
  const cliffGuideProofs = useMemo(
    () => buildCliffGuideProofs(demoDoctor, readinessPackManifest),
    [demoDoctor, readinessPackManifest]
  );
  const launchReadinessItems = useMemo(
    () => buildLaunchReadinessItems(config, providerSetupState.waitingModels.length, demoDoctor, activationChecklist, readinessPackSha),
    [activationChecklist, config, demoDoctor, providerSetupState.waitingModels.length, readinessPackSha]
  );
  const mainDemoSession = useMemo(() => sessions.find(isMainDemoSession) ?? null, [sessions]);
  const showMainDemoAction = Boolean(mainDemoSession && activeSession?.id !== mainDemoSession.id);

  function showImageStudio() {
    setStudioMode("image-studio");
    setReviewFilter("all");
    setSettingsRailOpen(true);
    setStatusText("Studio is open.");
  }

  function showPresetCreator() {
    setStudioMode("preset-creator");
    setStatusText("Preset Creator is open.");
  }

  function showEnhancer() {
    setStudioMode("enhancer");
    setSettingsRailOpen(false);
    setStatusText("Enhancer is open.");
  }

  function showPromptGenerator() {
    setStudioMode("prompt-generator");
    setSettingsRailOpen(false);
    setStatusText("Prompt Generator is open.");
  }

  function showProductShotLab() {
    const productPreset = promptPresets.find((preset) => preset.key === "product-shot-lab") ?? promptPresets[0];
    setStudioMode("product-shot-lab");
    setReviewFilter("all");
    if (productPreset) {
      selectPreset(productPreset);
    }
    setStatusText("Product Shot Lab is ready.");
  }

  function showVideoLab() {
    setStudioMode("video-lab");
    setReviewFilter("all");
    clearEditSource();
    setPrompt((current) =>
      current.trim()
        ? current
        : "Create a short Frank Body motion board: product hero, subtle camera push, tactile texture moment, clean end frame."
    );
    setSettings((current) => ({
      ...current,
      aspect_ratio: supportedOption(selectedModel?.allowed_aspect_ratios, current.aspect_ratio === "9:16" ? "9:16" : "16:9", current.aspect_ratio),
      image_size: supportedOption(selectedModel?.allowed_image_sizes, "720p", supportedOption(selectedModel?.allowed_image_sizes, "1K", current.image_size)),
      count: 1
    }));
    setStatusText("Video Lab is ready for a motion board.");
  }

  function showApprovedHot() {
    const firstApproved = firstReviewableAsset(outputAssets.filter((asset) => asset.approval_status === "approved"));
    setStudioMode("approved-hot");
    setReviewFilter("approved");
    setSelectedAsset(firstApproved);
    setLightboxAsset(null);
    clearCompare();
    setStatusText(firstApproved ? "approved only. hot." : "no approved images yet.");
  }

  function showModelSettings() {
    setSettingsOpen(true);
    setStatusText("Model settings are open.");
    requestAnimationFrame(() => {
      document.getElementById("model-settings-drawer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleNewSession() {
    const nextMode = mediaKind === "video" ? "video" : "image";
    const sessionSubject =
      activeBrief?.product_name?.trim() || briefDraft.productName.trim() || activeProject?.name.trim();
    const sessionSubjectLabel = sessionSubject || activeBrief?.title || "this campaign";
    const sessionName = sessionSubject
      ? `${sessionSubject} ${nextMode === "video" ? "Motion" : "Studio"}`
      : nextMode === "video"
        ? "New video session"
        : "New image session";
    const carriedPrompt = activeBrief?.prompt || briefDraft.prompt;
    const sessionPayload = {
      name: sessionName,
      mode: nextMode,
      project_id: activeProject?.id,
      summary: activeBrief?.title
    };

    if (connection === "online") {
      const created = await createSession(sessionPayload);
      setSessions((current) => [created.session, ...current]);
      setActiveSession(created.session);
      setActiveReferenceIds([]);
      setTurns([]);
      setAssets([]);
      setExports([]);
      setSelectedAsset(null);
      setHandoffProofText("");
      setPrompt(carriedPrompt || "");
      setPromptRemixes([]);
      clearEditSource();
      clearCompare();
      setStatusText(
        activeProject || activeBrief
          ? `New session in ${sessionSubjectLabel}. Job jacket carried over.`
          : "New session. Fresh canvas."
      );
      return;
    }

    const localSession = { ...makeLocalSession(), ...sessionPayload };
    setSessions((current) => [localSession, ...current]);
    setActiveSession(localSession);
    setActiveReferenceIds([]);
    setTurns([]);
    setAssets([]);
    setExports([]);
    setSelectedAsset(null);
    setHandoffProofText("");
    setPrompt(carriedPrompt || "");
    setPromptRemixes([]);
    clearEditSource();
    clearCompare();
    setStatusText(
      activeProject || activeBrief
        ? `Local preview in ${sessionSubjectLabel}. Job jacket carried over.`
        : "Local preview session ready."
    );
  }

  async function returnToMainDemo() {
    if (!mainDemoSession) {
      setStatusText("Main demo session is not loaded yet.");
      return;
    }

    setSettingsOpen(false);
    await selectSession(mainDemoSession);
    setStatusText("Back to the Frank Body demo.");
  }

  async function selectSession(session: StudioSession) {
    setActiveSession(session);
    setActiveReferenceIds([]);
    setReferencePreviewAsset(null);
    setSelectedAsset(null);
    setHandoffProofText("");
    clearEditSource();
    clearCompare();

    if (connection !== "online") {
      return;
    }

    const projectForSession = projects.find((project) => project.id === session.project_id) ?? activeProject;
    const [turnResult, assetResult, exportResult, briefResult] = await Promise.all([
      listTurns(session.id),
      listAssets({ sessionId: session.id }),
      listExports().catch(() => ({ exports: [] })),
      projectForSession ? listBriefs(projectForSession.id).catch(() => ({ briefs: [] })) : Promise.resolve({ briefs: [] })
    ]);
    setTurns(turnResult.turns);
    setAssets(assetResult.assets);
    setExports(filterExportsForAssets(exportResult.exports, assetResult.assets));
    setActiveProject(projectForSession ?? null);
    setProjectName(projectForSession?.name ?? "Frank Body Campaign");
    setBriefs(briefResult.briefs);
    setActiveBrief(briefResult.briefs[0] ?? null);
    setBriefDraft(briefResult.briefs[0] ? briefToDraft(briefResult.briefs[0]) : makeBriefDraft());
    setSelectedAsset(firstReviewableAsset(assetResult.assets));
  }

  async function archiveSession(session: StudioSession) {
    try {
      if (connection === "online") {
        await updateSession(session.id, { status: "archived" });
      }
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not archive this session.");
      return;
    }

    const remaining = sessions.filter((item) => item.id !== session.id);
    setSessions(remaining);
    const next = chooseLaunchSession(remaining) ?? null;
    setActiveSession(next);
    setActiveReferenceIds([]);
    setTurns([]);
    setAssets([]);
    setExports([]);
    setSelectedAsset(null);
    clearEditSource();
    clearCompare();
    if (next && connection === "online") {
      await selectSession(next);
    }
    setStatusText("Session tucked away.");
  }

  function requestCancelCurrentSession() {
    if (activeSession) {
      setSessionCancelTarget(activeSession);
      setStatusText("Cancel this session? It will be archived, not deleted.");
    }
  }

  async function confirmCancelSession() {
    if (!sessionCancelTarget) {
      return;
    }

    const target = sessionCancelTarget;
    setSessionCancelTarget(null);
    await archiveSession(target);
  }

  async function checkProviderReadiness() {
    setCheckingProviders(true);
    try {
      const readiness = await fetchProviderStatus();
      setProviderReadiness(readiness);
      if (readiness.models.length) {
        setConfig((current) => ({ ...current, models: readiness.models }));
      }
      setStatusText(
        `${readiness.summary.readyModels} provider ${readiness.summary.readyModels === 1 ? "model" : "models"} ready. Keys stay server-side.`
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Provider check failed.");
    } finally {
      setCheckingProviders(false);
    }
  }

  async function checkSelectedModelPreflight() {
    if (!selectedModel) {
      return;
    }
    if (connection !== "online") {
      setStatusText("Connect to the studio backend to check the selected model.");
      return;
    }

    const kind = mediaKind === "video" ? "video" : promptMode;
    const videoSourceAsset =
      selectedAsset && selectedAsset.kind !== "reference" && selectedAsset.media_type !== "video"
        ? selectedAsset
        : outputAssets.find((asset) => asset.approval_status === "approved" && asset.media_type !== "video") ??
          outputAssets.find((asset) => asset.media_type !== "video");

    setCheckingProviderPreflight(true);
    try {
      const result = await preflightProvider({
        session_id: activeSession?.id,
        kind,
        model: selectedModel.id,
        prompt,
        settings,
        reference_asset_ids: selectedReferenceAssets.map((asset) => asset.id),
        frank_body_mode: frankBodyMode,
        preset_key: selectedPresetKey ?? undefined,
        edit_source_asset_id: kind === "video" ? videoSourceAsset?.id : editSourceAsset?.id,
        mask_asset_id: kind === "masked_edit" ? maskAsset?.id : undefined
      });
      setProviderPreflight(result);
      setStatusText(result.ready ? `${result.model_label ?? selectedModel.short_label ?? selectedModel.label} preflight ready.` : result.message);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Selected model preflight failed.");
    } finally {
      setCheckingProviderPreflight(false);
    }
  }

  async function checkProviderAdapterAudit() {
    if (connection !== "online") {
      setStatusText("Connect to the studio backend to audit provider adapters.");
      return;
    }

    setCheckingProviderAudit(true);
    try {
      const audit = await fetchProviderAudit();
      setProviderAudit(audit);
      setStatusText(
        `${audit.summary.runner_registered} / ${audit.summary.model_count} provider adapters audited with no external calls.`
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Provider adapter audit failed.");
    } finally {
      setCheckingProviderAudit(false);
    }
  }

  async function runDemoDoctor() {
    setCheckingDemoDoctor(true);
    try {
      const report = await fetchDemoDoctor();
      setDemoDoctor(report);
      hydrateLatestDemoArtifacts(report);
      setStatusText(report.readyForDemo ? "Demo Doctor says this is ready for Cliff." : "Demo Doctor found setup jobs.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Demo Doctor could not run.");
    } finally {
      setCheckingDemoDoctor(false);
    }
  }

  async function resetDemoFromDoctor() {
    setResettingDemo(true);
    try {
      const result = await resetDemo({ create_assets: true });
      const seededAssets = result.assets ?? [];
      const seededOutputs = seededAssets.filter((asset) => !["reference", "mask"].includes(asset.kind));
      const turnSettings = parseJsonRecord(result.turn.settings_json) as Partial<StudioSettings>;

      setSessions([result.session]);
      setActiveSession(result.session);
      setProjects([result.project]);
      setActiveProject(result.project);
      setProjectName(result.project.name);
      setBriefs([result.brief]);
      setActiveBrief(result.brief);
      setBriefDraft(briefToDraft(result.brief));
      setTurns([result.turn]);
      setAssets(seededAssets);
      setExports([]);
      setSelectedAsset(firstReviewableAsset(seededOutputs));
      setLightboxAsset(null);
      clearEditSource();
      clearCompare();
      setPrompt(result.brief.prompt ?? result.turn.prompt ?? "");
      setPromptRemixes([]);
      setSelectedPresetKey(result.turn.preset_key ?? result.brief.task_type ?? null);
      setAttachedPresetSnapshot(null);
      setSettings((current) => ({ ...current, ...turnSettings }));
      setDemoDoctor(result.doctor);
      setDemoEvidencePath("");
      setDemoEvidenceUrl("");
      setCallBriefPath("");
      setCallBriefUrl("");
      setCallDecision(null);
      setProviderReceiptPath("");
      setProviderReceiptUrl("");
      setBrandContextPath("");
      setBrandContextUrl("");
      setActivationChecklistPath("");
      setActivationChecklistUrl("");
      setReadinessPackPath("");
      setReadinessPackUrl("");
      setReadinessPackSha("");
      setImplementationManifestPath("");
      setImplementationManifestUrl("");
      setReadinessPackManifest(null);
      setHandoffProofText("");
      setStatusText("Demo reset. Fresh Frank Body starter session loaded.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not reset the Frank demo.");
    } finally {
      setResettingDemo(false);
    }
  }

  function hydrateLatestDemoArtifacts(report: DemoDoctorStatus) {
    if (report.summary.demoEvidenceReady) {
      setDemoEvidencePath("frank-create-demo-evidence-latest.md");
      setDemoEvidenceUrl("/api/frank/demo/evidence/frank-create-demo-evidence-latest.md");
    } else {
      setDemoEvidencePath("");
      setDemoEvidenceUrl("");
    }

    if (report.summary.callBriefReady) {
      setCallBriefPath("frank-create-call-brief-latest.md");
      setCallBriefUrl("/api/frank/demo/call-brief/frank-create-call-brief-latest.md");
    } else {
      setCallBriefPath("");
      setCallBriefUrl("");
    }
    setCallDecision(null);

    if (report.summary.providerReadinessReceiptReady) {
      setProviderReceiptPath("frank-create-provider-readiness-latest.md");
      setProviderReceiptUrl("/api/frank/demo/provider-readiness/frank-create-provider-readiness-latest.md");
    } else {
      setProviderReceiptPath("");
      setProviderReceiptUrl("");
    }

    if (report.summary.brandContextReceiptReady) {
      setBrandContextPath("frank-create-brand-context-latest.md");
      setBrandContextUrl("/api/frank/demo/brand-context/frank-create-brand-context-latest.md");
    } else {
      setBrandContextPath("");
      setBrandContextUrl("");
    }

    if (report.summary.activationChecklistReady) {
      setActivationChecklistPath("frank-create-activation-checklist-latest.md");
      setActivationChecklistUrl("/api/frank/demo/activation-checklist/frank-create-activation-checklist-latest.md");
    } else {
      setActivationChecklistPath("");
      setActivationChecklistUrl("");
    }

    if (report.summary.readinessPackReady) {
      setReadinessPackPath("frank-create-cliff-readiness-latest.zip");
      setReadinessPackUrl("/api/frank/demo/readiness-pack/frank-create-cliff-readiness-latest.zip");
      setReadinessPackSha(report.summary.readinessPackSha256 ?? "");
      setImplementationManifestPath("frank-create-implementation-manifest-latest.md");
      setImplementationManifestUrl("/api/frank/demo/readiness-pack/frank-create-implementation-manifest-latest.md");
      setReadinessPackManifest(null);
    } else {
      setReadinessPackPath("");
      setReadinessPackUrl("");
      setReadinessPackSha("");
      setImplementationManifestPath("");
      setImplementationManifestUrl("");
      setReadinessPackManifest(null);
    }
  }

  async function saveDemoEvidence() {
    setSavingDemoEvidence(true);
    try {
      const result = await createDemoEvidence({ base_url: window.location.origin });
      setDemoEvidencePath(result.latest_markdown_file ?? result.latest_markdown_path ?? result.markdown_file ?? result.markdown_path);
      setDemoEvidenceUrl(result.latest_markdown_url ?? result.markdown_url);
      openStudioLink(result.latest_markdown_url ?? result.markdown_url, "Demo evidence", `Demo evidence saved: ${result.markdown_file}`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save demo evidence.");
    } finally {
      setSavingDemoEvidence(false);
    }
  }

  async function saveCallBrief() {
    setSavingCallBrief(true);
    try {
      const result = await createDemoCallBrief({ base_url: window.location.origin });
      setCallBriefPath(result.latest_markdown_file ?? result.latest_markdown_path ?? result.markdown_file ?? result.markdown_path);
      setCallBriefUrl(result.latest_markdown_url ?? result.markdown_url);
      setCallDecision(result.brief.call_decision ?? null);
      openStudioLink(result.latest_markdown_url ?? result.markdown_url, "Call brief", `Call brief saved: ${result.latest_markdown_file ?? result.markdown_file}`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save the call brief.");
    } finally {
      setSavingCallBrief(false);
    }
  }

  async function saveProviderReadinessReceipt() {
    if (connection !== "online") {
      setStatusText("Connect to the studio backend to save the provider receipt.");
      return;
    }

    setSavingProviderReceipt(true);
    try {
      const result = await createProviderReadinessReceipt();
      setProviderReceiptPath(result.latest_markdown_file ?? result.latest_markdown_path ?? result.markdown_file ?? result.markdown_path);
      setProviderReceiptUrl(result.latest_markdown_url ?? result.markdown_url);
      setProviderAudit(result.receipt.adapter_audit);
      openStudioLink(
        result.latest_markdown_url ?? result.markdown_url,
        "Provider receipt",
        `Provider receipt saved: ${result.latest_markdown_file ?? result.markdown_file}`
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save provider readiness receipt.");
    } finally {
      setSavingProviderReceipt(false);
    }
  }

  function openStudioLink(url: string | undefined, label: string, openingText?: string) {
    if (!url) {
      setStatusText(`${label} link is not ready yet.`);
      return null;
    }
    const opened = window.open(url, "_blank");
    setStatusText(opened ? openingText ?? `Opening ${label.toLowerCase()}.` : `${label} link ready: ${url}`);
    return opened;
  }

  async function copyStudioLink(url: string, label: string) {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(url);
      setStatusText(`${label} link copied.`);
    } catch {
      setStatusText(`Could not copy ${label.toLowerCase()} link.`);
    }
  }

  async function copyProviderKeyPlan() {
    const plan = providerKeyPlanText({
      rows: providerUnlockRows,
      envVars: providerSetupState.envVars,
      readyModels: providerReadiness?.summary.readyModels,
      modelCount: providerReadiness?.summary.modelCount ?? config.models.filter((model) => model.provider !== "local").length,
      keyFilePath: providerEnvStatus?.filePath ?? "user\\frank_create\\provider_keys.env"
    });

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(plan);
      setStatusText("Provider key plan copied for Cliff. No secret values included.");
    } catch {
      setStatusText("Could not copy the provider key plan. Use the visible Cliff key order instead.");
    }
  }

  async function copyProductionUnlockPlan() {
    if (!activationChecklist) {
      setStatusText("Run the activation checklist before copying the production unlock plan.");
      return;
    }

    const plan = productionUnlockPlanText(activationChecklist);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(plan);
      setStatusText("Production unlock plan copied for Cliff. No secret values included.");
    } catch {
      setStatusText("Could not copy the production unlock plan. Use the visible activation checklist instead.");
    }
  }

  async function buildReadinessPack() {
    setBuildingReadinessPack(true);
    try {
      const result = await createDemoReadinessPack({ base_url: window.location.origin });
      setDemoEvidencePath(
        result.evidence.latest_markdown_file ??
          result.evidence.markdown_file ??
          result.evidence.latest_markdown_path ??
          result.evidence.markdown_path
      );
      setDemoEvidenceUrl(result.evidence.latest_markdown_url ?? result.evidence.markdown_url);
      if (result.call_brief) {
        setCallBriefPath(
          result.call_brief.latest_markdown_file ??
            result.call_brief.markdown_file ??
            result.call_brief.latest_markdown_path ??
            result.call_brief.markdown_path
        );
        setCallBriefUrl(result.call_brief.latest_markdown_url ?? result.call_brief.markdown_url);
      }
      if (result.provider_readiness) {
        setProviderReceiptPath(
          result.provider_readiness.latest_markdown_file ??
            result.provider_readiness.markdown_file ??
            result.provider_readiness.latest_markdown_path ??
            result.provider_readiness.markdown_path
        );
        setProviderReceiptUrl(result.provider_readiness.latest_markdown_url ?? result.provider_readiness.markdown_url);
        setProviderAudit(result.provider_readiness.receipt.adapter_audit);
      }
      if (result.brand_context) {
        setBrandContextPath(
          result.brand_context.latest_markdown_file ??
            result.brand_context.markdown_file ??
            result.brand_context.latest_markdown_path ??
            result.brand_context.markdown_path
        );
        setBrandContextUrl(result.brand_context.latest_markdown_url ?? result.brand_context.markdown_url);
      }
      if (result.activation_checklist) {
        setActivationChecklistPath(
          result.activation_checklist.latest_markdown_file ??
            result.activation_checklist.markdown_file ??
            result.activation_checklist.latest_markdown_path ??
            result.activation_checklist.markdown_path
        );
        setActivationChecklistUrl(result.activation_checklist.latest_markdown_url ?? result.activation_checklist.markdown_url);
      }
      setReadinessPackPath(result.latest_file_name ?? result.latest_file_path ?? result.file_name ?? result.file_path);
      setReadinessPackUrl(result.latest_download_url ?? result.download_url);
      setReadinessPackSha(result.latest_checksum_sha256 ?? result.checksum_sha256 ?? "");
      setImplementationManifestPath(result.latest_implementation_manifest_path ? "frank-create-implementation-manifest-latest.md" : "");
      setImplementationManifestUrl(result.latest_implementation_manifest_url ?? "");
      setReadinessPackManifest(result.manifest);
      openStudioLink(result.latest_download_url ?? result.download_url, "Call pack", `Call pack built: ${result.latest_file_name ?? result.file_name}`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not build the call pack.");
    } finally {
      setBuildingReadinessPack(false);
    }
  }

  async function createServerKeyFile() {
    setProviderEnvBusy(true);
    try {
      const status = await createProviderEnvTemplate();
      setProviderEnvStatus(status);
      setStatusText(status.created ? "Server key file created. Fill it, then reload keys." : "Server key file is already there.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not create the server key file.");
    } finally {
      setProviderEnvBusy(false);
    }
  }

  async function reloadServerKeys() {
    setProviderEnvBusy(true);
    try {
      const status = await reloadProviderEnv();
      setProviderEnvStatus(status);
      if (status.readiness) {
        setProviderReadiness(status.readiness);
        if (status.readiness.models.length) {
          setConfig((current) => ({ ...current, models: status.readiness!.models }));
        }
      }
      const loadedCount = status.loadedEnvVars?.length ?? 0;
      const ignoredPlaceholderCount = status.ignoredPlaceholderEnvVars?.length ?? 0;
      setStatusText(
        ignoredPlaceholderCount
          ? `${ignoredPlaceholderCount} placeholder key ${ignoredPlaceholderCount === 1 ? "value was" : "values were"} ignored. Paste rotated keys, then reload.`
          : loadedCount
          ? `${loadedCount} server key ${loadedCount === 1 ? "name" : "names"} reloaded.`
          : "No filled server keys found yet."
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not reload server keys.");
    } finally {
      setProviderEnvBusy(false);
    }
  }

  function updateProviderKeyDraft(envVar: string, value: string) {
    setProviderKeyDraft((current) => ({ ...current, [envVar]: value }));
  }

  async function saveServerKeys() {
    const keys = Object.fromEntries(
      Object.entries(providerKeyDraft)
        .map(([envVar, value]) => [envVar, value.trim()])
        .filter(([, value]) => value)
    );

    if (!Object.keys(keys).length) {
      setStatusText("Paste at least one rotated provider key first.");
      return;
    }

    setProviderEnvBusy(true);
    try {
      const status = await saveProviderEnvKeys(keys);
      setProviderEnvStatus(status);
      if (status.readiness) {
        setProviderReadiness(status.readiness);
        if (status.readiness.models.length) {
          setConfig((current) => ({ ...current, models: status.readiness!.models }));
        }
      }
      setProviderKeyDraft({});
      const savedCount = status.savedEnvVars?.length ?? 0;
      const ignoredPlaceholderCount = status.ignoredPlaceholderEnvVars?.length ?? 0;
      setStatusText(
        ignoredPlaceholderCount
          ? `${ignoredPlaceholderCount} placeholder key ${ignoredPlaceholderCount === 1 ? "value was" : "values were"} ignored. Paste rotated keys before saving.`
          : savedCount
          ? `${savedCount} server key ${savedCount === 1 ? "name" : "names"} saved. Secret values stayed server-side.`
          : "No provider keys were saved."
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save server keys.");
    } finally {
      setProviderEnvBusy(false);
    }
  }

  async function saveBrandKit() {
    setBrandKitBusy(true);
    try {
      if (connection !== "online") {
        setBrandKit(brandKitDraft);
        setStatusText("Connect to the studio backend to save the Brand Kit.");
        return;
      }
      const updated = await updateBrandKit(brandKitDraft);
      setBrandKit(updated.brandKit);
      setBrandKitDraft(updated.brandKit);
      setStatusText("Brand kit saved for Frank Body Mode.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save the Brand Kit.");
    } finally {
      setBrandKitBusy(false);
    }
  }

  async function saveBrandContextBrief() {
    if (connection !== "online") {
      setStatusText("Connect to the studio backend to save the brand context brief.");
      return;
    }

    setBrandContextBusy(true);
    try {
      const result = await createBrandContextReceipt({ session_id: activeSession?.id });
      setBrandContextPath(result.latest_markdown_file ?? result.latest_markdown_path ?? result.markdown_file ?? result.markdown_path);
      setBrandContextUrl(result.latest_markdown_url ?? result.markdown_url);
      const refs = result.receipt.summary.reference_asset_count;
      openStudioLink(
        result.latest_markdown_url ?? result.markdown_url,
        "Brand context",
        `Brand context brief saved: ${refs} reference ${refs === 1 ? "asset" : "assets"} counted.`
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save the brand context brief.");
    } finally {
      setBrandContextBusy(false);
    }
  }

  async function saveProjectBrief() {
    if (!activeSession) {
      setStatusText("Open a session before saving a brief.");
      return;
    }

    setBriefBusy(true);
    try {
      if (connection !== "online") {
        setStatusText("Connect to the studio backend to save the brief.");
        return;
      }

      const cleanProjectName = projectName.trim() || briefDraft.productName.trim() || "Frank Body Campaign";
      let project = activeProject;
      if (!project || project.name !== cleanProjectName) {
        const createdProject = await createProject({ name: cleanProjectName, client: "Frank Body", status: "active" });
        project = createdProject.project;
        setProjects((current) => [project!, ...current.filter((item) => item.id !== project!.id)]);
      }

      const briefPayload = createBriefPayload({ ...briefDraft, title: "" }, project.id);
      const savedBrief =
        activeBrief && activeBrief.project_id === project.id
          ? await updateBrief(activeBrief.id, briefPayload)
          : await createBrief(briefPayload);
      const updatedSession = await updateSession(activeSession.id, {
        project_id: project.id,
        summary: savedBrief.brief.title
      });

      setActiveProject(project);
      setProjectName(project.name);
      setActiveBrief(savedBrief.brief);
      setBriefDraft(briefToDraft(savedBrief.brief));
      setBriefs((current) => [savedBrief.brief, ...current.filter((item) => item.id !== savedBrief.brief.id)]);
      setActiveSession(updatedSession.session);
      setSessions((current) => current.map((session) => (session.id === updatedSession.session.id ? updatedSession.session : session)));
      if (!prompt.trim() && savedBrief.brief.prompt) {
        setPrompt(savedBrief.brief.prompt);
      }
      setStatusText(
        activeBrief && activeBrief.project_id === project.id
          ? "Brief updated. Job jacket is current."
          : "Brief saved. The studio has a job jacket now."
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save the campaign brief.");
    } finally {
      setBriefBusy(false);
    }
  }

  function inspectAsset(asset: Asset) {
    if (armedFrameSlot) {
      assignFrameSlot(armedFrameSlot, asset.id);
      return;
    }
    if (compareBaseAsset && asset.kind !== "reference") {
      if (asset.id === compareBaseAsset.id) {
        setStatusText("Pick a different image to compare.");
        return;
      }
      setSelectedAsset(asset);
      setCompareTargetAsset(asset);
      setLightboxAsset(null);
      setStatusText("Compare the picks side by side.");
      return;
    }

    setSelectedAsset(asset);
    setLightboxAsset(asset);
  }

  function startCompare(asset: Asset) {
    setCompareBaseAsset(asset);
    setCompareTargetAsset(null);
    setLightboxAsset(null);
    setStatusText("Choose another output to compare.");
  }

  function clearCompare() {
    setCompareBaseAsset(null);
    setCompareTargetAsset(null);
  }

  function syncCompareAsset(asset: Asset) {
    setCompareBaseAsset((current) => (current?.id === asset.id ? asset : current));
    setCompareTargetAsset((current) => (current?.id === asset.id ? asset : current));
  }

  function hydratePromptFromBrief(brief?: Brief | null) {
    if (!brief?.prompt) {
      return;
    }
    setPrompt((current) => (current.trim() ? current : brief.prompt ?? ""));
  }

  function insertReferenceTag(tag: string) {
    const el = promptInputRef.current;
    const caret = el ? (el.selectionStart ?? prompt.length) : prompt.length;
    const { text, caret: nextCaret } = insertTagAtCaret(prompt, tag, caret);
    setPrompt(text);
    setStatusText(`${tag} added to the prompt.`);
    requestAnimationFrame(() => {
      const node = promptInputRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function removeReferenceFromDock(asset: Asset) {
    detachReferences([asset], true);
    setStatusText(`${asset.title} removed from references.`);
  }

  function splitReferenceLibrary(pool: Asset[]) {
    const images = pool.filter((asset) => asset.media_type !== "video" && asset.kind !== "mask");
    const seen = new Set<string>();
    const merged = images
      .slice()
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      })
      .filter((asset) => {
        const key = asset.file_path || asset.remote_url || asset.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    setReferenceLibrary(merged);
  }


  const referencePickerLimit = Math.min(10, modelOptions.referenceLimit || 10);

  async function openReferencePicker() {
    setReferencePickerOpen(true);
    setReferencePickerSelection([]);
    setReferencePickerNote(null);
    if (connection !== "online") {
      splitReferenceLibrary(assets);
      return;
    }
    setReferenceLibraryLoading(true);
    try {
      const { assets: library } = await listAssets({});
      splitReferenceLibrary(library ?? assets);
    } catch (err) {
      console.error("[frank] reference library load failed", err);
      splitReferenceLibrary(assets);
    } finally {
      setReferenceLibraryLoading(false);
    }
  }

  function togglePickerSelection(asset: Asset) {
    setReferencePickerNote(null);
    setReferencePickerSelection((current) => {
      if (current.includes(asset.id)) return current.filter((id) => id !== asset.id);
      if (current.length >= referencePickerLimit) {
        setReferencePickerNote(`You can pick up to ${referencePickerLimit} references at a time.`);
        return current;
      }
      return [...current, asset.id];
    });
  }

  async function confirmReferencePickerSelection() {
    const picks = referencePickerSelection
      .map((id) => referenceLibrary.find((asset) => asset.id === id))
      .filter((asset): asset is Asset => Boolean(asset));
    if (!picks.length) {
      setReferencePickerOpen(false);
      return;
    }
    setReferencePickerBusy(true);
    try {
      for (const pick of picks) {
        if (pick.kind === "reference") {
          setActiveReferenceIds((current) => Array.from(new Set([...current, pick.id])));
        } else {
          await useAssetAsReference(pick);
        }
      }
    } finally {
      setReferencePickerBusy(false);
      setReferencePickerSelection([]);
      setReferencePickerOpen(false);
    }
  }

  async function handleReferenceUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    await addReferenceFiles(files);
    event.target.value = "";
  }

  async function handlePickerUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setReferencePickerBusy(true);
    setReferencePickerNote(null);
    try {
      const created = await addReferenceFiles(files, { attach: false });
      if (created?.length) {
        setReferenceLibrary((current) => [...created, ...current]);
        setReferencePickerSelection((current) =>
          Array.from(new Set([...current, ...created.map((asset) => asset.id)])).slice(0, referencePickerLimit)
        );
      }
    } finally {
      setReferencePickerBusy(false);
    }
  }

  async function addReferenceFiles(files: File[], options?: { attach?: boolean }) {
    const attach = options?.attach !== false;
    if (!files.length || !activeSession) {
      return [];
    }


    setStatusText("Adding reference images...");
    const createdAssets: Asset[] = [];
    const failedUploads: string[] = [];

    for (const file of files.slice(0, modelOptions.referenceLimit || files.length)) {
      const localPreview = await fileToDataUrl(file).catch(() => URL.createObjectURL(file));
      let remoteUrl: string | undefined;
      let storagePath: string | undefined;
      let uploadedReference: Asset | undefined;
      if (connection === "online") {
        try {
          const { uploadReferenceToStorage } = await import("./lib/api");
          const { url, path } = await uploadReferenceToStorage(file, activeSession.id);
          remoteUrl = url;
          storagePath = path;
          const created = await createReference({
            session_id: activeSession.id,
            title: file.name,
            file_path: path,
            preview_url: url,
            media_type: "image",
            sync_status: "cloud"
          });
          uploadedReference = {
            ...created.asset,
            title: created.asset.title || file.name,
            preview_url: localPreview,
            remote_url: created.asset.remote_url || url,
            file_path: created.asset.file_path || path,
            kind: "reference",
            media_type: "image",
            favorite: created.asset.favorite ?? false,
            approval_status: created.asset.approval_status || "review",
            sync_status: "cloud"
          };
        } catch (err) {
          console.error("[frank] reference upload failed", err);
          failedUploads.push(file.name);
          continue;
        }
      }

      createdAssets.push(uploadedReference ?? {
        id: makeLocalId("asset"),
        session_id: activeSession.id,
        kind: "reference",
        title: file.name,
        media_type: "image",
        file_path: storagePath,
        preview_url: localPreview,
        remote_url: remoteUrl,
        favorite: false,
        approval_status: "review",
        sync_status: "local"
      });
    }

    if (createdAssets.length) {
      setAssets((current) => [...createdAssets, ...current]);
      if (attach) {
        setActiveReferenceIds((current) => Array.from(new Set([...current, ...createdAssets.map((asset) => asset.id)])));
      }
    }
    if (failedUploads.length && createdAssets.length) {
      setStatusText(`${createdAssets.length} reference${createdAssets.length === 1 ? "" : "s"} locked. ${failedUploads.length} upload${failedUploads.length === 1 ? "" : "s"} failed.`);
    } else if (failedUploads.length) {
      setStatusText("Reference upload failed. Please try again.");
    } else if (createdAssets.length) {
      setStatusText("Reference locked. Nice.");
    }
    return createdAssets;
  }


  function imagesFromClipboard(data: DataTransfer | null | undefined) {
    const items = Array.from(data?.items ?? []);
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const ext = (file.type.split("/")[1] || "png").split("+")[0];
          const named = file.name && file.name !== "image.png"
            ? file
            : new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type });
          imageFiles.push(named);
        }
      }
    }
    return imageFiles;
  }

  async function handlePromptPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = imagesFromClipboard(event.clipboardData);
    if (imageFiles.length) {
      event.preventDefault();
      await addReferenceFiles(imageFiles);
    }
  }

  useEffect(() => {
    function onGlobalPaste(event: ClipboardEvent) {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      // Let dedicated composers (which preventDefault themselves) handle their own paste.
      if (target?.closest?.("[data-paste-scope]")) return;
      const imageFiles = imagesFromClipboard(event.clipboardData);
      if (!imageFiles.length) return;
      event.preventDefault();
      void addReferenceFiles(imageFiles);
    }
    window.addEventListener("paste", onGlobalPaste);
    return () => window.removeEventListener("paste", onGlobalPaste);
  }, [activeSession?.id, modelOptions.referenceLimit, connection]);


  function handlePromptDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  async function handlePromptDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length) {
      await addReferenceFiles(files);
      return;
    }
    const droppedId = event.dataTransfer?.getData("application/x-frank-asset") || "";
    if (droppedId) {
      const dropped = assets.find((item) => item.id === droppedId);
      if (dropped) {
        await useAssetAsReference(dropped);
      }
      return;
    }
  }


  async function saveMaskFile(file: File, sourceAsset: Asset) {
    if (!activeSession) {
      throw new Error("Start a session before adding a mask.");
    }

    setStatusText("Adding edit mask...");


    const localPreview = URL.createObjectURL(file);
    const localMask: Asset = {
      id: makeLocalId("asset"),
      session_id: sourceAsset.session_id ?? activeSession.id,
      kind: "mask",
      title: file.name,
      media_type: "image",
      preview_url: localPreview,
      source_asset_id: sourceAsset.id,
      favorite: false,
      approval_status: "review",
      sync_status: "local"
    };
    setMaskAsset(localMask);
    setAssets((current) => [localMask, ...current]);
    setStatusText("Mask locked for this edit.");
    return localMask;
  }

  async function handleMaskUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !activeSession || !editSourceAsset) {
      return;
    }

    try {
      await saveMaskFile(file, editSourceAsset);
    } catch {
      setStatusText("Mask upload failed. Try again.");
    }
    event.target.value = "";
  }

  async function handlePaintedMaskSave(file: File) {
    if (!maskPainterAsset) {
      return;
    }

    setMaskPainterBusy(true);
    try {
      await saveMaskFile(file, maskPainterAsset);
      setMaskPainterAsset(null);
    } catch {
      setStatusText("Painted mask could not be saved. Try uploading a PNG mask.");
    } finally {
      setMaskPainterBusy(false);
    }
  }

  async function handlePromptRemix() {
    const seedPrompt = prompt.trim() || activePreset?.prompt || "";
    if (!seedPrompt) {
      setStatusText("Give the Art Dept. a brief first.");
      return;
    }

    setRemixBusy(true);
    try {
      const result = await remixPrompt({
        prompt: seedPrompt,
        preset_key: selectedPresetKey ?? "",
        frank_body_mode: frankBodyMode
      });
      setPromptRemixes(result.variants);
      setStatusText("Brief remixed. Pick a direction.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Brief remix needs another look.");
    } finally {
      setRemixBusy(false);
    }
  }

  function applyPromptRemix(variant: PromptRemixVariant) {
    setPrompt(variant.prompt);
    setPromptRemixes([]);
    setStatusText(`${variant.label} direction loaded.`);
  }




  async function handleGenerate(event?: FormEvent) {
    event?.preventDefault();
    if (!activeSession || !selectedModel || !prompt.trim()) {
      setStatusText("Give the studio a prompt first.");
      return;
    }

    if (mediaKind === "compare") {
      await handleCompareGenerate();
      return;
    }

    if (mediaKind === "video" || isVideoModel(selectedModel)) {
      await handleVideoGenerate();
      return;
    }


    if (promptMode === "edit" && !selectedModel.capabilities.edit) {
      setStatusText(`${selectedModel.short_label ?? selectedModel.label} cannot edit images yet.`);
      return;
    }

    if (promptMode === "masked_edit" && !selectedModel.capabilities.masked_edit) {
      setStatusText(`${selectedModel.short_label ?? selectedModel.label} cannot use masks yet.`);
      return;
    }

    const referenceLimitMessage = modelReferenceLimitAction(selectedModel, selectedReferenceAssets.length);
    if (referenceLimitMessage) {
      setStatusText(referenceLimitMessage);
      return;
    }

    const preflightErrors = validateStudioSettings(selectedModel, settings, {
      referenceCount: selectedReferenceAssets.length
    });
    if (hasStudioFieldErrors(preflightErrors)) {
      const firstMsg = preflightErrors.aspect ?? preflightErrors.size ?? preflightErrors.count ?? preflightErrors.references;
      setStatusText(firstMsg ?? "Fix the highlighted fields.");
      if (typeof document !== "undefined") {
        const el = document.querySelector<HTMLElement>('[data-studio-invalid="true"]');
        el?.focus?.();
      }
      return;
    }

    const referencePairs = selectedReferenceAssets
      .map((asset) => ({ asset, url: referenceUrlForGeneration(asset) }))
      .filter((pair): pair is { asset: Asset; url: string } =>
        typeof pair.url === "string" && /^https?:\/\//.test(pair.url));
    const generationReferenceUrls = referencePairs.map((pair) => pair.url);
    const generationReferenceAssets = referencePairs.map((pair) => pair.asset);
    const unknownTags = unknownReferenceTags(prompt, generationReferenceAssets.length);
    if (unknownTags.length) {
      setStatusText(`${unknownTags.join(", ")} ${unknownTags.length === 1 ? "does" : "do"} not match a loaded reference. Remove the tag or add the image.`);
      return;
    }
    const providerPrompt = composeReferencePrompt(prompt, generationReferenceAssets);
    if (selectedReferenceAssets.length && !generationReferenceUrls.length) {
      setStatusText("Reference images are still uploading. Try again in a moment.");
      return;
    }

    setBusy(true);
    setGenPhase("queued");
    setGenError(null);
    setGenErrorOpen(false);
    setStatusText(promptMode === "generate" ? "Preparing the next round..." : "Preparing the edit brief...");
    const inflightId = makeLocalId("gen");
    const inflightEntry: InflightGen = {
      id: inflightId,
      modelId: selectedModel.id,
      modelLabel: modelName(config, selectedModel.id),
      prompt: prompt,
      aspect: settings.aspect_ratio,
      count: Math.max(1, settings.count),
    };
    setInflightGens((current) => [...current, inflightEntry]);
    const finishInflight = () => setInflightGens((current) => current.filter((g) => g.id !== inflightId));


    const request = buildTurnRequest({
      sessionId: activeSession.id,
      modelId: selectedModel.id,
      prompt,
      promptMode,
      frankBodyMode,
      presetKey: selectedPresetKey ?? undefined,
      settings,
      referenceAssetIds: selectedReferenceAssets.map((asset) => asset.id),
      referenceImageUrls: generationReferenceUrls,
      providerPrompt,
      editSourceAssetId: editSourceAsset?.id,
      maskAssetId: promptMode === "masked_edit" ? maskAsset?.id : undefined
    });

    // The request owns the snapshot above. Empty the visible dock immediately,
    // before waiting for the provider, so the next run always starts clean.
    clearReferenceDock();

    if (connection !== "online") {
      // Auto-name the session from the first prompt if it still has the default name.
      if (activeSession && (!activeSession.name || /^(new session|launch image studio|untitled)/i.test(activeSession.name)) && turns.length === 0) {
        const autoName = prompt.trim().replace(/\s+/g, " ").slice(0, 40) || activeSession.name;
        if (autoName && autoName !== activeSession.name) {
          const renamed = { ...activeSession, name: autoName };
          setActiveSession(renamed);
          setSessions((current) => current.map((s) => (s.id === renamed.id ? renamed : s)));
        }
      }
      const invokeBody = {
        prompt: providerPrompt,
        count: settings.count,
        modelId: selectedModel.id,
        aspect_ratio: settings.aspect_ratio,
        size: settings.image_size,
        thinking_budget: settings.thinking_budget ?? 0,
        reference_images: generationReferenceUrls,
      };
      try {
        setGenPhase("running");
        setStatusText("Model is running...");
        const ctrl = new AbortController();
        generateAbortRef.current = ctrl;
        const { data, error } = await supabase.functions.invoke("frank-generate", {
          body: invokeBody,
          // supabase-js v2 forwards this AbortSignal to the underlying fetch.
          // Aborting closes the connection so the edge function's req.signal
          // fires and cancels the in-flight Replicate prediction.
          // signal option is supported at runtime by supabase-js v2.
          signal: ctrl.signal,
        } as Parameters<typeof supabase.functions.invoke>[1]);
        if (error) throw error;
        const images: string[] = (data as { images?: string[] })?.images ?? [];
        if (!images.length) throw new Error("No image returned");


        const nowIso = new Date().toISOString();
        const turnId = makeLocalId("turn");
        const requestedAspect = aspectRatioParts(settings.aspect_ratio);
        const newAssets: Asset[] = images.map((dataUrl, idx) => ({
          id: makeLocalId("asset"),
          session_id: activeSession.id,
          turn_id: turnId,
          kind: "generated",
          title: `Lovable AI pick ${idx + 1}`,
          media_type: "image",
          provider: "lovable-ai",
          model: selectedModel.id,
          prompt: request.prompt,
          settings_json: JSON.stringify(settings),
          preview_url: dataUrl,
          width: requestedAspect?.width,
          height: requestedAspect?.height,
          favorite: false,
          approval_status: "review",
          sync_status: "local",
          created_at: nowIso,
          updated_at: nowIso,
        }));

        const turn: StudioTurn = {
          id: turnId,
          session_id: activeSession.id,
          kind: request.kind,
          provider: "lovable-ai",
          model: request.model,
          prompt: request.prompt,
          settings_json: JSON.stringify(request.settings),
          reference_asset_ids_json: JSON.stringify(request.reference_asset_ids),
          output_asset_ids_json: JSON.stringify(newAssets.map((a) => a.id)),
          frank_body_mode: request.frank_body_mode,
          preset_key: request.preset_key,
          status: "complete",
          sync_status: "local",
          created_at: nowIso,
          updated_at: nowIso,
        };

        setTurns((current) => [...current, turn]);
        setAssets((current) => [...newAssets, ...current]);
        setSelectedAsset(newAssets[0]);
        setStatusText(`Generated ${newAssets.length} pick${newAssets.length === 1 ? "" : "s"} via Lovable AI.`);
        setRetrySafePayload(null);
        setGenPhase("completed");
        setGenError(null);

      } catch (err) {
        // Aborted by the user: don't render a red "failed" error card; show a canceled state.
        const isAbort =
          (err as { name?: string })?.name === "AbortError" ||
          generateAbortRef.current?.signal.aborted;
        if (isAbort) {
          setStatusText("Canceled.");
          setGenPhase("failed");
          setGenError({ message: "Canceled by user.", code: "canceled", retryable: true });
          setRetrySafePayload(invokeBody);
          const localTurn = makeLocalTurn(activeSession.id, request);
          setTurns((current) => [...current, localTurn]);
        } else {
          // Surface structured error info from frank-generate when available.
          let message = err instanceof Error ? err.message : "Lovable AI generation failed.";
          let code: string | undefined;
          let retryable: boolean | undefined;
          let httpStatus: number | undefined;
          let raw: string | undefined;
          let requestId: string | undefined;
          try {
            const ctx = (err as { context?: Response }).context;
            if (ctx && typeof ctx.json === "function") {
              httpStatus = ctx.status;
              const parsed = await ctx.clone().json();
              raw = JSON.stringify(parsed, null, 2);
              if (parsed?.error) message = String(parsed.error);
              if (parsed?.code) code = String(parsed.code);
              if (typeof parsed?.retryable === "boolean") retryable = parsed.retryable;
              if (parsed?.request_id) requestId = String(parsed.request_id);
            }
          } catch { /* body already consumed or non-JSON */ }
          const idSuffix = requestId ? ` · req ${requestId.slice(0, 8)}` : "";
          const suffix = code ? ` [${code}${retryable === false ? " — not retryable" : retryable ? " — safe to retry" : ""}${idSuffix}]` : idSuffix;
          setStatusText(`Lovable AI: ${message}${suffix}`);
          setRetrySafePayload(retryable === true ? invokeBody : null);
          setGenPhase("failed");
          setGenError({ message, code, retryable, httpStatus, raw, requestId });
          const localTurn = makeLocalTurn(activeSession.id, request);
          setTurns((current) => [...current, localTurn]);
        }
      } finally {
        generateAbortRef.current = null;
        finishInflight();
        setBusy(false);
      }

      return;
    }

    const missingKeyMessage = modelMissingKeyAction(selectedModel);
    if (missingKeyMessage) {
      setStatusText(missingKeyMessage);
      return;
    }

    try {
      let result = await createInferenceTurn(request);
      setTurns((current) => [...current, result.turn]);

      // The backend hands back "running" for providers that can outlive one
      // request (Riverflow 4K, Seedream). Keep polling until it closes out.
      if (result.status === "running") {
        setStatusText("Model is running — long jobs keep going, this can take a few minutes...");
        const final = await pollTurnUntilDone(result.turn.id);
        if (final) result = { ...result, ...final } as typeof result;
      }

      if (result.status === "blocked") {
        setStatusText(`Server key needed: ${(result.error?.env_vars ?? []).join(" or ")}`);
      } else if (result.status === "failed") {
        const turnError = turnErrorCopy(result.turn);
        const message = result.error?.message || turnError || "Generation failed.";
        setGenPhase("failed");
        setGenError({
          message,
          code: result.error?.code,
          retryable: result.error?.retryable,
          httpStatus: result.error?.status,
          raw: result.error?.raw,
          requestId: result.error?.request_id,
        });
        setRetrySafePayload(result.error?.retryable === true ? {
          prompt: request.prompt,
          count: settings.count,
          modelId: selectedModel.id,
          aspect_ratio: settings.aspect_ratio,
          size: settings.image_size,
          thinking_budget: settings.thinking_budget ?? 0,
          reference_images: generationReferenceUrls,
        } : null);
        setStatusText(
          message ||
            inferenceStatusCopy({
              status: result.status,
              assetCount: result.assets?.length ?? 0,
              localEngine: result.localEngine,
              fallbackReason: result.fallbackReason
            })
        );
      } else {
        if (result.status === "complete" && result.assets?.length) {
          setAssets((current) => [...result.assets!, ...current]);
          setSelectedAsset(result.assets[0]);
          if (promptMode !== "generate") {
            setEditSourceAsset(null);
            setMaskAsset(null);
          }
          clearCompare();
        }
        setStatusText(
          inferenceStatusCopy({
            status: result.status,
            assetCount: result.assets?.length ?? 0,
            localEngine: result.localEngine,
            fallbackReason: result.fallbackReason
          })
        );
      }

    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "This round needs another look.");
    } finally {
      finishInflight();
      setBusy(false);
      // The request can time out while the server keeps finishing the round
      // (e.g. 4 images). Re-read the session so every produced image lands.
      void reconcileSessionAssets();
    }
  }

  // Poll a "running" turn until the backend reports complete/failed. Turn cards
  // stay on screen the whole time, so a refresh mid-run loses nothing.
  async function pollTurnUntilDone(turnId: string) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 4 ? 2500 : 5000));
      let snapshot: Awaited<ReturnType<typeof fetchTurnStatus>>;
      try {
        snapshot = await fetchTurnStatus(turnId);
      } catch {
        continue;
      }
      setTurns((current) => current.map((turn) => (turn.id === turnId ? snapshot.turn : turn)));
      if (snapshot.status !== "running") {
        return snapshot;
      }
    }
    return null;
  }

  // Pull turns + assets for the active session and merge them into local state
  // without dropping anything already on screen.
  async function reconcileSessionAssets() {
    if (connection !== "online" || !activeSession) return;
    try {
      const [turnResult, assetResult] = await Promise.all([
        listTurns(activeSession.id),
        listAssets({ sessionId: activeSession.id }),
      ]);
      setTurns((current) => {
        const byId = new Map(current.map((t) => [t.id, t]));
        for (const turn of turnResult.turns) byId.set(turn.id, turn);
        return Array.from(byId.values()).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
      setAssets((current) => {
        const byId = new Map(current.map((a) => [a.id, a]));
        for (const asset of assetResult.assets) byId.set(asset.id, asset);
        return Array.from(byId.values()).sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        );
      });
    } catch {
      /* reconcile is best-effort */
    }
  }


  async function handleVideoGenerate() {
    if (!activeSession || !prompt.trim()) {
      setStatusText("Brief the motion first.");
      return;
    }

    if (connection !== "online") {
      setStatusText("Backend is offline — video needs the cloud provider.");
      return;
    }

    const videoModel = isVideoModel(selectedModel)
      ? selectedModel
      : mediaModels.find((model) => model.status === "ready") ?? selectedModel;

    // Frames are explicit: whatever sits in the rail's first/last frame slots.
    const sourceAsset = videoFirstFrame ?? undefined;
    const lastFrameAsset = videoModel?.supports_last_frame && sourceAsset ? (videoLastFrame ?? undefined) : undefined;

    if (videoModel?.requires_source_image && !sourceAsset) {
      setStatusText(`${videoModel.short_label ?? videoModel.label} needs a source frame. Fill the first frame slot in the settings rail.`);
      return;
    }

    const videoSettings = videoModel ? normalizeVideoSettings(settings, videoModel) : settings;
    const videoProviderPrompt = composeVideoReferencePrompt(
      prompt,
      selectedReferenceAssets,
      sourceAsset,
      lastFrameAsset
    );
    clearReferenceDock();

    const ctrl = new AbortController();
    videoAbortRef.current = ctrl;
    setBusy(true);
    setVideoStartedAt(Date.now());
    setStatusText(`Rendering ${videoSettings.duration ?? ""}s clip with ${videoModel?.short_label ?? "the video model"}...`);

    // Show the run in the thread immediately, in a loading state, until the
    // clip lands (or the run fails / is canceled).
    const inflightId = makeLocalId("gen");
    setInflightGens((current) => [
      ...current,
      {
        id: inflightId,
        modelId: videoModel?.id ?? "video",
        modelLabel: videoModel ? modelName(config, videoModel.id) : "Video model",
        prompt,
        aspect: videoSettings.aspect_ratio,
        count: 1,
      },
    ]);
    const finishVideoInflight = () =>
      setInflightGens((current) => current.filter((g) => g.id !== inflightId));


    try {
      const result = await createVideoStoryboard({
        session_id: activeSession.id,
        model: videoModel?.id,
        prompt,
        settings: videoSettings,
        source_asset_id: sourceAsset?.id,
        last_frame_asset_id: lastFrameAsset?.id,
        reference_asset_ids: selectedReferenceAssets.map((asset) => asset.id),
        provider_prompt: videoProviderPrompt
      }, { signal: ctrl.signal });
      setTurns((current) => [...current, result.turn]);
      if (result.status === "blocked") {
        setStatusText(`Server key needed: ${(result.error?.env_vars ?? []).join(" or ")}`);
        return;
      }
      if (result.status === "failed") {
        setStatusText(result.error?.message ?? "The video model returned no clip.");
        return;
      }
      if (result.assets?.length) {
        setAssets((current) => [...result.assets!, ...current]);
        setSelectedAsset(result.assets[0]);
        setStatusText("Motion board is on the wall.");
        return;
      }
      setStatusText("The video model returned no clip.");
    } catch (error) {
      if (ctrl.signal.aborted) {
        setStatusText("Video generation canceled.");
      } else {
        const msg = error instanceof Error ? error.message : "Video generation needs another look.";
        if (/desktop|video_not_supported/i.test(msg)) {
          setDesktopNotice("This video action is not available in the current environment.");
          setStatusText("Video generation is desktop-only. See the notice at the top for details.");
        } else {
          setStatusText(msg);
        }
      }
    } finally {
      finishVideoInflight();
      videoAbortRef.current = null;

      setVideoStartedAt(null);
      setBusy(false);
    }
  }

  /**
   * Side-by-side: fire two provider calls with the same brief — one per model —
   * each with settings snapped to what that model accepts, and tag both turns
   * with a shared compare group so the timeline renders them as one A/B row.
   */
  async function handleCompareGenerate() {
    if (!activeSession || !prompt.trim()) {
      setStatusText("Give the studio a prompt first.");
      return;
    }
    const modelA = selectedModel;
    const modelB = compareModelB;
    if (!modelA || !modelB || modelA.id === modelB.id) {
      setStatusText("Pick two different models to compare.");
      return;
    }
    if (connection !== "online") {
      setStatusText("Side-by-side needs the cloud backend.");
      return;
    }
    if (compareNeedsApproval && !compareApproved) {
      setStatusText("Approve the adjusted settings first — some values aren't supported by both models.");
      return;
    }

    const referenceCount = selectedReferenceAssets.length;
    const comparePairs = selectedReferenceAssets
      .map((asset) => ({ asset, url: referenceUrlForGeneration(asset) }))
      .filter((pair): pair is { asset: Asset; url: string } =>
        typeof pair.url === "string" && /^https?:\/\//.test(pair.url));
    const generationReferenceUrls = comparePairs.map((pair) => pair.url);
    const compareReferenceAssets = comparePairs.map((pair) => pair.asset);
    const compareUnknownTags = unknownReferenceTags(prompt, compareReferenceAssets.length);
    if (compareUnknownTags.length) {
      setStatusText(`${compareUnknownTags.join(", ")} ${compareUnknownTags.length === 1 ? "does" : "do"} not match a loaded reference.`);
      return;
    }
    if (referenceCount && !generationReferenceUrls.length) {
      setStatusText("Reference images are still uploading. Try again in a moment.");
      return;
    }

    const groupId = makeLocalId("cmp");
    const sides: Array<{ side: "A" | "B"; model: StudioModel }> = [
      { side: "A", model: modelA },
      { side: "B", model: modelB }
    ];

    const inflight: InflightGen[] = sides.map(({ side, model }) => ({
      id: makeLocalId("gen"),
      modelId: model.id,
      modelLabel: `Side ${side} · ${modelName(config, model.id)}`,
      prompt,
      aspect: settings.aspect_ratio,
      count: 1,
    }));
    setInflightGens((current) => [...current, ...inflight]);
    setBusy(true);
    setGenPhase("running");
    setGenError(null);
    setGenErrorOpen(false);
    setStatusText(`Running ${modelName(config, modelA.id)} vs ${modelName(config, modelB.id)}...`);
    const compareFirstFrame = videoFirstFrame;
    const compareLastFrame = videoLastFrame;
    clearReferenceDock();

    const runSide = async ({ side, model }: { side: "A" | "B"; model: StudioModel }) => {
      const resolved = resolveForModel(model, settings, { referenceCount });
      const sideSettings: StudioSettings = {
        ...resolved.settings,
        count: 1,
        compare_group: groupId,
        compare_side: side
      };
      const sideReferenceAssets = compareReferenceAssets.slice(0, resolved.referenceLimit);
      const sideReferenceUrls = generationReferenceUrls.slice(0, resolved.referenceLimit);
      const sideProviderPrompt = composeReferencePrompt(prompt, sideReferenceAssets);

      if (compareMedia === "video") {
        const sourceAsset = compareFirstFrame ?? undefined;
        const lastFrameAsset = model.supports_last_frame && sourceAsset ? (compareLastFrame ?? undefined) : undefined;
        if (model.requires_source_image && !sourceAsset) {
          throw new Error(`${model.short_label ?? model.label} needs a source frame.`);
        }
        return createVideoStoryboard({
          session_id: activeSession.id,
          model: model.id,
          prompt,
          settings: sideSettings,
          source_asset_id: sourceAsset?.id,
          last_frame_asset_id: lastFrameAsset?.id,
          reference_asset_ids: sideReferenceAssets.map((asset) => asset.id),
          provider_prompt: composeVideoReferencePrompt(prompt, sideReferenceAssets, sourceAsset, lastFrameAsset)
        });
      }

      const request = buildTurnRequest({
        sessionId: activeSession.id,
        modelId: model.id,
        prompt,
        promptMode: "generate",
        frankBodyMode,
        presetKey: selectedPresetKey ?? undefined,
        settings: sideSettings,
        referenceAssetIds: sideReferenceAssets.map((asset) => asset.id),
        referenceImageUrls: sideReferenceUrls,
        providerPrompt: sideProviderPrompt
      });
      const started = await createInferenceTurn(request);
      if (started.status === "running") {
        const final = await pollTurnUntilDone(started.turn.id);
        if (final) return { ...started, ...final } as typeof started;
      }
      return started;
    };

    try {
      const results = await Promise.allSettled(sides.map(runSide));
      const newTurns: StudioTurn[] = [];
      const newAssets: Asset[] = [];
      const failures: string[] = [];

      results.forEach((result, index) => {
        const { side, model } = sides[index];
        const label = modelName(config, model.id);
        if (result.status === "rejected") {
          failures.push(`Side ${side} (${label}): ${result.reason instanceof Error ? result.reason.message : "failed"}`);
          return;
        }
        const value = result.value;
        if (value.turn) newTurns.push(value.turn);
        if (value.assets?.length) newAssets.push(...value.assets);
        if (value.status === "failed" || value.status === "blocked") {
          failures.push(`Side ${side} (${label}): ${value.error?.message ?? value.status}`);
        }
      });

      if (newTurns.length) setTurns((current) => [...current, ...newTurns]);
      if (newAssets.length) {
        setAssets((current) => [...newAssets, ...current]);
        setSelectedAsset(newAssets[0]);
      }

      if (failures.length) {
        setGenPhase("failed");
        setGenError({ message: failures.join(" · "), retryable: true });
        setStatusText(failures.join(" · "));
      } else {
        setGenPhase("completed");
        setStatusText(`Side-by-side ready — ${modelName(config, modelA.id)} vs ${modelName(config, modelB.id)}.`);
      }
    } catch (error) {
      setGenPhase("failed");
      setStatusText(error instanceof Error ? error.message : "Side-by-side run failed.");
    } finally {
      const ids = new Set(inflight.map((entry) => entry.id));
      setInflightGens((current) => current.filter((entry) => !ids.has(entry.id)));
      setBusy(false);
      void reconcileSessionAssets();
    }
  }




  async function changeAssetStatus(asset: Asset, approval_status: Asset["approval_status"]) {
    const optimistic = { ...asset, approval_status };
    setAssets((current) => current.map((item) => (item.id === asset.id ? optimistic : item)));
    setSelectedAsset(optimistic);
    syncCompareAsset(optimistic);

    try {
      if (connection === "online") {
        const updated = await updateAsset(asset.id, { approval_status });
        setAssets((current) => current.map((item) => (item.id === updated.asset.id ? updated.asset : item)));
        setSelectedAsset(updated.asset);
        syncCompareAsset(updated.asset);
      }

      setStatusText(assetStatusCopy(approval_status));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[approval] updateAsset failed", { assetId: asset.id, approval_status, error });
      setAssets((current) => current.map((item) => (item.id === asset.id ? asset : item)));
      setSelectedAsset(asset);
      syncCompareAsset(asset);
      setStatusText(error instanceof Error ? `Approval failed: ${error.message}` : "Could not update review status.");
    }
  }

  async function toggleFavorite(asset: Asset) {
    const optimistic = { ...asset, favorite: !asset.favorite };
    setAssets((current) => current.map((item) => (item.id === asset.id ? optimistic : item)));
    setSelectedAsset(optimistic);
    syncCompareAsset(optimistic);

    try {
      if (connection === "online") {
        const updated = await updateAsset(asset.id, { favorite: !asset.favorite });
        setAssets((current) => current.map((item) => (item.id === updated.asset.id ? updated.asset : item)));
        setSelectedAsset(updated.asset);
        syncCompareAsset(updated.asset);
      }
    } catch (error) {
      setAssets((current) => current.map((item) => (item.id === asset.id ? asset : item)));
      setSelectedAsset(asset);
      syncCompareAsset(asset);
      setStatusText(error instanceof Error ? error.message : "Could not update favorite.");
    }
  }

  async function saveAssetNotes(asset: Asset) {
    const optimistic = { ...asset, notes: assetNotesDraft };
    setAssets((current) => current.map((item) => (item.id === asset.id ? optimistic : item)));
    setSelectedAsset(optimistic);
    syncCompareAsset(optimistic);

    try {
      if (connection === "online") {
        const updated = await updateAsset(asset.id, { notes: assetNotesDraft });
        setAssets((current) => current.map((item) => (item.id === updated.asset.id ? updated.asset : item)));
        setSelectedAsset(updated.asset);
        syncCompareAsset(updated.asset);
      }

      setStatusText("Note saved for the next round.");
    } catch (error) {
      setAssets((current) => current.map((item) => (item.id === asset.id ? asset : item)));
      setSelectedAsset(asset);
      syncCompareAsset(asset);
      setAssetNotesDraft(asset.notes ?? "");
      setStatusText(error instanceof Error ? error.message : "Could not save review note.");
    }
  }

  async function useAssetAsReference(asset: Asset) {
    if (!activeSession) {
      setStatusText("Start a session before adding references.");
      return;
    }
    if (!asset.file_path) {
      setStatusText("This pick needs a saved file before it can become a reference.");
      return;
    }

    const existingReference = assets.find((item) => item.kind === "reference" && item.source_asset_id === asset.id);
    if (existingReference) {
      setActiveReferenceIds((current) => Array.from(new Set([...current, existingReference.id])));
      setStatusText(`${asset.title} added to references.`);
      return;
    }


    const referencePayload = {
      session_id: activeSession.id,
      title: `${asset.title} reference`,
      file_path: asset.file_path,
      preview_url: asset.preview_url,
      media_type: "image",
      provider: asset.provider,
      model: asset.model,
      prompt: asset.prompt,
      settings_json: asset.settings_json,
      source_asset_id: asset.id,
      width: asset.width,
      height: asset.height,
      sync_status: "local"
    };

    try {
      const reference =
        connection === "online"
          ? (await createReference(referencePayload)).asset
          : ({
              id: makeLocalId("asset"),
              kind: "reference",
              favorite: false,
              approval_status: "review",
              ...referencePayload
            } as Asset);

      setAssets((current) => [reference, ...current]);
      setActiveReferenceIds((current) => Array.from(new Set([...current, reference.id])));
      setStatusText(`${asset.title} is ready as a selected reference.`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not turn this pick into a reference.");
    }
  }

  async function removeTurnFromSession(turn: StudioTurn) {
    const turnAssetIds = new Set(assets.filter((a) => a.turn_id === turn.id).map((a) => a.id));
    try {
      if (connection === "online") {
        await deleteTurn(turn.id);
      }
      setTurns((current) => current.filter((t) => t.id !== turn.id));
      setAssets((current) => current.filter((a) => !turnAssetIds.has(a.id)));
      setExports((current) => current.filter((r) => !turnAssetIds.has(r.asset_id)));
      setSelectedAsset((current) => (current && turnAssetIds.has(current.id) ? null : current));
      if (lightboxAsset && turnAssetIds.has(lightboxAsset.id)) setLightboxAsset(null);
      if (editSourceAsset && turnAssetIds.has(editSourceAsset.id)) {
        // best-effort clear
        try { clearEditSource(); } catch (_) { /* ignore */ }
      }
      setStatusText("Round deleted.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not delete this round.");
    }
  }

  function retryTurn(turn: StudioTurn, overrideCount?: number) {
    try {
      const parsed = JSON.parse(turn.settings_json || "{}") as Partial<StudioSettings>;
      setPrompt(turn.prompt || "");
      setPromptRemixes([]);
      setAttachedPresetSnapshot(null);
      if (turn.model) setSelectedModelId(turn.model);
      if (turn.preset_key) setSelectedPresetKey(turn.preset_key); else setSelectedPresetKey(null);
      setFrankBodyMode(!!turn.frank_body_mode);
      setSettings((current) => ({
        ...current,
        ...parsed,
        ...(typeof overrideCount === "number" ? { count: Math.max(1, Math.min(maxCountForModel(config.models.find((m) => m.id === turn.model) ?? selectedModel), overrideCount)) } : {}),
      }));
      setStatusText(typeof overrideCount === "number" ? `Retrying ${overrideCount} missing…` : "Retrying with previous settings…");
      window.setTimeout(() => { void handleGenerate(); }, 60);
    } catch (err) {
      setStatusText(err instanceof Error ? err.message : "Could not retry this round.");
    }
  }



  async function removeAssetFromSession(asset: Asset) {
    try {
      if (connection === "online") {
        await deleteAsset(asset.id);
      }
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setExports((current) => current.filter((record) => record.asset_id !== asset.id));
      setSelectedAsset((current) => {
        if (current?.id !== asset.id) {
          return current;
        }
        return assets.find((item) => item.id !== asset.id && !["reference", "mask"].includes(item.kind)) ?? null;
      });
      if (lightboxAsset?.id === asset.id) {
        setLightboxAsset(null);
      }
      if (compareBaseAsset?.id === asset.id || compareTargetAsset?.id === asset.id) {
        clearCompare();
      }
      if (editSourceAsset?.id === asset.id) {
        clearEditSource();
      }
      if (maskAsset?.id === asset.id) {
        setMaskAsset(null);
      }
      setStatusText(asset.kind === "reference" ? "Reference removed from this session." : "Asset removed from this session.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not remove this asset.");
    }
  }

  async function copyRunBrief(asset: Asset) {
    const brief = selectedAssetRunBrief(asset, assets, config, turns);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(brief);
      setStatusText("Run brief copied for the handoff.");
    } catch {
      setStatusText("Could not copy the run brief. Use the export metadata instead.");
    }
  }

  function downloadWorkflowJson(asset: Asset) {
    try {
      const workflowJson = selectedAssetWorkflowJson(asset, assets, config, turns);
      const blob = new Blob([JSON.stringify(workflowJson, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeFileStem(asset.title || asset.id)}-workflow.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatusText("Workflow JSON downloaded for this pick.");
    } catch {
      setStatusText("Could not download workflow JSON for this pick.");
    }
  }

  // Save the file itself. The backend has no /assets/:id/download route, and
  // opening the signed storage URL in a tab just previews it, so fetch the
  // bytes and hand the browser a real download.
  async function downloadAssetFile(asset: Asset) {
    const source = asset.remote_url || asset.preview_url;
    if (!source) {
      setStatusText("This pick has no file to save yet.");
      return;
    }
    setStatusText("Preparing download…");
    try {
      const res = await fetch(source);
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const blob = await res.blob();
      const fromPath = (asset.file_path || source.split("?")[0] || "").match(/\.([a-z0-9]{3,4})$/i);
      const ext = fromPath?.[1] ?? (asset.media_type === "video" ? "mp4" : "png");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeFileStem(asset.title || asset.id)}.${ext.toLowerCase()}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatusText("Saved to your downloads.");
    } catch {
      openStudioLink(source, "Original file", "Opening the file in a new tab — use right-click → Save.");
    }
  }



  async function exportAsset(asset: Asset, preset: ExportPreset) {
    if (connection !== "online") {
      setStatusText("Connect to the studio backend to export this pick.");
      return;
    }

    try {
      const created = await createExport({
        asset_id: asset.id,
        preset: preset.key,
        file_path: `user/frank_create/exports/${asset.id}-${preset.key}.json`,
        metadata: {
          preset,
          asset,
          session: activeSession,
          model: selectedModel,
          app: "Frank Create Image Studio"
        }
      });
      const exportRecord = normalizeExportRecord(created.export, {
        asset_id: asset.id,
        preset: preset.key,
        download_url: created.download_url
      });
      setExports((current) => [exportRecord, ...current.filter((item) => item.id !== exportRecord.id)]);
      openStudioLink(created.download_url || exportDownloadUrl(created.export.id), preset.label, `${preset.label} export pack saved.`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Export pack needs another look.");
    }
  }

  async function exportChannelSet(asset: Asset) {
    const presets = exportPresetsForAsset(config.exportPresets, asset)
      .filter((preset) => preset.key !== "video-storyboard")
      .map((preset) => preset.key);

    if (!presets.length) {
      setStatusText("No image channel presets for this asset.");
      return;
    }

    if (connection !== "online") {
      setStatusText("Connect to the studio backend to export a channel set.");
      return;
    }

    try {
      const created = await createAssetChannelSet(asset.id, {
        presets,
        metadata: {
          asset,
          session: activeSession,
          model: selectedModel,
          app: "Frank Create Image Studio"
        }
      });
      const exportRecord = normalizeExportRecord(created.export, {
        asset_id: asset.id,
        preset: "channel-set",
        download_url: created.download_url
      });
      setExports((current) => [exportRecord, ...current.filter((item) => item.id !== exportRecord.id)]);
      const count = Number(created.metadata.preset_count ?? presets.length);
      openStudioLink(created.download_url || exportDownloadUrl(created.export.id), "Channel set", `${count} channel packs saved.`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Channel set export needs another look.");
    }
  }

  async function exportSessionHandoff() {
    if (!activeSession) {
      return;
    }

    setHandoffBusy(true);
    setStatusText("Packing the approved direction...");
    try {
      const created = await createSessionHandoff(activeSession.id);
      const exportRecord = normalizeExportRecord(created.handoff, {
        preset: "session-handoff",
        download_url: created.download_url,
        metadata_json: JSON.stringify(created.metadata ?? {})
      });
      setExports((current) => [exportRecord, ...current.filter((item) => item.id !== exportRecord.id)]);
      const assetCount = Number(created.metadata.asset_count ?? approvedCount);
      const videoCount = Number(created.metadata.video_count ?? 0);
      const imageCount = Number(created.metadata.image_count ?? assetCount);
      const channelExportFiles = Number(created.metadata.channel_export_file_count ?? imageCount * imageExportPresetCount);
      const channelExportSets = Number(created.metadata.channel_export_set_count ?? imageCount);
      const label =
        videoCount > 0
          ? `${assetCount} approved asset${assetCount === 1 ? "" : "s"} (${imageCount} image${imageCount === 1 ? "" : "s"}, ${videoCount} motion)`
          : `${assetCount} approved image${assetCount === 1 ? "" : "s"}`;
      setHandoffProofText(
        `Packed ${channelExportFiles} channel-ready exports across ${channelExportSets} approved image${channelExportSets === 1 ? "" : "s"}.`
      );
      openStudioLink(created.download_url || exportDownloadUrl(created.handoff.id), "Cliff Pack", `${label} packed for Cliff.`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Approve at least one image before exporting a handoff pack.");
    } finally {
      setHandoffBusy(false);
    }
  }

  function openSessionReviewBoard() {
    if (!activeSession || approvedCount === 0) {
      setStatusText("Approve at least one image before opening a review board.");
      return;
    }
    const url = `#/review/${encodeURIComponent(activeSession.id)}`;
    const opened = window.open(url, "_blank");
    setStatusText(opened ? "Opening the visual review board." : `Review board: ${url}`);
  }

  function openSessionSyncManifest() {
    if (!activeSession) {
      setStatusText("Start a session before opening a sync manifest.");
      return;
    }
    openStudioLink(sessionSyncManifestUrl(activeSession.id), "Sync manifest", "Opening the FrankHub sync manifest.");
  }

  function attachPreset(nextKey: string | null) {
    const preset = nextKey ? promptPresets.find((p) => p.key === nextKey) ?? null : null;
    setPrompt((current) => {
      let base = current;
      if (attachedPresetSnapshot && base.endsWith(attachedPresetSnapshot)) {
        base = base.slice(0, -attachedPresetSnapshot.length);
      }
      base = base.replace(/\s+$/, "");
      if (!preset) return base;
      return base ? `${base}\n\n${preset.prompt}` : preset.prompt;
    });
    if (!preset) {
      setSelectedPresetKey(null);
      setAttachedPresetSnapshot(null);
    } else {
      setSelectedPresetKey(preset.key);
      // Snapshot stores exactly what suffix we appended so we can strip it later.
      // We check both the "with leading \n\n" form and the "bare" form when stripping.
      setAttachedPresetSnapshot(preset.prompt);
    }
  }


  function selectPreset(preset: PromptPreset) {
    attachPreset(preset.key);
  }


  function selectTaskShortcut(task: FrankTask) {
    const taskPrompt = promptForTask(task);
    setSelectedPresetKey(task.key);
    setAttachedPresetSnapshot(null);
    setStudioMode(task.key === "prompt-remix" ? "image-studio" : "product-shot-lab");
    setPrompt((current) => (current.trim() ? `${current.trim()}\n\n${taskPrompt}` : taskPrompt));
    setSettings((current) => settingsForTask(task.key, current, selectedModel));
    setStatusText(`${task.label} is loaded.`);
  }

  function makeAnotherRound(asset: Asset, direction: "similar" | "cleanup" | "campaign") {
    const presetKey =
      direction === "cleanup" ? "clean-ecom" : direction === "campaign" ? "campaign-variants" : selectedPresetKey;
    const preset = promptPresets.find((item) => item.key === presetKey) ?? activePreset;
    const editModel =
      selectedModel?.capabilities.edit
        ? selectedModel
        : config.models.find((model) => model.capabilities.edit && model.configured !== false) ??
          config.models.find((model) => model.capabilities.edit);
    if (editModel) {
      setSelectedModelId(editModel.id);
    }
    setSelectedPresetKey(preset?.key ?? selectedPresetKey);
    setAttachedPresetSnapshot(null);
    startEditFromAsset(asset);
    setPrompt(nextRoundPrompt(asset, direction, preset));
    setSettings((current) => ({ ...current, count: Math.min(4, maxCountForModel(selectedModel)) }));
    setLightboxAsset(null);
    clearCompare();
    setStatusText("Next round is briefed from this pick.");
  }

  function startWalkthrough() {
    setWalkthroughStep(0);
    setWalkthroughOpen(true);
  }

  const activeWalkthroughStep = WALKTHROUGH_STEPS[walkthroughStep] ?? WALKTHROUGH_STEPS[0];
  const activeWalkthroughTarget = walkthroughOpen ? activeWalkthroughStep.target : null;
  const tourActive = (target: WalkthroughTarget) => (activeWalkthroughTarget === target ? "true" : undefined);

  useEffect(() => {
    if (!walkthroughOpen) {
      return;
    }
    if (activeWalkthroughStep.openSettings) {
      setSettingsOpen(true);
    }
    if (activeWalkthroughStep.selectOutput && !selectedAsset && firstOutputAsset) {
      setSelectedAsset(firstOutputAsset);
      setLightboxAsset(null);
    }
    if (activeWalkthroughStep.target === "review-panel" || activeWalkthroughStep.target === "export-controls") {
    }
  }, [
    activeWalkthroughStep.openSettings,
    activeWalkthroughStep.selectOutput,
    activeWalkthroughStep.target,
    firstOutputAsset,
    selectedAsset?.id,
    walkthroughOpen
  ]);

  useEffect(() => {
    if (!walkthroughOpen) {
      setWalkthroughAnchor(null);
      return;
    }

    const updateAnchor = () => {
      setWalkthroughAnchor(measureWalkthroughAnchor(activeWalkthroughStep.target));
    };
    const targetElement = document.querySelector<HTMLElement>(`[data-tour-id="${activeWalkthroughStep.target}"]`);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;
      const centeredTop = Math.max(0, absoluteTop - window.innerHeight / 2 + rect.height / 2);
      if (!navigator.userAgent.toLowerCase().includes("jsdom")) {
        window.scrollTo({ top: centeredTop, behavior: "auto" });
      }
      targetElement.scrollIntoView?.({ block: "center", inline: "nearest" });
    }

    const updateTimer = window.setTimeout(updateAnchor, 140);
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);
    return () => {
      window.clearTimeout(updateTimer);
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
    };
  }, [
    activeSession?.id,
    activeWalkthroughStep.target,
    assets.length,
    selectedAsset?.id,
    settingsOpen,
    turns.length,
    walkthroughOpen
  ]);

  useEffect(() => {
    if (!walkthroughOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWalkthroughOpen(false);
      }
      if (event.key === "ArrowRight") {
        setWalkthroughStep((current) => Math.min(current + 1, WALKTHROUGH_STEPS.length - 1));
      }
      if (event.key === "ArrowLeft") {
        setWalkthroughStep((current) => Math.max(current - 1, 0));
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [walkthroughOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("walkthrough") === "1") {
      setWalkthroughStep(0);
      setWalkthroughOpen(true);
    }
  }, []);

  const statusReadyLink = parseReadyStatusLink(statusText);
  const modelSettingsExpanded = settingsOpen;

  return (
    <div
      className={`studio-shell guided-studio ${providerAuditMode ? "provider-audit-mode" : ""} ${studioMode !== "preset-creator" && studioMode !== "prompt-generator" && studioMode !== "enhancer" && settingsRailOpen ? "settings-rail-open" : ""}`}
      data-provider-audit={providerAuditMode ? "open" : undefined}
      data-tenant="frank"
    >
      <svg
        className="ambient-field"
        viewBox="0 0 1280 832"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter id="ambient-blob-blur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="250" />
          </filter>
        </defs>
        <rect width="1280" height="832" fill="transparent" />
        <g filter="url(#ambient-blob-blur)" transform="translate(-300, 40) scale(1)">
          <path
            fill="var(--tenant-accent)"
            d="M-140 402c72-138 150-236 292-268 142-32 268 26 372 118 104 92 176 214 152 336-24 122-144 244-306 268-162 24-366-50-476-176-110-126-106-140-34-278Z"
          />
        </g>
      </svg>



      <header className="os-topbar" aria-label="AutoSolutions OS">
        <div className="os-topbar-logo">
          <img src={osLogo} alt="autosolutions OS" />
        </div>
        <div className="os-topbar-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={roundSearch}
            onChange={(event) => setRoundSearch(event.target.value)}
            placeholder="Search sessions and picks"
            aria-label="Search sessions and picks"
          />
        </div>
        <div className="os-topbar-right">
          <span className="os-topbar-bell" aria-hidden="true">
            <Bell size={16} />
          </span>
          <span className="os-topbar-avatar" aria-hidden="true">
            {(userEmail ?? "—").slice(0, 1).toUpperCase()}
          </span>
          <button type="button" className="os-topbar-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {desktopNotice ? (
        <div
          role="status"
          style={{
            position: "sticky", top: 0, zIndex: 40,
            background: "#fff7e6", borderBottom: "1px solid #f0c36d",
            color: "#7a4a00", padding: "8px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            fontSize: 13,
          }}
        >
          <span>{desktopNotice}</span>
          <button
            type="button"
            onClick={() => setDesktopNotice(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#7a4a00", fontSize: 18, lineHeight: 1 }}
            aria-label="Dismiss notice"
          >×</button>
        </div>
      ) : null}
      {busy && studioMode === "video-lab" ? (
        <div style={{ position: "sticky", top: desktopNotice ? 40 : 0, zIndex: 39, height: 3, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ width: "40%", height: "100%", background: "#111", animation: "frank-video-progress 1.2s ease-in-out infinite" }} />
          <style>{`@keyframes frank-video-progress { 0% { transform: translateX(-40%); } 100% { transform: translateX(140%); } }`}</style>
        </div>
      ) : null}
      {videoStartedAt != null ? (
        <div
          role="status"
          style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 60,
            display: "flex", flexDirection: "column", gap: 6,
            padding: "10px 14px", borderRadius: 8, fontSize: 13,
            background: "#f4f4f5", color: "#222", border: "1px solid #d4d4d8",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)", maxWidth: 340,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#111", animation: "frank-video-progress 1.2s ease-in-out infinite" }} />
            <span>Generating video…</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, opacity: 0.8, gap: 8 }}>
            <span>⏱ {Math.max(0, Math.floor((videoNowTick - videoStartedAt) / 1000))}s elapsed</span>
            <button
              type="button"
              onClick={() => videoAbortRef.current?.abort()}
              style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(0,0,0,0.2)", background: "#fff", cursor: "pointer", fontSize: 11 }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <aside className="guided-header app-sidebar" data-tour-id="app-header" data-tour-active={tourActive("app-header")}>
        <div className="sidebar-brand-block">
          <span className="sidebar-lockup">
            <span className="lockup-primary">art-ificial</span>
            <span className="lockup-secondary">studio</span>
          </span>
        </div>
        <div className="sidebar-brand-divider" aria-hidden="true" />



        <nav className="sidebar-nav" aria-label="Frank Create navigation">
          <button
            className={`sidebar-nav-button ${studioMode === "image-studio" && reviewFilter === "all" ? "active" : ""}`}
            type="button"
            aria-label="Open Studio"
            onClick={showImageStudio}
          >
            <Wand2 size={16} />
            Studio
          </button>
          <button
            className={`sidebar-nav-button ${studioMode === "prompt-generator" ? "active" : ""}`}
            type="button"
            aria-label="Open Prompt Generator"
            title="Prompt-engineering agent running on GPT-5.6 Sol"
            onClick={showPromptGenerator}
          >
            <Layers3 size={16} />
            Prompt Generator
          </button>
          <button
            className={`sidebar-nav-button ${studioMode === "enhancer" ? "active" : ""}`}
            type="button"
            aria-label="Open UPSCALER"
            title="Upscale stills and clips with Recraft, Topaz, and Crystal"
            onClick={showEnhancer}
          >
            <Sparkles size={16} />
            UPSCALER
          </button>
          <button
            className={`sidebar-nav-button ${studioMode === "preset-creator" ? "active" : ""}`}
            type="button"
            aria-label="Open Preset Creator"
            onClick={showPresetCreator}
          >
            <Sparkles size={16} />
            Preset Creator
          </button>

          <button
            className={`sidebar-nav-button ${reviewFilter === "approved" ? "active" : ""}`}
            type="button"
            aria-label="Open approved picks"
            onClick={showApprovedHot}
          >
            <CheckCircle2 size={16} />
            Approved
            <span className="sidebar-badge">{approvedCount}</span>
          </button>

          <button
            className={`sidebar-nav-button ${sessionsOpen ? "active" : ""}`}
            type="button"
            aria-expanded={sessionsOpen}
            aria-controls="sidebar-sessions-list"
            onClick={() => setSessionsOpen((v) => !v)}
          >
            <ChevronRight size={16} style={{ transform: sessionsOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
            <span style={{ flex: 1 }}>
              {activeSession?.name ?? "Sessions"}
            </span>
            <span className="sidebar-badge">{sessions.length}</span>
          </button>
          {sessionsOpen ? (
            <div id="sidebar-sessions-list">
              {sessions.map((session) => {
                const renameThis = () => {
                  const next = window.prompt("Rename session", session.name);
                  if (!next) return;
                  const trimmed = next.trim().slice(0, 80);
                  if (!trimmed || trimmed === session.name) return;
                  const optimistic = { ...session, name: trimmed };
                  if (activeSession?.id === session.id) setActiveSession(optimistic);
                  setSessions((current) => current.map((s) => (s.id === session.id ? optimistic : s)));
                  void updateSession(session.id, { name: trimmed })
                    .then((result) => {
                      if (result?.session) {
                        if (activeSession?.id === result.session.id) setActiveSession(result.session);
                        setSessions((current) => current.map((s) => (s.id === result.session.id ? result.session : s)));
                      }
                    })
                    .catch((error) => { console.error("Failed to rename session", error); });
                };
                const deleteThis = () => {
                  if (!window.confirm(`Archive "${session.name}"? It will be removed from your active sessions.`)) return;
                  void archiveSession(session);
                };
                return (
                  <div
                    key={session.id}
                    className={`sidebar-nav-sub sidebar-session-row ${activeSession?.id === session.id ? "active" : ""}`}
                  >
                    <button
                      type="button"
                      className="sidebar-session-pick"
                      onClick={() => { void selectSession(session); }}
                      title={session.name}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.name}</span>
                    </button>
                    <button
                      type="button"
                      className="sidebar-session-icon"
                      onClick={(e) => { e.stopPropagation(); renameThis(); }}
                      title="Rename session"
                      aria-label="Rename session"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      className="sidebar-session-icon"
                      onClick={(e) => { e.stopPropagation(); deleteThis(); }}
                      title="Delete session"
                      aria-label="Delete session"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
              <button className="sidebar-nav-sub" type="button" onClick={handleNewSession}>
                <Plus size={13} />
                New session
              </button>
              {showMainDemoAction ? (
                <button className="sidebar-nav-sub" type="button" onClick={returnToMainDemo}>
                  <ArrowLeft size={13} />
                  Main demo
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="sidebar-bottom-divider" aria-hidden="true" />
          <div data-tour-id="feedback-button" data-tour-active={tourActive("feedback-button")}>
            <FeedbackWidget variant="sidebar" />
          </div>
          {isAdmin && (
            <a
              className="sidebar-nav-button admin-sidebar-link"
              href="#/admin"
              aria-label="Open Admin portal"
              data-tour-id="admin-entry"
              data-tour-active={tourActive("admin-entry")}
            >
              <Sparkles size={16} />
              Admin portal
            </a>
          )}
        </nav>
      </aside>

      {studioMode !== "preset-creator" && studioMode !== "prompt-generator" && studioMode !== "enhancer" && settingsRailOpen ? (
        <StudioRail
          mediaKind={mediaKind}
          onMediaKindChange={switchMediaKind}
          models={mediaModels}
          selectedModelId={selectedModelId}
          onModelChange={setSelectedModelId}
          settings={settings}
          onSettingsChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
          onAspectChange={handleAspectChange}
          presets={promptPresets}
          selectedPresetKey={selectedPresetKey}
          onPresetChange={(key) => attachPreset(key)}
          fieldErrors={fieldErrors}
          referenceCount={selectedReferenceAssets.length}
          onReset={resetStudioSettings}
          compareMedia={compareMedia}
          onCompareMediaChange={switchCompareMedia}
          compareModelBId={compareModelBId}
          onCompareModelBChange={(id) => {
            setCompareModelBId(id);
            setCompareApproved(false);
          }}
          compareAdjustments={compareAdjustments}
          compareApproved={compareApproved}
          onCompareApprovedChange={setCompareApproved}
          compareCostLabel={compareCostLabel}
          videoFirstFrame={videoFirstFrame}
          videoLastFrame={videoLastFrame}
          armedFrameSlot={armedFrameSlot}
          onArmFrameSlot={setArmedFrameSlot}
          onClearFrameSlot={(slot) => {
            if (slot === "first") {
              setVideoFirstFrameId(null);
              setVideoLastFrameId(null);
            } else {
              setVideoLastFrameId(null);
            }
          }}
          onDropFrameAsset={assignFrameSlot}
        />

      ) : null}

      {studioMode === "enhancer" ? (
        <Enhancer
          models={config.models}
          assets={assets}
          sessionId={activeSession?.id ?? null}
          connection={connection}
          onAssetsCreated={(created) =>
            setAssets((current) => [
              ...created.filter((asset) => !current.some((existing) => existing.id === asset.id)),
              ...current
            ])
          }
          onStatus={setStatusText}
          onExpandAsset={(asset) => setLightboxAsset(asset)}
          onDownloadAsset={(asset) => void downloadAssetFile(asset)}

        />
      ) : studioMode === "prompt-generator" ? (
        <PromptGenerator
          onStatus={setStatusText}
          onUsePrompt={(value) => {
            setPrompt(value);
            showImageStudio();
            setStatusText("Prompt loaded into the Studio composer.");
          }}
        />
      ) : studioMode === "preset-creator" ? (
        <PresetCreator
          builtinPresets={config.promptPresets}
          customPresets={customPresets}
          setCustomPresets={setCustomPresets}
          onStatus={setStatusText}
        />
      ) : (
      <main className="conversation-column">
        <header className="studio-topbar">
          <div>
            
            <h2>{activeSession?.name ?? config.voice.labTitle}</h2>
            <p className="studio-topbar-copy">
              Brief in plain English. References and settings are optional. Click a pick to edit, approve, or export.
            </p>
          </div>
          <div className="studio-topbar-right">
            <div className="stat-row" aria-label="Studio stats">
              <span role="group" aria-label={`${turns.length} rounds`}>
                <strong aria-hidden="true">{turns.length}</strong>
                <small aria-hidden="true">rounds</small>
              </span>
              <span role="group" aria-label={`${approvedCount} approved`}>
                <strong aria-hidden="true">{approvedCount}</strong>
                <small aria-hidden="true">approved</small>
              </span>
              <span role="group" aria-label={`${favoriteCount} favorites`}>
                <strong aria-hidden="true">{favoriteCount}</strong>
                <small aria-hidden="true">favorites</small>
              </span>
            </div>
          </div>
        </header>

        <section
          className="thread-surface"
          aria-label="Prompt and output thread"
          data-tour-id="output-thread"
          data-tour-active={tourActive("output-thread")}
        >
          <div className="rounds-well-head" aria-hidden="true">
            <span className="rounds-well-title">Rounds</span>
            <span className="rounds-well-count">
              {outputAssets.length ? `${outputAssets.length} picks` : "Empty"}
            </span>
          </div>

          {compareBaseAsset ? (
            <div className="compare-prompt" role="status">
              <span>
                Comparing from <strong>{compareBaseAsset.title}</strong>
              </span>
              <button type="button" onClick={clearCompare}>
                Cancel
              </button>
            </div>
          ) : null}
          {inflightGens.length ? inflightGens.slice().reverse().map((gen) => {
            const p = aspectRatioParts(gen.aspect);
            const ar = p ? `${p.width} / ${p.height}` : "1 / 1";
            return (
              <article key={gen.id} className="turn-card turn-card-pending" aria-live="polite" aria-busy="true">
                <div className="turn-card-body">
                <div className="turn-side">
                <div className="turn-copy">
                  <span className="status-dot pending" />
                  <div>
                    <p className="eyebrow">Generating</p>
                    <h3>{gen.modelLabel}</h3>
                    <p>{gen.prompt || "Preparing the next round..."}</p>
                    <div className="turn-meta">
                      <span>Running</span>
                      <span>{gen.aspect}</span>
                      <span>{gen.count} pick{gen.count === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                </div>
                </div>
                <div className="turn-visual">
                <div className="pending-strip" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(gen.count, 3)}, minmax(0, 1fr))`, gap: 12 }}>
                  {Array.from({ length: gen.count }).map((_, i) => (
                    <div
                      key={i}
                      className="pending-tile"
                      style={{
                        aspectRatio: ar,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: 12, border: "1px dashed rgba(0,0,0,0.15)",
                        background: "rgba(0,0,0,0.03)",
                      }}
                    >
                      <Loader2 size={22} className="spin" style={{ opacity: 0.6 }} />
                    </div>
                  ))}
                </div>
                </div>
                </div>

              </article>
            );
          }) : null}

          {searchedTurns.length ? (
            groupCompareRows([...searchedTurns].reverse()).map((row, rowIdx) => (
            <div
              key={`row-${row[0].id}`}
              className={row.length > 1 ? "compare-run" : "turn-row"}
            >
              {row.length > 1 ? (
                <p className="compare-run-title">
                  Side-by-side · {modelName(config, row[0].model)} vs {modelName(config, row[1].model)}
                </p>
              ) : null}
              <div className={row.length > 1 ? "compare-run-grid" : "turn-row-single"}>
              {row.map((turn) => {
              const idx = rowIdx;
              const compareSide = parseCompareMeta(turn.settings_json).side;
              const createdMs = turn.created_at ? new Date(turn.created_at).getTime() : 0;
              const isFresh = idx === 0 && createdMs && Date.now() - createdMs < 30_000;
              const shortId = turn.id.slice(0, 8);

              const timeLabel = turn.created_at ? new Date(turn.created_at).toLocaleString() : "";
              return (
              <article
                className={`turn-card${isFresh ? " turn-card-fresh" : ""}`}
                key={turn.id}
                style={{ position: "relative" }}
              >
                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6, alignItems: "center" }}>
                  {isFresh ? (
                    <span
                      style={{
                        fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase",
                        padding: "2px 6px", borderRadius: 999,
                        background: "rgba(34,197,94,0.15)", color: "rgb(21,128,61)",
                        border: "1px solid rgba(34,197,94,0.35)",
                      }}
                    >
                      New
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Copy generation ID"
                    title={`Copy ID (${turn.id})`}
                    onClick={() => {
                      void navigator.clipboard?.writeText(turn.id).catch(() => {});
                    }}
                    style={{
                      width: 22, height: 22, padding: 0,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(255,255,255,0.85)", cursor: "pointer",
                      color: "rgba(0,0,0,0.55)",
                    }}
                  >
                    <Clipboard size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label="Retry this generation"
                    title="Retry with the same settings"
                    onClick={() => retryTurn(turn)}
                    style={{
                      width: 22, height: 22, padding: 0,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(255,255,255,0.85)", cursor: "pointer",
                      color: "rgba(0,0,0,0.55)",
                    }}

                  >
                    <RefreshCw size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete this round"
                    title="Delete this round"
                    onClick={() => {
                      if (window.confirm("Delete this round and its generated images?")) {
                        removeTurnFromSession(turn);
                      }
                    }}
                    style={{
                      width: 22, height: 22, padding: 0,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(255,255,255,0.85)", cursor: "pointer",
                      color: "rgba(0,0,0,0.55)",
                    }}
                  >
                    <X size={12} />
                  </button>

                </div>
                <div className="turn-card-body">
                <div className="turn-side">
                <div className="turn-copy">

                  <span className={`status-dot ${turn.status}`} />
                  <div>
                    <p className="eyebrow">
                      {compareSide ? <span className="compare-side-badge">Side {compareSide}</span> : null}
                      {turnKindLabel(turn)}
                    </p>

                    <h3>{modelName(config, turn.model)}</h3>
                    <p>{turn.prompt}</p>
                    <div className="turn-meta">
                      <span title={turn.id} style={{ fontFamily: "ui-monospace, monospace" }}>#{shortId}</span>
                      {timeLabel ? <span title={timeLabel}>{timeLabel}</span> : null}
                      <span>{turn.status}</span>
                      {turn.frank_body_mode ? <span>Frank Body Mode</span> : <span>User prompt</span>}
                      <button
                        type="button"
                        className="turn-copy-prompt"
                        onClick={() => {
                          void navigator.clipboard?.writeText(turn.prompt || "").then(() => {
                            setStatusText("Prompt copied to clipboard.");
                          }).catch(() => {
                            setStatusText("Could not copy prompt.");
                          });
                        }}
                        title="Copy prompt"
                      >
                        <Clipboard size={12} />
                        Copy prompt
                      </button>
                      {parseJsonList(turn.reference_asset_ids_json).length ? (
                        <span>{referenceCountLabel(parseJsonList(turn.reference_asset_ids_json).length)}</span>
                      ) : null}
                      {turnErrorCopy(turn) ? <span className="turn-error">{turnErrorCopy(turn)}</span> : null}

                      {(() => {
                        const anyTurn = turn as any;
                        const requested = typeof anyTurn.requested_count === "number" ? anyTurn.requested_count : 0;
                        const produced = displayOutputAssets.filter((a) => a.turn_id === turn.id).length;
                        let partial: Array<{ code?: string; message?: string; request_id?: string }> = [];
                        try { partial = JSON.parse(anyTurn.partial_errors_json || "[]"); } catch { partial = []; }
                        if (!partial.length && (!requested || produced >= requested)) return null;
                        const missing = Math.max(0, requested - produced);
                        const anyRetryable = partial.some((p: any) => p?.retryable !== false);
                        return (
                          <>
                            <span
                              className="turn-partial"
                              title={partial.map((p, i) => `${i + 1}. [${p.code || "error"}] ${p.message || ""}${p.request_id ? ` (id: ${p.request_id})` : ""}`).join("\n")}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                fontSize: 11, padding: "2px 8px", borderRadius: 999,
                                background: "rgba(245,158,11,0.15)", color: "rgb(146,64,14)",
                                border: "1px solid rgba(245,158,11,0.4)", cursor: "help",
                              }}
                            >
                              {produced} of {requested || (produced + partial.length)} succeeded
                              {missing > 0 ? ` · ${missing} failed` : ""}
                            </span>
                            {missing > 0 && anyRetryable ? (
                              <button
                                type="button"
                                className="turn-retry-missing"
                                onClick={() => retryTurn(turn, missing)}
                                title={`Re-run the ${missing} missing image${missing === 1 ? "" : "s"} with the same settings`}
                                style={{
                                  fontSize: 11, padding: "2px 8px", borderRadius: 999,
                                  background: "rgba(59,130,246,0.12)", color: "rgb(30,64,175)",
                                  border: "1px solid rgba(59,130,246,0.4)", cursor: "pointer",
                                }}
                              >
                                Retry missing ({missing})
                              </button>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                </div>
                </div>
                </div>
                <div className="turn-visual">

                <OutputStrip
                  assets={displayOutputAssets.filter((asset) => asset.turn_id === turn.id)}
                  onSelect={inspectAsset}
                  emptyLabel={studioMode === "approved-hot" ? "No approved picks in this round" : turnEmptyLabel(turn)}
                  pending={studioMode !== "approved-hot" && (turn.status === "queued" || turn.status === "running")}
                  pendingCount={1}

                  selectedAssetId={selectedAsset?.id}
                  onQuickApprove={(asset) => changeAssetStatus(asset, "approved")}
                  onQuickReject={(asset) => changeAssetStatus(asset, "rejected")}
                  onUseAsFrame={
                    mediaKind === "video" || (mediaKind === "compare" && compareMedia === "video")
                      ? (asset, slot) => assignFrameSlot(slot, asset.id)
                      : undefined
                  }
                  canUseLastFrame={Boolean(selectedModel?.supports_last_frame) && Boolean(videoFirstFrameId)}
                />
                </div>
                </div>


              </article>
              );
            })}
              </div>
            </div>
            ))

          ) : roundSearch.trim() && turns.length ? (
            <div className="empty-thread">
              <Search size={38} />
              <strong>No rounds match “{roundSearch.trim()}”</strong>
              <span>Clear the search in the top bar to see all {turns.length} rounds again.</span>
            </div>
          ) : (
            <div className="empty-thread">
              <ImageIcon size={38} />
              <strong>{config.voice.emptyState}</strong>
              <span>Start with a prompt and optional references. Product Shot Lab is now a preset, not a cage.</span>
            </div>
          )}
        </section>

        <form
          className="composer"
          onSubmit={handleGenerate}
          data-tour-id="composer"
          data-tour-active={tourActive("composer")}
        >
          <div className="brief-card-head" aria-hidden="true">
            <span className="brief-card-eyebrow">Brief</span>
            <span className="brief-card-meta">
              {settings.aspect_ratio} · {settings.image_size} · {settings.count} pick{settings.count === 1 ? "" : "s"}
            </span>
          </div>

          {editSourceAsset ? (
            <div className="edit-banner">
              <ImageIcon size={16} />
              Editing {editSourceAsset.title}
              {maskAsset ? <span className="mask-pill">Mask {maskAsset.title}</span> : null}
              <button type="button" onClick={clearEditSource}>
                Clear
              </button>
            </div>
          ) : null}


          {studioMode === "product-shot-lab" ? (
            <div className="task-shortcut-list composer-task-shortcuts" aria-label="Product Image Lab task shortcuts">
              {productTaskShortcuts.map((task) => (
                <button
                  className={selectedPresetKey === task.key ? "selected" : ""}
                  key={task.key}
                  type="button"
                  onClick={() => selectTaskShortcut(task)}
                >
                  <span className="task-shortcut-icon">{taskShortcutIcon(task.key)}</span>
                  <span>
                    <strong>{task.label}</strong>
                    <small aria-hidden="true">{task.description}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <textarea
            ref={promptInputRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onPaste={handlePromptPaste}
            onDragOver={handlePromptDragOver}
            onDrop={handlePromptDrop}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                if (prompt.trim()) void handleGenerate();
                else if (!prompt.trim()) setStatusText("Enter a prompt to generate.");
              }
            }}
            placeholder="Brief the image: product, context, channel, mood, and what must stay accurate. Cmd/Ctrl+Enter to generate. Paste or drop an image to attach as reference."
          />






          {promptRemixes.length ? (
            <div className="prompt-remix-panel" aria-label="Brief remix directions">
              {promptRemixes.map((variant) => (
                <button key={variant.key} type="button" onClick={() => applyPromptRemix(variant)}>
                  <strong>{variant.label}</strong>
                  <span>{variant.prompt}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div
            className={`composer-actions${referenceDropActive ? " reference-drop-active" : ""}`}
            data-tour-id="reference-dock"
            data-tour-active={tourActive("reference-dock")}
            onDragOver={(event) => {
              handlePromptDragOver(event);
              setReferenceDropActive(true);
            }}
            onDragLeave={() => setReferenceDropActive(false)}
            onDrop={(event) => {
              setReferenceDropActive(false);
              void handlePromptDrop(event);
            }}
          >
            <button
              type="button"
              className={`upload-button reference-upload${referenceAssets.length ? " has-refs" : ""}`}
              onClick={() => void openReferencePicker()}
            >
              <Upload size={16} />
              Add references

              {referenceAssets.length ? (
                <span className="reference-count-badge" aria-label={`${referenceAssets.length} references loaded`}>
                  <Paperclip size={11} />
                  {referenceAssets.length}
                </span>
              ) : null}
            </button>
            <div className="reference-dock" aria-label="Reference images">

              {referenceAssets.map((asset, refIndex) => {
                const tag = referenceTagFor(refIndex);
                return (
                <div
                  key={asset.id}
                  className={`reference-thumb${hoveredReferenceTag === tag ? " reference-thumb--tag-hover" : ""}`}
                  title={`${tag} · ${asset.title}`}
                  data-reference-tag={tag}
                  onClick={() => setReferencePreviewAsset(asset)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setReferencePreviewAsset(asset);
                    }
                  }}
                >
                  {asset.preview_url ? <img src={asset.preview_url} alt={asset.title} /> : <Paperclip size={15} />}
                  <button
                    type="button"
                    className="reference-tag"
                    title={`Insert ${tag} into the prompt`}
                    aria-label={`Insert ${tag} for ${asset.title} into the prompt`}
                    onMouseEnter={() => setHoveredReferenceTag(tag)}
                    onMouseLeave={() => setHoveredReferenceTag(null)}
                    onClick={(event) => {
                      event.stopPropagation();
                      insertReferenceTag(tag);
                    }}
                  >
                    {tag}
                  </button>
                  <button
                    type="button"
                    className="reference-remove"
                    aria-label={`Remove ${asset.title}`}
                    title={`Remove ${asset.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeReferenceFromDock(asset);
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
                );
              })}
              {referenceAssets.length ? (
                <span className="reference-selection-count">
                  {referenceAssets.length} loaded · used in next run
                </span>
              ) : (
                <span className="reference-selection-count reference-selection-count--empty">
                  No references loaded
                </span>
              )}
            </div>
            <div className="composer-action-group">
              {editSourceAsset && selectedModel?.capabilities.masked_edit ? (
                <>
                  <button className="upload-button mask-paint-button" type="button" onClick={() => setMaskPainterAsset(editSourceAsset)}>
                    <Paintbrush size={16} />
                    Paint mask
                  </button>
                  <label className="upload-button mask-upload-button">
                    <Box size={16} />
                    Mask
                    <input aria-label="Upload edit mask" type="file" accept="image/png,image/webp,image/jpeg" onChange={handleMaskUpload} />
                  </label>
                </>
              ) : null}
              {maskAsset ? (
                <button className="mask-chip" type="button" onClick={() => setMaskAsset(null)} title="Clear edit mask">
                  {maskAsset.preview_url ? <img src={maskAsset.preview_url} alt="" aria-hidden="true" /> : <Box size={14} />}
                  <span>Mask {maskAsset.title}</span>
                  <XCircle size={14} />
                </button>
              ) : null}
              {!settingsRailOpen ? (
                <button className="secondary-button" type="button" onClick={() => setSettingsRailOpen(true)}>
                  <SlidersHorizontal size={16} />
                  Setup
                </button>
              ) : null}
              <div className="action-compact-pile">
                <button className="secondary-button remix-button" type="button" onClick={handlePromptRemix} disabled={remixBusy}>
                  {remixBusy ? <RefreshCw className="spin" size={14} /> : <Sparkles size={14} />}
                  Brief remix
                </button>
                <button
                  className="secondary-button danger-button composer-cancel-button"
                  type="button"
                  onClick={requestCancelCurrentSession}
                  disabled={!activeSession}
                >
                  <XCircle size={14} />
                  Cancel
                </button>
              </div>
              <button
                className="primary-button"
                type="submit"
                disabled={!prompt.trim() || hasStudioFieldErrors(fieldErrors)}
                title={
                  !prompt.trim()
                    ? "Enter a prompt to generate"
                    : hasStudioFieldErrors(fieldErrors)
                      ? "Fix the highlighted settings before generating"
                      : undefined
                }
              >
                <Wand2 size={18} />
                {primaryActionLabel}
              </button>
            </div>
          </div>
          {referenceAssets.length ? (
            <p className="reference-tag-hint">
              Reference tags:{" "}
              {taggedReferences(referenceAssets).map((ref, i) => (
                <span key={ref.tag}>
                  {i ? ", " : ""}
                  <button
                    type="button"
                    className="reference-tag-hint-chip"
                    onMouseEnter={() => setHoveredReferenceTag(ref.tag)}
                    onMouseLeave={() => setHoveredReferenceTag(null)}
                    onClick={() => insertReferenceTag(ref.tag)}
                  >
                    {ref.tag}
                  </button>{" "}
                  {ref.title}
                </span>
              ))}
              {" "}— use them in the prompt to point at one image.
              {unknownReferenceTags(prompt, referenceAssets.length).length ? (
                <strong className="reference-tag-hint-warn">
                  {" "}Unknown tag{unknownReferenceTags(prompt, referenceAssets.length).length === 1 ? "" : "s"}:{" "}
                  {unknownReferenceTags(prompt, referenceAssets.length).join(", ")}
                </strong>
              ) : null}
            </p>
          ) : null}
        </form>



        <div className="status-strip">
          <div className={`gen-progress phase-${genPhase}`} role="status" aria-live="polite">
            {(["queued", "running", genPhase === "failed" ? "failed" : "completed"] as const).map((step, i) => {
              const order: GenPhase[] = ["idle", "queued", "running", genPhase === "failed" ? "failed" : "completed"];
              const currentIdx = order.indexOf(genPhase);
              const stepIdx = i + 1;
              const state =
                genPhase === "idle" ? "pending" :
                genPhase === "failed" && step === "failed" ? "failed" :
                stepIdx < currentIdx ? "done" :
                stepIdx === currentIdx ? (genPhase === "failed" ? "failed" : genPhase === "completed" ? "done" : "active") :
                "pending";
              const label = step === "queued" ? "Queued" : step === "running" ? "Running" : step === "failed" ? "Failed" : "Completed";
              return (
                <span key={step} className={`gen-step gen-step-${state}`}>
                  <span className="gen-step-dot">{stepIdx}</span>
                  <span className="gen-step-label">{label}</span>
                </span>
              );
            })}
          </div>
          <span>{statusText}</span>
          {(genPhase === "queued" || genPhase === "running") && busy ? (
            <button
              type="button"
              className="gen-stop-btn"
              onClick={() => {
                generateAbortRef.current?.abort();
                setStatusText("Canceling...");
              }}
              title="Cancel this generation"
            >
              <Square size={12} />
              Stop
            </button>
          ) : null}
          {genPhase === "failed" && genError ? (
            <>
              {genError.code === "provider_unavailable" ? (
                <span className="gen-error-chip outage" title={genError.message}>
                  <code>provider outage</code>
                </span>
              ) : genError.code ? (
                <span className="gen-error-chip" title={genError.message}>
                  <code>{genError.code}</code>
                  {genError.requestId ? <em title={`Replicate request ID: ${genError.requestId}`}>req {genError.requestId.slice(0, 8)}</em> : null}
                </span>
              ) : null}
              {genError.code === "provider_unavailable" && fallbackModel ? (
                <button
                  type="button"
                  onClick={() => setAutoRetryModelId(fallbackModel.id)}
                  title={`Re-run the same prompt and references on ${fallbackModel.short_label ?? fallbackModel.label}`}
                >
                  <RefreshCw size={13} />
                  Switch to {fallbackModel.short_label ?? fallbackModel.label} and retry
                </button>
              ) : null}
              <button
                type="button"
                className="gen-error-toggle"
                onClick={() => setGenErrorOpen((v) => !v)}
                aria-expanded={genErrorOpen}
              >
                {genErrorOpen ? "Hide details" : "Show details"}
              </button>
            </>
          ) : null}
          {retrySafePayload ? (
            <button
              type="button"
              onClick={() => { void handleGenerate(); }}
              title="Re-run the last generation with the same inputs"

            >
              <RefreshCw size={13} />
              Retry safely
            </button>
          ) : null}

          {statusReadyLink ? (
            <button type="button" onClick={() => openStudioLink(statusReadyLink.url, statusReadyLink.label)}>
              <ExternalLink size={13} />
              Try {statusReadyLink.label} link
            </button>
          ) : null}
          {statusReadyLink ? (
            <button type="button" onClick={() => copyStudioLink(statusReadyLink.url, statusReadyLink.label)}>
              <Clipboard size={13} />
              Copy {statusReadyLink.label} link
            </button>
          ) : null}
          <span className={`connection-pill ${connection}`}>
            <span />
            {connection === "online" ? "Studio connected" : connection === "checking" ? "Checking studio" : "Studio offline"}
          </span>
        </div>
        {genPhase === "failed" && genError && genErrorOpen ? (
          <div className="gen-error-details" role="region" aria-label="Error details">
            <dl>
              {genError.code ? (<><dt>Code</dt><dd><code>{genError.code}</code></dd></>) : null}
              {genError.requestId ? (
                <>
                  <dt>Request ID</dt>
                  <dd>
                    <code>{genError.requestId}</code>{" "}
                    <button
                      type="button"
                      className="mini-button"
                      style={{ padding: "2px 6px", fontSize: 11 }}
                      onClick={() => { void navigator.clipboard?.writeText(genError.requestId ?? ""); }}
                      title="Copy request ID"
                    >
                      Copy
                    </button>
                  </dd>
                </>
              ) : null}
              {typeof genError.httpStatus === "number" ? (<><dt>HTTP</dt><dd>{genError.httpStatus}</dd></>) : null}
              {typeof genError.retryable === "boolean" ? (<><dt>Retryable</dt><dd>{genError.retryable ? "yes" : "no"}</dd></>) : null}
              <dt>Message</dt><dd>{genError.message}</dd>
            </dl>
            {genError.raw ? (
              <pre className="gen-error-raw">{genError.raw}</pre>
            ) : null}
          </div>
        ) : null}
      </main>
      )}



      {walkthroughOpen ? (
        <WalkthroughOverlay
          anchor={walkthroughAnchor}
          step={activeWalkthroughStep}
          stepIndex={walkthroughStep}
          stepCount={WALKTHROUGH_STEPS.length}
          onClose={() => setWalkthroughOpen(false)}
          onNext={() => {
            if (walkthroughStep === WALKTHROUGH_STEPS.length - 1) {
              setWalkthroughOpen(false);
            } else {
              setWalkthroughStep((current) => Math.min(current + 1, WALKTHROUGH_STEPS.length - 1));
            }
          }}
          onPrevious={() => setWalkthroughStep((current) => Math.max(current - 1, 0))}
        />
      ) : null}

      {sessionCancelTarget ? (
        <SessionCancelDialog
          session={sessionCancelTarget}
          onCancel={() => setSessionCancelTarget(null)}
          onConfirm={confirmCancelSession}
        />
      ) : null}

      {lightboxAsset ? (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setLightboxAsset(null)}>
          <div className="lightbox-inner" onClick={(event) => event.stopPropagation()}>
            <button className="lightbox-close" type="button" onClick={() => setLightboxAsset(null)} aria-label="Close preview">
              <XCircle size={18} />
            </button>
            <AssetPreviewMedia asset={lightboxAsset} fallbackIconSize={42} controls />
            <div className="lightbox-actions">
              <button
                type="button"
                onClick={() => {
                  startEditFromAsset(lightboxAsset);
                  setLightboxAsset(null);
                }}
              >
                <Sparkles size={16} />
                Edit this
              </button>
              <button type="button" onClick={() => void downloadAssetFile(lightboxAsset)}>
                <Download size={16} />
                Save
              </button>
              {lightboxAsset.approval_status === "approved" ? (
                <button
                  type="button"
                  className="lightbox-approve is-approved"
                  onClick={() => {
                    void changeAssetStatus(lightboxAsset, "review");
                    setLightboxAsset({ ...lightboxAsset, approval_status: "review" });
                  }}
                  title="Approved — click to undo"
                >
                  <CheckCircle2 size={16} />
                  Approved
                </button>
              ) : (
                <button
                  type="button"
                  className="lightbox-approve"
                  onClick={() => {
                    void changeAssetStatus(lightboxAsset, "approved");
                    setLightboxAsset({ ...lightboxAsset, approval_status: "approved" });
                  }}
                >
                  <CheckCircle2 size={16} />
                  Approve
                </button>
              )}
              {lightboxAsset.approval_status !== "rejected" ? (
                <button
                  type="button"
                  className="lightbox-reject"
                  onClick={() => {
                    void changeAssetStatus(lightboxAsset, "rejected");
                    setLightboxAsset({ ...lightboxAsset, approval_status: "rejected" });
                  }}
                >
                  <XCircle size={16} />
                  Reject
                </button>
              ) : (
                <button
                  type="button"
                  className="lightbox-reject is-rejected"
                  onClick={() => {
                    void changeAssetStatus(lightboxAsset, "review");
                    setLightboxAsset({ ...lightboxAsset, approval_status: "review" });
                  }}
                  title="Rejected — click to undo"
                >
                  <XCircle size={16} />
                  Rejected
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {referencePickerOpen ? createPortal(
        <div
          className="reference-picker-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setReferencePickerOpen(false)}
        >
          <div className="reference-picker" onClick={(event) => event.stopPropagation()}>
            <button
              className="reference-picker-close"
              type="button"
              onClick={() => setReferencePickerOpen(false)}
              aria-label="Close reference picker"
            >
              <XCircle size={18} />
            </button>
            <header className="reference-picker-header">
              <h3>Add references</h3>
              <p>Reuse an approved image, pick a previous upload, or upload from your computer.</p>
            </header>
            <input
              ref={referencePickerInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={async (event) => {
                await handleReferenceUpload(event);
                setReferencePickerOpen(false);
              }}
            />
            <div className="reference-picker-body">
              {referenceLibraryLoading ? (
                <div className="reference-picker-empty">Loading your reference library…</div>
              ) : (
                <div className="reference-picker-grid">
                  <button
                    type="button"
                    className="reference-picker-upload"
                    onClick={() => referencePickerInputRef.current?.click()}
                  >
                    <Upload size={22} />
                    <strong>Upload from computer</strong>
                    <span>PNG, JPG or WEBP · you can also paste or drop</span>
                  </button>
                  {referenceLibrary.length ? (
                    referenceLibrary.map((asset) => (
                      <ReferencePickerCard
                        key={asset.id}
                        asset={asset}
                        active={referenceAssets.some(
                          (ref) => ref.id === asset.id || ref.source_asset_id === asset.id
                        )}
                        onPick={async () => {
                          await useAssetAsReference(asset);
                          setReferencePickerOpen(false);
                        }}
                      />
                    ))
                  ) : null}
                </div>
              )}
              {!referenceLibraryLoading && !referenceLibrary.length ? (
                <div className="reference-picker-empty">
                  No reference images yet — upload one or approve a generation to reuse it here.
                </div>
              ) : null}
            </div>

          </div>
        </div>,
        document.body
      ) : null}

      {referencePreviewAsset ? (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setReferencePreviewAsset(null)}>
          <div className="lightbox-inner reference-preview-inner" onClick={(event) => event.stopPropagation()}>
            <button className="lightbox-close" type="button" onClick={() => setReferencePreviewAsset(null)} aria-label="Close reference preview">
              <XCircle size={18} />
            </button>
            {referencePreviewAsset.preview_url ? (
              <img src={referencePreviewAsset.preview_url} alt={referencePreviewAsset.title} />
            ) : (
              <div className="reference-preview-placeholder"><Paperclip size={48} /></div>
            )}
            <div className="lightbox-actions reference-preview-actions">
              <button
                type="button"
                className="reference-preview-remove"
                onClick={() => {
                  removeReferenceFromDock(referencePreviewAsset);
                  setReferencePreviewAsset(null);
                }}
              >
                <X size={16} />
                Remove reference
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {maskPainterAsset ? (
        <MaskPainterDialog
          asset={maskPainterAsset}
          busy={maskPainterBusy}
          onClose={() => setMaskPainterAsset(null)}
          onSave={handlePaintedMaskSave}
        />
      ) : null}

      {compareBaseAsset && compareTargetAsset ? (
        <CompareDialog
          baseAsset={compareBaseAsset}
          targetAsset={compareTargetAsset}
          onClose={clearCompare}
          onApprove={(asset) => changeAssetStatus(asset, "approved")}
          onEdit={(asset) => {
            startEditFromAsset(asset);
            clearCompare();
          }}
        />
      ) : null}
    </div>
  );
}

function ReferencePickerCard({
  asset,
  active,
  onPick
}: {
  asset: Asset;
  active: boolean;
  onPick: () => void | Promise<void>;
}) {
  const full = asset.preview_url || asset.remote_url;
  const [src, setSrc] = useState(() => thumbnailUrl(full, 280));
  return (
    <button
      type="button"
      className={`reference-picker-card${active ? " is-active" : ""}`}
      onClick={() => { void onPick(); }}
      title={asset.title}
    >
      {src ? (
        <img
          src={src}
          alt={asset.title}
          loading="lazy"
          decoding="async"
          width={280}
          height={280}
          onError={() => {
            // Transformed variants aren't available for every source; fall back
            // to the original URL so the tile still renders.
            if (full && src !== full) setSrc(full);
          }}
        />
      ) : (
        <span className="reference-picker-card-fallback"><Paperclip size={18} /></span>
      )}
      <span className="reference-picker-card-title">{asset.title}</span>
      {active ? <span className="reference-picker-card-flag">In use</span> : null}
    </button>
  );
}


function WalkthroughOverlay({
  anchor,
  step,
  stepIndex,
  stepCount,
  onClose,
  onNext,
  onPrevious
}: {
  anchor: WalkthroughAnchor | null;
  step: WalkthroughStep;
  stepIndex: number;
  stepCount: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const isLastStep = stepIndex === stepCount - 1;

  return (
    <>
      <div className="walkthrough-scrim" aria-label="Walkthrough backdrop" />
      {anchor ? <div className="walkthrough-target-highlight" style={anchor.highlightStyle} aria-hidden="true" /> : null}
      <section
        className={`walkthrough-popover ${anchor?.placement === "above" ? "above" : "below"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Demo Walkthrough guide"
        style={anchor?.popoverStyle}
      >
        <button className="walkthrough-close" type="button" onClick={onClose} aria-label="Close walkthrough">
          <XCircle size={18} />
        </button>
        <p className="eyebrow">Demo Walkthrough</p>
        <span className="walkthrough-step-count">
          Step {stepIndex + 1} of {stepCount}
        </span>
        <h2>{step.title}</h2>
        <p>{step.detail}</p>
        {step.points?.length ? (
          <ul className="walkthrough-points">
            {step.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : null}
        <div className="walkthrough-progress" aria-label="Walkthrough steps">
          {WALKTHROUGH_STEPS.map((item, index) => (
            <span className={index === stepIndex ? "active" : ""} key={item.title} aria-label={`Step ${index + 1}: ${item.title}`} />
          ))}
        </div>
        <div className="walkthrough-actions">
          <button className="secondary-button" type="button" onClick={onPrevious} disabled={stepIndex === 0}>
            Back
          </button>
          <button className="primary-button" type="button" onClick={onNext}>
            {isLastStep ? "Finish" : "Next"}
          </button>
        </div>
      </section>
    </>
  );
}

function SessionCancelDialog({
  session,
  onCancel,
  onConfirm
}: {
  session: StudioSession;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="session-cancel-modal" role="dialog" aria-modal="true" aria-label="Cancel session confirmation">
      <section className="session-cancel-card">
        <button className="lightbox-close" type="button" onClick={onCancel} aria-label="Close cancel dialog">
          <XCircle size={18} />
        </button>
        <p className="eyebrow">Session control</p>
        <h2>Cancel this session?</h2>
        <p>
          <strong>{session.name}</strong> will be archived and removed from the active session list. Generated files,
          exports, and receipts stay on disk.
        </p>
        <div className="session-cancel-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Keep session
          </button>
          <button className="secondary-button danger-button" type="button" onClick={onConfirm}>
            <XCircle size={16} />
            Cancel session
          </button>
        </div>
      </section>
    </div>
  );
}

function measureWalkthroughAnchor(target: WalkthroughTarget): WalkthroughAnchor | null {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }

  const targetElement = document.querySelector<HTMLElement>(`[data-tour-id="${target}"]`);
  if (!targetElement) {
    return null;
  }

  const rect = targetElement.getBoundingClientRect();
  const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const highlightPadding = 8;
  const popoverWidth = Math.min(460, Math.max(300, viewportWidth - 32));
  const popoverHeightEstimate = 360;
  const targetTop = clamp(rect.top - highlightPadding, 10, Math.max(10, viewportHeight - 40));
  const targetLeft = clamp(rect.left - highlightPadding, 10, Math.max(10, viewportWidth - 40));
  const targetWidth = Math.max(48, Math.min(rect.width + highlightPadding * 2, viewportWidth - 20));
  const targetHeight = Math.max(42, Math.min(rect.height + highlightPadding * 2, viewportHeight - 20));
  const targetCenter = targetLeft + targetWidth / 2;
  const preferredBelowTop = targetTop + targetHeight + 18;
  const hasRoomBelow = preferredBelowTop + popoverHeightEstimate < viewportHeight - 16;
  const popoverTop = hasRoomBelow ? preferredBelowTop : clamp(targetTop - popoverHeightEstimate - 18, 16, viewportHeight - popoverHeightEstimate - 16);
  const popoverLeft = clamp(targetCenter - popoverWidth / 2, 16, Math.max(16, viewportWidth - popoverWidth - 16));
  const arrowLeft = clamp(targetCenter - popoverLeft, 26, popoverWidth - 26);

  return {
    highlightStyle: {
      top: targetTop,
      left: targetLeft,
      width: targetWidth,
      height: targetHeight
    },
    popoverStyle: {
      top: popoverTop,
      left: popoverLeft,
      width: popoverWidth,
      "--walkthrough-arrow-left": `${arrowLeft}px`
    } as CSSProperties,
    placement: hasRoomBelow ? "below" : "above"
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function CompareDialog({
  baseAsset,
  targetAsset,
  onClose,
  onApprove,
  onEdit
}: {
  baseAsset: Asset;
  targetAsset: Asset;
  onClose: () => void;
  onApprove: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="compare-modal" role="dialog" aria-modal="true" aria-label="Compare picks">
      <div className="compare-modal-inner">
        <header className="compare-header">
          <div>
            <p className="eyebrow">Review</p>
            <h2>Compare picks</h2>
          </div>
          <button className="lightbox-close" type="button" onClick={onClose} aria-label="Close compare">
            <XCircle size={18} />
          </button>
        </header>
        <div className="compare-grid">
          <ComparePane label="Base pick" asset={baseAsset} onApprove={onApprove} onEdit={onEdit} />
          <ComparePane label="Challenger" asset={targetAsset} onApprove={onApprove} onEdit={onEdit} />
        </div>
      </div>
    </div>
  );
}

function ComparePane({
  label,
  asset,
  onApprove,
  onEdit
}: {
  label: string;
  asset: Asset;
  onApprove: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
}) {
  const settings = parseJsonRecord(asset.settings_json);
  const dimensions = asset.width && asset.height ? `${asset.width} x ${asset.height}` : "size pending";

  return (
    <section className="compare-pane">
      <div className="compare-image">
        <AssetPreviewMedia asset={asset} fallbackIconSize={38} />
      </div>
      <div className="compare-copy">
        <p className="eyebrow">{label}</p>
        <h3>{asset.title}</h3>
        <div className="compare-meta">
          <span>{assetStatusCopy(asset.approval_status)}</span>
          <span>{asset.model ?? "model pending"}</span>
          <span>{dimensions}</span>
          {settings.aspect_ratio ? <span>{String(settings.aspect_ratio)}</span> : null}
        </div>
        {asset.notes ? <p>{asset.notes}</p> : <p>No notes yet.</p>}
        <div className="compare-actions">
          <button type="button" onClick={() => onApprove(asset)}>
            <CheckCircle2 size={15} />
            Approve
          </button>
          <button type="button" onClick={() => onEdit(asset)}>
            <Sparkles size={15} />
            Edit
          </button>
        </div>
      </div>
    </section>
  );
}

function promptForTask(task: FrankTask) {
  const prompts: Record<string, string> = {
    "background-remove":
      "Background sweep: isolate the product cleanly for a transparent PNG and PDP-safe product cutout. Keep packaging edges sharp, shadows soft, and label details honest.",
    "background-replace":
      "Background glow-up: keep the product truthful, replace the set with a Frank Body pink/coffee lifestyle backdrop, and leave useful campaign negative space.",
    "product-cleanup":
      "Product polish: clean dust, label edges, smudges, and small lighting issues while keeping the packaging real and recognizable.",
    "campaign-variants":
      "Campaign remix: create a bolder Frank Body campaign direction from the same product truth, with cheeky attitude and room for headline copy.",
    "aspect-crops":
      "Crop the goods: prepare channel-ready PDP, email hero, Instagram feed/story, and paid social compositions without cutting off the product.",
    "upscale-enhance":
      "Make it bigger: produce a high-res master with crisp packaging, clean texture detail, and no over-sharpened plastic finish.",
    "prompt-remix":
      "Brief remix: rewrite this into sharper creative directions for the Art Dept., keeping the product truth, channel, mood, and Frank voice clear."
  };

  return prompts[task.key] ?? `${task.label}: ${task.description}`;
}

function settingsForTask(taskKey: string, current: StudioSettings, model?: StudioModel): StudioSettings {
  const next = { ...current };
  if (["background-remove", "upscale-enhance"].includes(taskKey)) {
    next.count = 1;
    next.image_size = supportedOption(model?.allowed_image_sizes, "4K", current.image_size);
  } else if (taskKey === "product-cleanup") {
    next.count = 2;
    next.image_size = supportedOption(model?.allowed_image_sizes, "4K", current.image_size);
  } else if (["background-replace", "campaign-variants", "aspect-crops"].includes(taskKey)) {
    next.count = 4;
    next.aspect_ratio = supportedOption(model?.allowed_aspect_ratios, "4:5", current.aspect_ratio);
  }
  return next;
}

function supportedOption(options: string[] | undefined, preferred: string, fallback: string) {
  if (options?.includes(preferred)) {
    return preferred;
  }
  return fallback;
}

function taskShortcutIcon(taskKey: string) {
  if (taskKey === "background-remove") {
    return <ImageIcon size={15} />;
  }
  if (taskKey === "background-replace" || taskKey === "campaign-variants") {
    return <Wand2 size={15} />;
  }
  if (taskKey === "product-cleanup" || taskKey === "upscale-enhance") {
    return <Sparkles size={15} />;
  }
  if (taskKey === "aspect-crops") {
    return <Layers3 size={15} />;
  }
  return <RefreshCw size={15} />;
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function AssetPreviewMedia({
  asset,
  controls = false,
  fallbackIconSize = 24
}: {
  asset: Asset;
  controls?: boolean;
  fallbackIconSize?: number;
}) {
  if (!asset.preview_url) {
    return <ImageIcon size={fallbackIconSize} />;
  }

  if (isPlayableVideoAsset(asset)) {
    return (
      <video
        aria-label={asset.title}
        autoPlay={!controls}
        className="asset-preview-media"
        controls={controls}
        loop
        muted={!controls}
        playsInline
        preload="metadata"
        src={asset.preview_url}
      />
    );
  }

  return <img className="asset-preview-media" src={asset.preview_url} alt={asset.title} />;
}

function MaskPainterDialog({
  asset,
  busy,
  onClose,
  onSave
}: {
  asset: Asset;
  busy: boolean;
  onClose: () => void;
  onSave: (file: File) => void | Promise<void>;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintingRef = useRef(false);
  const [brushSize, setBrushSize] = useState(54);
  const [canvasReady, setCanvasReady] = useState(false);
  const [hasMask, setHasMask] = useState(false);

  useEffect(() => {
    setBrushSize(54);
    setCanvasReady(false);
    setHasMask(false);
    paintingRef.current = false;
  }, [asset.id]);

  function prepareCanvas() {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) {
      return;
    }

    canvas.width = image.naturalWidth || 1200;
    canvas.height = image.naturalHeight || 1200;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setCanvasReady(true);
    setHasMask(false);
  }

  function pointForEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function paintAt(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const point = pointForEvent(event);
    if (!canvas || !point) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(196, 17, 47, 0.72)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  }

  function startPainting(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canvasReady || busy) {
      return;
    }

    paintingRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic browser-QA events do not always create an active pointer capture target.
    }
    paintAt(event);
  }

  function continuePainting(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!paintingRef.current || busy) {
      return;
    }
    paintAt(event);
  }

  function stopPainting(event: ReactPointerEvent<HTMLCanvasElement>) {
    paintingRef.current = false;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture can already be gone after synthetic or interrupted input.
    }
  }

  function clearMask() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
  }

  function saveMask() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !hasMask) {
      return;
    }

    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    const outputCtx = output.getContext("2d");
    if (!outputCtx) {
      return;
    }

    outputCtx.fillStyle = "#000000";
    outputCtx.fillRect(0, 0, output.width, output.height);
    const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mask = outputCtx.getImageData(0, 0, output.width, output.height);
    for (let index = 0; index < source.data.length; index += 4) {
      if (source.data[index + 3] > 0) {
        mask.data[index] = 255;
        mask.data[index + 1] = 255;
        mask.data[index + 2] = 255;
        mask.data[index + 3] = 255;
      }
    }
    outputCtx.putImageData(mask, 0, 0);
    output.toBlob((blob) => {
      if (!blob) {
        return;
      }
      void onSave(new File([blob], `painted-mask-${asset.id}.png`, { type: "image/png" }));
    }, "image/png");
  }

  return (
    <div className="mask-painter-backdrop" role="dialog" aria-modal="true" aria-label="Paint edit mask" onClick={onClose}>
      <div className="mask-painter" onClick={(event) => event.stopPropagation()}>
        <div className="mask-painter-header">
          <div>
            <p className="eyebrow">Masked Edit</p>
            <h3>Paint the bits to change</h3>
            <span>{asset.title}</span>
          </div>
          <button className="lightbox-close" type="button" onClick={onClose} aria-label="Close mask painter">
            <XCircle size={18} />
          </button>
        </div>
        <div className="mask-painter-stage">
          {asset.preview_url ? <img ref={imageRef} src={asset.preview_url} alt="" onLoad={prepareCanvas} /> : <ImageIcon size={42} />}
          <canvas
            ref={canvasRef}
            aria-label="Painted edit mask"
            onPointerDown={startPainting}
            onPointerMove={continuePainting}
            onPointerUp={stopPainting}
            onPointerCancel={stopPainting}
          />
        </div>
        <div className="mask-painter-controls">
          <label>
            <span>Brush</span>
            <input
              type="range"
              min="12"
              max="140"
              step="2"
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
            />
          </label>
          <button className="secondary-button" type="button" onClick={clearMask} disabled={!hasMask || busy}>
            Clear
          </button>
          <button className="primary-button" type="button" onClick={saveMask} disabled={!hasMask || !canvasReady || busy}>
            {busy ? <RefreshCw className="spin" size={16} /> : <Paintbrush size={16} />}
            Use mask
          </button>
        </div>
      </div>
    </div>
  );
}

function isPlayableVideoAsset(asset: Asset) {
  if (asset.media_type !== "video") {
    return false;
  }
  const haystack = decodeURIComponent(`${asset.preview_url ?? ""} ${asset.file_path ?? ""}`).toLowerCase();
  return /\.(mp4|webm|mov|m4v)(?:$|[?#\s&])/.test(haystack) || /filename=[^&\s]+\.(mp4|webm|mov|m4v)/.test(haystack);
}

function OutputStrip({
  assets,
  emptyLabel = "Waiting for provider output",
  pending = false,
  pendingCount = 1,
  selectedAssetId,
  onSelect,
  onQuickApprove,
  onQuickReject,
  onUseAsFrame,
  canUseLastFrame = false
}: {
  assets: Asset[];
  emptyLabel?: string;
  pending?: boolean;
  pendingCount?: number;
  selectedAssetId?: string;
  onSelect: (asset: Asset) => void;
  onQuickApprove?: (asset: Asset) => void;
  onQuickReject?: (asset: Asset) => void;
  onUseAsFrame?: (asset: Asset, slot: "first" | "last") => void;
  canUseLastFrame?: boolean;
}) {
  if (!assets.length && pending) {
    return (
      <div className="output-grid">
        {Array.from({ length: Math.max(1, Math.min(4, pendingCount)) }).map((_, index) => (
          <div className="output-skeleton" key={`pending-${index}`}>
            <span className="output-skeleton-shimmer" aria-hidden="true" />
            <span className="output-skeleton-spinner" aria-hidden="true" />
            {index === 0 ? <span className="output-skeleton-label">{emptyLabel}</span> : null}
          </div>
        ))}
      </div>
    );
  }

  if (!assets.length) {
    return (
      <div className="output-placeholder">
        <RefreshCw size={18} />
        {emptyLabel}
      </div>
    );
  }


  return (
    <div className="output-grid">
      {assets.map((asset) => {
        const ratio = asset.width && asset.height ? `${asset.width} / ${asset.height}` : undefined;
        const status = asset.approval_status ?? "review";
        return (
          <div
            className={`output-tile${selectedAssetId === asset.id ? " selected" : ""} status-${status}`}
            key={asset.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/x-frank-asset", asset.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
            title={`${asset.title} — drag onto "Add references" to reuse`}
            style={ratio ? ({ ["--asset-aspect" as string]: ratio } as React.CSSProperties) : undefined}
          >

            <button
              type="button"
              className="output-tile-select"
              onClick={() => onSelect(asset)}
              aria-label={`Open ${asset.title}`}
            >
              <AssetPreviewMedia asset={asset} fallbackIconSize={24} />
              <span>{assetStatusCopy(status)}</span>
            </button>
            {(onQuickApprove || onQuickReject) && asset.kind !== "reference" && asset.kind !== "mask" ? (
              <div className="output-tile-quick" onClick={(e) => e.stopPropagation()}>
                {onQuickApprove ? (
                  <button
                    type="button"
                    className={`quick-approve${status === "approved" ? " active" : ""}`}
                    onClick={() => onQuickApprove(asset)}
                    aria-label="Approve pick"
                    title="Approve"
                  >
                    <CheckCircle2 size={14} />
                  </button>
                ) : null}
                {onQuickReject ? (
                  <button
                    type="button"
                    className={`quick-reject${status === "rejected" ? " active" : ""}`}
                    onClick={() => onQuickReject(asset)}
                    aria-label="Reject pick"
                    title="Reject"
                  >
                    <XCircle size={14} />
                  </button>
                ) : null}
              </div>
            ) : null}
            {onUseAsFrame && asset.media_type !== "video" && asset.kind !== "mask" ? (
              <div className="output-tile-frames" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => onUseAsFrame(asset, "first")} title="Use as first frame">
                  first frame
                </button>
                {canUseLastFrame ? (
                  <button type="button" onClick={() => onUseAsFrame(asset, "last")} title="Use as last frame">
                    last frame
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function mergeModels(remote: StudioModel[] | undefined, fallback: StudioModel[]): StudioModel[] {
  const localById = new Map(fallback.map((m) => [m.id, m]));
  // Provider-outage flags live in the local model roster, so re-apply them onto
  // remote entries — otherwise a backend config refresh silently clears them.
  const out: StudioModel[] = remote?.length
    ? remote.map((m) => {
        const local = localById.get(m.id);
        return local?.degraded
          ? { ...m, degraded: true, degraded_note: local.degraded_note }
          : m;
      })
    : [];
  const seen = new Set(out.map((m) => m.id));
  for (const m of fallback) {
    if (!seen.has(m.id)) out.push(m);
  }
  return out.length ? out : fallback;
}

function mergeConfig(config: FrankConfig): FrankConfig {
  return {
    ...fallbackConfig,
    ...config,
    models: mergeModels(config.models, fallbackConfig.models),
    backlogModels: config.backlogModels ?? fallbackConfig.backlogModels,
    promptPresets: config.promptPresets?.length ? config.promptPresets : fallbackConfig.promptPresets,
    exportPresets: config.exportPresets?.length ? config.exportPresets : fallbackConfig.exportPresets,
    tasks: config.tasks?.length ? config.tasks : fallbackConfig.tasks,
    providers: config.providers?.length ? config.providers : fallbackConfig.providers,
    voice: { ...fallbackConfig.voice, ...config.voice }
  };
}

function isMainDemoSession(session: StudioSession) {
  return session.name.trim().toLowerCase() === "frank body demo studio";
}

function chooseLaunchSession(sessions: StudioSession[]) {
  return sessions.find(isMainDemoSession) ?? sessions[0];
}

function makeBriefDraft(overrides: Partial<BriefFormState> = {}): BriefFormState {
  return {
    title: "",
    productName: "",
    taskType: "product-shot-lab",
    channel: "PDP / paid social",
    tone: "Cheeky but premium",
    prompt: "",
    negativePrompt: "",
    ...overrides
  };
}

function briefToDraft(brief: Brief): BriefFormState {
  return makeBriefDraft({
    title: brief.title ?? "",
    productName: brief.product_name ?? "",
    taskType: brief.task_type ?? "product-shot-lab",
    channel: brief.channel ?? "",
    tone: brief.tone ?? "",
    prompt: brief.prompt ?? "",
    negativePrompt: brief.negative_prompt ?? ""
  });
}

function exportPresetsForAsset(presets: ExportPreset[], asset: Asset) {
  const mediaType = asset.media_type ?? "image";
  return presets.filter((preset) => (preset.media_types ?? ["image"]).includes(mediaType));
}

function firstReviewableAsset(assets: Asset[]) {
  const outputAssets = assets.filter((asset) => !["reference", "mask"].includes(asset.kind));
  return outputAssets.find((asset) => (asset.media_type ?? "image") !== "video") ?? outputAssets[0] ?? null;
}

function filterExportsForAssets(records: ExportRecord[], assets: Asset[]) {
  const assetIds = new Set(assets.map((asset) => asset.id));
  return records.filter((record) => assetIds.has(record.asset_id));
}

function normalizeExportRecord(record: ExportRecord, fallback: Partial<ExportRecord>) {
  return {
    ...fallback,
    ...record,
    asset_id: record.asset_id ?? fallback.asset_id ?? "",
    preset: record.preset ?? fallback.preset ?? "export-pack",
    metadata_json: record.metadata_json ?? fallback.metadata_json ?? "{}",
    sync_status: record.sync_status ?? fallback.sync_status ?? "local",
    remote_id: record.remote_id ?? fallback.remote_id,
    created_at: record.created_at ?? new Date().toISOString()
  } as ExportRecord;
}

function exportRecordLabel(record: ExportRecord, presets: ExportPreset[]) {
  if (record.preset === "session-handoff") {
    return "Cliff Pack";
  }
  return presets.find((preset) => preset.key === record.preset)?.label ?? titleize(record.preset ?? "export-pack");
}

function exportRecordMeta(record: ExportRecord, assets: Asset[]) {
  const created = record.created_at ? new Date(record.created_at) : null;
  const createdLabel = created && !Number.isNaN(created.getTime()) ? created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "saved";
  if (record.preset === "session-handoff") {
    const metadata = parseExportMetadata(record.metadata_json);
    const assetCount = Number(metadata.asset_count ?? metadata.approved_assets ?? 0);
    const referenceCount = Number(metadata.reference_count ?? metadata.references ?? 0);
    const videoCount = Number(metadata.video_count ?? metadata.approved_videos ?? 0);
    const parts = [
      `${assetCount} approved`,
      videoCount > 0 ? `${videoCount} motion` : null,
      `${referenceCount} refs`
    ].filter(Boolean);
    return `${parts.join(" / ")} / ${createdLabel}`;
  }
  const asset = assets.find((item) => item.id === record.asset_id);
  return `${asset?.title ?? "Export pack"} / ${createdLabel}`;
}

function parseExportMetadata(metadataJson?: string) {
  if (!metadataJson) {
    return {} as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(metadataJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

function titleize(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function initialStudioMode(): "image-studio" | "product-shot-lab" | "video-lab" | "approved-hot" | "preset-creator" | "prompt-generator" | "enhancer" {
  if (typeof window === "undefined") {
    return "image-studio";
  }

  const mode = new URLSearchParams(window.location.search).get("mode");
  if (mode === "preset-creator") return "preset-creator";
  if (mode === "prompt-generator") return "prompt-generator";
  if (mode === "enhancer") return "enhancer";
  return mode === "product-shot-lab" || mode === "video-lab" || mode === "approved-hot" ? mode : "image-studio";
}

function shouldAutoOpenProviderAudit() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("provider_audit") === "1";
}

function preferredStudioModel(models: StudioModel[]) {
  return (
    models.find((model) => model.id === "google-nb-pro" && model.configured !== false) ??
    models[0] ??
    fallbackConfig.models[0]
  );
}

function modelName(config: FrankConfig, modelId: string) {
  return config.models.find((model) => model.id === modelId)?.short_label ?? modelId;
}

function selectedAssetReviewMetadata(asset: Asset, assets: Asset[], config: FrankConfig, turns: StudioTurn[]) {
  const turn = turns.find((item) => item.id === asset.turn_id);
  const settings = parseJsonRecord(asset.settings_json ?? turn?.settings_json);
  const workflow = parseJsonRecord(settings.workflow_provenance);
  const referenceIds = parseJsonList(asset.reference_asset_ids_json ?? turn?.reference_asset_ids_json);
  const model = config.models.find((item) => item.id === (asset.model ?? turn?.model));
  const provider = asset.provider ?? turn?.provider ?? model?.provider;
  const modelLabel = `${providerDisplayName(provider)} / ${model?.short_label ?? asset.model ?? turn?.model ?? "model pending"}`;
  const settingsLabel = settingsSummary(settings);
  const dimensionsLabel = asset.width && asset.height ? `${asset.width} x ${asset.height}` : "";
  const sourceId = asset.source_asset_id ?? turn?.source_asset_id;
  const sourceLabel = sourceId ? assets.find((item) => item.id === sourceId)?.title ?? sourceId : "";
  const referenceLabel = `${referenceIds.length} reference${referenceIds.length === 1 ? "" : "s"}`;
  const workflowLabel = workflowSummary(workflow);

  return {
    modelLabel,
    settingsLabel,
    dimensionsLabel,
    sourceLabel,
    workflowLabel,
    referenceLabel,
    prompt: asset.prompt ?? turn?.prompt ?? ""
  };
}

function selectedAssetRunBrief(asset: Asset, assets: Asset[], config: FrankConfig, turns: StudioTurn[]) {
  const turn = turns.find((item) => item.id === asset.turn_id);
  const metadata = selectedAssetReviewMetadata(asset, assets, config, turns);
  const workflowBridge = assetWorkflowBridge(asset, turns);
  const referenceIds = parseJsonList(asset.reference_asset_ids_json ?? turn?.reference_asset_ids_json);
  const referenceNames = referenceIds
    .map((id) => assets.find((item) => item.id === id)?.title ?? id)
    .filter(Boolean);
  const approval = asset.approval_status === "approved" ? "Approved" : titleize(asset.approval_status ?? "review");
  const status = `${approval}${asset.favorite ? " / favorite" : ""}`;
  const lines = [
    "Frank Create Run Brief",
    `Asset: ${asset.title}`,
    `Status: ${status}`,
    `Media: ${asset.media_type ?? "image"}`,
    metadata.modelLabel ? `Model: ${metadata.modelLabel}` : "",
    metadata.settingsLabel ? `Settings: ${metadata.settingsLabel}` : "",
    metadata.dimensionsLabel ? `Size: ${metadata.dimensionsLabel}` : "",
    metadata.workflowLabel ? `Workflow: ${metadata.workflowLabel}` : "",
    workflowBridge.workflow_receipt_url ? `Workflow receipt: ${workflowBridge.workflow_receipt_url}` : "",
    metadata.sourceLabel ? `Source: ${metadata.sourceLabel}` : "",
    `References: ${referenceNames.length ? referenceNames.join(", ") : metadata.referenceLabel}`,
    metadata.prompt ? `Prompt: ${metadata.prompt}` : "",
    asset.notes ? `Review notes: ${asset.notes}` : "",
    `Sync: ${asset.sync_status ?? "local"}`,
    asset.file_path ? `File: ${asset.file_path}` : "",
    turn?.id ? `Turn: ${turn.id}` : "",
    "Provider keys: server-side only; no secrets included."
  ];
  return lines.filter(Boolean).join("\n");
}

function selectedAssetWorkflowJson(asset: Asset, assets: Asset[], config: FrankConfig, turns: StudioTurn[]) {
  const turn = turns.find((item) => item.id === asset.turn_id);
  const settings = sanitizeWorkflowPayload(parseJsonRecord(asset.settings_json ?? turn?.settings_json)) as Record<string, unknown>;
  const workflowProvenance = parseJsonRecord(settings.workflow_provenance);
  const referenceIds = parseJsonList(asset.reference_asset_ids_json ?? turn?.reference_asset_ids_json);
  const sourceId = asset.source_asset_id ?? turn?.source_asset_id;
  const model = config.models.find((item) => item.id === (asset.model ?? turn?.model));
  const workflowBridge = assetWorkflowBridge(asset, turns, workflowProvenance);

  return {
    product: "Frank Create",
    asset_id: asset.id,
    asset_title: asset.title,
    media_type: asset.media_type ?? "image",
    provider: asset.provider ?? turn?.provider ?? model?.provider ?? null,
    model: asset.model ?? turn?.model ?? model?.id ?? null,
    prompt: asset.prompt ?? turn?.prompt ?? "",
    settings,
    workflow_provenance: workflowProvenance,
    workflow_bridge: workflowBridge,
    source: sourceId ? assetReferenceSummary(sourceId, assets) : null,
    references: referenceIds.map((id) => assetReferenceSummary(id, assets)),
    approval_status: asset.approval_status ?? "review",
    favorite: Boolean(asset.favorite),
    sync_status: asset.sync_status ?? "local",
    file_path: asset.file_path ?? "",
    created_at: asset.created_at ?? null,
    updated_at: asset.updated_at ?? null,
    turn_id: turn?.id ?? asset.turn_id ?? null,
    provider_keys: "server-side only; no secrets included"
  };
}

function assetWorkflowBridge(asset: Asset, turns: StudioTurn[], workflowProvenance?: Record<string, unknown>) {
  const turn = turns.find((item) => item.id === asset.turn_id);
  const settings = workflowProvenance
    ? { workflow_provenance: workflowProvenance }
    : (parseJsonRecord(asset.settings_json ?? turn?.settings_json) as Record<string, unknown>);
  const workflow = workflowProvenance ?? parseJsonRecord(settings.workflow_provenance);
  const workflowJson = parseJsonRecord(workflow.workflow_json);
  return {
    asset_id: asset.id,
    workflow_key: typeof workflow.workflow_key === "string" ? workflow.workflow_key : asset.model ?? turn?.model ?? null,
    engine: typeof workflow.engine === "string" ? workflow.engine : asset.provider ?? turn?.provider ?? null,
    node_types: workflowNodeTypes(workflow, workflowJson),
    workflow_receipt_url: assetWorkflowReceiptUrl(asset.id)
  };
}

function workflowNodeTypes(workflow: Record<string, unknown>, workflowJson: Record<string, unknown>) {
  const localNodeTypes = localWorkflowNodeTypes(typeof workflow.workflow_key === "string" ? workflow.workflow_key : "");
  if (localNodeTypes.length) {
    return localNodeTypes;
  }
  if (Array.isArray(workflow.node_types)) {
    return workflow.node_types.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  return Object.entries(workflowJson)
    .sort(([left], [right]) => workflowNodeSortKey(left).localeCompare(workflowNodeSortKey(right)))
    .map(([, node]) => parseJsonRecord(node).class_type)
    .filter((item): item is string => typeof item === "string" && item.length > 0);
}

function localWorkflowNodeTypes(workflowKey: string) {
  const byWorkflow: Record<string, string[]> = {
  };
  return byWorkflow[workflowKey] ?? [];
}

function workflowNodeSortKey(nodeId: string) {
  const numeric = Number.parseInt(nodeId, 10);
  return Number.isFinite(numeric) ? `0-${numeric.toString().padStart(6, "0")}` : `1-${nodeId}`;
}

function assetReferenceSummary(id: string, assets: Asset[]) {
  const asset = assets.find((item) => item.id === id);
  return {
    id,
    title: asset?.title ?? id
  };
}

function safeFileStem(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "frank-create-workflow"
  );
}

function sanitizeWorkflowPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeWorkflowPayload(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveWorkflowKey(key) ? "[server-side secret]" : sanitizeWorkflowPayload(item)
    ])
  );
}

function isSensitiveWorkflowKey(key: string) {
  return /api[_-]?key|token|secret|authorization|bearer|password|credential/i.test(key);
}

function settingsSummary(settings: Record<string, unknown>) {
  const aspect = typeof settings.aspect_ratio === "string" ? settings.aspect_ratio : "";
  const size = typeof settings.image_size === "string" || typeof settings.image_size === "number" ? String(settings.image_size) : "";
  const countValue = Number(settings.count ?? 0);
  const count = Number.isFinite(countValue) && countValue > 0 ? Math.trunc(countValue) : 0;
  const pieces = [aspect, size].filter(Boolean);
  if (count) {
    pieces.push(`${count} ${count === 1 ? "variant" : "variants"}`);
  }
  return pieces.join(" / ");
}

function workflowSummary(workflow: Record<string, unknown>) {
  const workflowKey = typeof workflow.workflow_key === "string" ? workflow.workflow_key : "";
  const engine = typeof workflow.engine === "string" ? workflow.engine : "";
  const checkpoint = typeof workflow.checkpoint_name === "string" ? workflow.checkpoint_name : "";
  if (!workflowKey && !engine) {
    return "";
  }
  const label = [workflowKey, engine].filter(Boolean).join(" / ");
  return checkpoint ? `${label} / ${checkpoint}` : label;
}

function providerDisplayName(provider?: string) {
  const names: Record<string, string> = {
    google: "Google",
    local: "Local",
    openai: "OpenAI",
    replicate: "Replicate"
  };
  return provider ? names[provider] ?? titleize(provider) : "Provider";
}

function turnEmptyLabel(turn: StudioTurn) {
  if (turn.status === "blocked") {
    let code: string | undefined;
    try {
      code = turn.error_json ? (JSON.parse(turn.error_json)?.code as string | undefined) : undefined;
    } catch {
      code = undefined;
    }
    if (code === "offline") {
      return "Staged locally — preview backend offline";
    }
    return "Provider setup needed";
  }
  if (turn.status === "failed") {
    const detail = turnErrorCopy(turn);
    return detail || "Provider returned no image";
  }
  return "Waiting for provider output";
}

function turnKindLabel(turn: StudioTurn) {
  if (turn.kind === "edit") {
    return "Edit round";
  }
  if (turn.kind === "video") {
    return "Motion round";
  }
  return "Generate round";
}

function referenceCountLabel(count: number) {
  return `${count} reference${count === 1 ? "" : "s"}`;
}

function doctorStatusIcon(status: "ready" | "warning" | "fail") {
  if (status === "ready") {
    return "OK";
  }
  if (status === "warning") {
    return "!";
  }
  return "Fix";
}

function activationStatusIcon(status: ActivationChecklist["steps"][number]["status"]) {
  if (status === "ready") {
    return "OK";
  }
  if (status === "recommended") {
    return "Tip";
  }
  return "Do";
}

function activationPathLabel(path: string) {
  return /models[\\/]+checkpoints$/i.test(path) ? "models\\checkpoints" : path;
}

function activationModelTotal(checklist: ActivationChecklist) {
  const explicitTotal = Number(checklist.summary.provider_model_count);
  if (Number.isFinite(explicitTotal) && explicitTotal > 0) {
    return explicitTotal;
  }
  return Number(checklist.summary.ready_provider_models || 0) + Number(checklist.summary.waiting_provider_models || 0);
}

function activationChecklistInlineStatus(checklist: ActivationChecklist) {
  const count = checklist.steps.length;
  return `Activation checklist tracked: ${count} unlock ${count === 1 ? "step" : "steps"}`;
}

function demoDoctorSummary(doctor: DemoDoctorStatus) {
  const smokeCopy = doctor.summary.workflowSmokeOk ? "workflow smoke passed" : "run workflow smoke";
  return `${doctor.summary.outputAssetCount} outputs, ${doctor.summary.referenceAssetCount} refs, ${smokeCopy}, ${doctor.summary.waitingProviderModels} live models waiting.`;
}

function buildLaunchReadinessItems(
  config: FrankConfig,
  waitingModelCount: number,
  doctor: DemoDoctorStatus | null,
  checklist: ActivationChecklist | null,
  readinessPackSha: string
) {
  const liveWaiting = checklist?.summary.waiting_provider_models ?? doctor?.summary.waitingProviderModels ?? waitingModelCount;
  const packReady = Boolean(readinessPackSha || doctor?.summary.readinessPackReady);
  const demoIsCurated = doctor ? doctor.summary.demoCurated !== false : true;
  return [
    {
      key: "local-demo",
      status: doctor?.readyForDemo === false || !demoIsCurated ? "warning" : "ready",
      badge: doctor?.readyForDemo === false || !demoIsCurated ? "Do" : "OK",
      label: !demoIsCurated ? "Reset demo before Cliff" : "Local demo ready",
      detail: !demoIsCurated
        ? `${doctor?.summary.imageOutputAssetCount ?? doctor?.summary.outputAssetCount ?? 0} visible image outputs; use Reset demo for the clean seed.`
        : doctor?.summary.workflowSmokeOk
          ? "Smoke-tested generate, edit, approve, export, and handoff."
          : "Generate, edit, approve, export, and handoff are wired to the cloud backend."
    },
    {
      key: "live-keys",
      status: liveWaiting ? "warning" : "ready",
      badge: liveWaiting ? "Do" : "OK",
      label: liveWaiting ? `${liveWaiting} live key models waiting` : "Live APIs unlocked",
      detail: liveWaiting
        ? "Use Provider Setup for rotated server-side keys; no browser secrets."
        : "Provider proxy can run the visible live model roster."
    },
    {
      key: "proof-pack",
      status: packReady ? "ready" : "recommended",
      badge: packReady ? "OK" : "Tip",
      label: packReady ? "Proof pack ready" : "Build proof pack",
      detail: readinessPackSha ? `Verified SHA-256 ${readinessPackSha.slice(0, 12)}...` : "Run Demo Doctor, then build the call pack before sending."
    }
  ];
}

function buildCliffGuideSteps(outputAssets: Asset[], referenceAssets: Asset[], approvedCount: number, approvedMotionCount: number) {
  const reviewableImages = outputAssets.filter((asset) => (asset.media_type ?? "image") !== "video");
  return [
    {
      label: "Image Studio",
      detail: "Open with sessions, prompt thread, references, model picker, and Frank Body Mode.",
      status: outputAssets.length ? `${outputAssets.length} outputs` : "seed demo"
    },
    {
      label: "Product Shot Lab",
      detail: "Use the product presets, run a local round, then approve the best shot.",
      status: referenceAssets.length ? `${referenceAssets.length} refs` : "add refs"
    },
    {
      label: "Paint edit mask",
      detail: "Select an image, paint a retouch mask, save it into Masked Edit, then make another round.",
      status: reviewableImages.length ? "image ready" : "need image"
    },
    {
      label: "Video Lab",
      detail: "Turn an approved image into a motion storyboard and export the storyboard ZIP.",
      status: approvedMotionCount ? `${approvedMotionCount} motion` : "storyboard path"
    }
  ];
}

function buildCliffGuideProofs(doctor: DemoDoctorStatus | null, manifest: DemoReadinessPackResult["manifest"] | null) {
  const screenshots = manifest?.screenshot_count ?? 0;
  const browserQaChecks = new Set(
    (manifest?.browser_qa?.checks ?? [])
      .filter((check) => check.status === "ready" || check.browser_status === "ready")
      .map((check) => check.key)
  );
  return [
    doctor?.summary.workflowSmokeOk ? "Workflow smoke passed" : "Run workflow smoke",
    doctor?.summary.activationChecklistReady ? "Production checklist ready" : "Build call pack for checklist",
    screenshots > 0 ? `${screenshots} QA screenshots ready` : "Build call pack for screenshots",
    manifest?.cliff_pack?.status === "included" ? "Cliff Pack included" : "Export Cliff Pack before sending",
    browserQaChecks.has("studio_model_preflight") ? "Model preflight proved" : "Run selected model preflight",
    browserQaChecks.has("studio_local_generate") ? "Local Generate proved" : "Run local Generate proof",
    browserQaChecks.has("studio_masked_edit_generate") ? "Masked edit proved" : "Run masked edit proof"
  ];
}

function turnErrorCopy(turn: StudioTurn) {
  if (!turn.error_json) {
    return "";
  }

  try {
    const error = JSON.parse(turn.error_json) as { code?: string; env_vars?: string[]; message?: string };
    if (error.code === "missing_key" && error.env_vars?.length) {
      return `Needs ${error.env_vars.join(" or ")}`;
    }
    return error.message ?? error.code ?? "";
  } catch {
    return turn.error_json;
  }
}

function parseJsonRecord(value?: unknown) {
  if (!value) {
    return {} as Record<string, unknown>;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") {
    return {} as Record<string, unknown>;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function nextRoundPrompt(asset: Asset, direction: "similar" | "cleanup" | "campaign", preset?: PromptPreset) {
  const note = asset.notes?.trim();
  const base =
    direction === "cleanup"
      ? "Make another round from this selected image. Clean up product edges, label clarity, lighting, and small retouching issues while keeping the product structure accurate."
      : direction === "campaign"
        ? "Make another campaign round from this selected image. Keep the product recognizable, push the set styling, and create director-ready variants with Frank Body attitude."
        : "Make another round like this selected image. Preserve the strongest composition, product scale, label plausibility, and Frank Body palette while exploring better variants.";
  const parts = [base];
  if (preset?.prompt) {
    parts.push(`Preset direction: ${preset.prompt}`);
  }
  if (note) {
    parts.push(`Review note to honor: ${note}`);
  }
  return parts.join("\n\n");
}

function missingKeyCopy(model: StudioModel) {
  if (model.configured !== false) {
    return "";
  }

  const envVars = model.missing_env_vars ?? [];
  if (!envVars.length) {
    return " / needs key";
  }

  return ` / needs ${envVars[0]}${envVars.length > 1 ? ` (+${envVars.length - 1})` : ""}`;
}

function missingKeyTitle(model: StudioModel) {
  return model.configured === false ? (model.missing_env_vars ?? []).join(" or ") : undefined;
}

function modelMissingKeyAction(model?: StudioModel) {
  if (!model || model.provider === "local" || model.configured !== false) {
    return "";
  }

  const envVars = (model.missing_env_vars?.length ? model.missing_env_vars : model.env_vars) ?? [];
  if (!envVars.length) {
    return `${model.short_label ?? model.label} needs a server key before live API rounds.`;
  }

  return `Add ${envVars.join(" or ")} in the server key file, then reload keys.`;
}

function modelReferenceLimitAction(model: StudioModel | undefined, referenceCount: number) {
  const limit = Number(model?.reference_image_limit ?? 0);
  if (!model || !Number.isFinite(limit) || limit <= 0 || referenceCount <= limit) {
    return "";
  }

  const extraCount = referenceCount - limit;
  return `${model.short_label ?? model.label} can use ${limit} references. Remove ${extraCount} ${
    extraCount === 1 ? "reference" : "references"
  } before making this round.`;
}

function providerPreflightStatusLabel(status: ProviderPreflight["status"]) {
  if (status === "ready") {
    return "Preflight ready";
  }
  if (status === "blocked") {
    return "Preflight blocked";
  }
  return "Preflight unsupported";
}

function providerSetup(models: StudioModel[]) {
  const waitingModels = models.filter((model) => model.configured === false);
  const envVars = orderProviderEnvVars(
    Array.from(new Set(waitingModels.flatMap((model) => model.missing_env_vars ?? []))),
    providerUnlockPlan(models)
  );

  return { waitingModels, envVars };
}

function providerUnlockPlan(models: StudioModel[]) {
  const groups = new Map<
    string,
    {
      id: string;
      envVars: string[];
      models: StudioModel[];
      priority: number;
    }
  >();

  for (const model of models) {
    if (model.provider === "local") {
      continue;
    }

    const envVars = providerModelEnvVars(model);
    if (!envVars.length) {
      continue;
    }

    const key = envVars.join("|");
    const existing = groups.get(key);
    if (existing) {
      existing.models.push(model);
      existing.priority = Math.min(existing.priority, providerUnlockPriority(model));
    } else {
      groups.set(key, {
        id: key,
        envVars,
        models: [model],
        priority: providerUnlockPriority(model)
      });
    }
  }

  return Array.from(groups.values())
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
    .map((group) => {
      const modelLabels = group.models.map((model) => model.short_label ?? model.label);
      const capabilityCopy = capabilitySummary(group.models);
      const groupReady = group.models.every((model) => model.configured);
      return {
        id: group.id,
        envVars: group.envVars,
        label: modelLabels.join(" + "),
        keyCopy: groupReady
          ? `${joinWithOr(group.envVars)} ready`
          : group.envVars.length === 1
            ? `Add ${group.envVars[0]}`
            : `Use one of ${joinWithOr(group.envVars)}`,
        capabilityCopy
      };
    });
}

function orderProviderEnvVars(envVars: string[], rows: ReturnType<typeof providerUnlockPlan>) {
  const desiredOrder = rows.flatMap((row) => row.envVars);
  const priority = new Map(desiredOrder.map((envVar, index) => [envVar, index]));
  return Array.from(new Set(envVars)).sort((left, right) => {
    const leftPriority = priority.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priority.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftPriority - rightPriority || left.localeCompare(right);
  });
}

function providerModelEnvVars(model: StudioModel) {
  const envVars = model.env_vars?.length
    ? model.env_vars
    : model.missing_env_vars?.length
      ? model.missing_env_vars
      : model.configured_env_var
        ? [model.configured_env_var]
        : [];

  return Array.from(new Set(envVars));
}

function providerKeyPlanText({
  rows,
  envVars,
  readyModels,
  modelCount,
  keyFilePath
}: {
  rows: ReturnType<typeof providerUnlockPlan>;
  envVars: string[];
  readyModels?: number;
  modelCount: number;
  keyFilePath: string;
}) {
  const lines = [
    "Frank Create Provider Key Plan",
    "",
    `Server key file: ${keyFilePath}`,
    `Provider readiness: ${readyModels ?? 0} / ${modelCount} live provider models ready`,
    "Provider secret values are not included. Paste rotated keys only into Provider Setup or the local server key file.",
    ""
  ];

  if (rows.length) {
    lines.push("Cliff key order:");
    rows.forEach((row, index) => {
      lines.push(`${index + 1}. ${row.label}`);
      lines.push(`   Keys: ${row.keyCopy}`);
      lines.push(`   Unlocks: ${row.capabilityCopy}`);
    });
  } else {
    lines.push("Cliff key order: all visible provider rows are unlocked.");
  }

  if (envVars.length) {
    lines.push("", `Missing env vars: ${envVars.join(", ")}`);
  }

  lines.push("", "Rotate any exposed token before live provider use.");
  return lines.join("\n");
}

function productionUnlockPlanText(checklist: ActivationChecklist) {
  const summary = checklist.summary;
  const lines = [
    "Frank Create Production Unlock Plan",
    "",
    `Status: ${checklist.status}`,
    `Live model paths unlocked: ${summary.ready_provider_models} / ${activationModelTotal(checklist)}`,
    `Server key file: ${summary.server_key_file || "user\\frank_create\\provider_keys.env"}`,
    `Local checkpoints detected: ${summary.checkpoint_count}`,
    "Allowed provider env vars: GOOGLE_API_KEY, REPLICATE_API_TOKEN, OPENAI_API_KEY",
    "No provider secret values are included.",
    ""
  ];

  lines.push("Actions:");
  checklist.steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step.label} (${step.status})`);
    lines.push(`   ${step.detail}`);
    lines.push(`   Action: ${step.action}`);
    if (step.env_vars?.length) {
      lines.push(`   Env vars: ${step.env_vars.join(", ")}`);
    }
    if (step.path) {
      const checkpointNote = step.minimum_checkpoint_mb ? `; minimum ${step.minimum_checkpoint_mb} MB` : "";
      lines.push(`   Path: ${activationPathLabel(step.path)}${checkpointNote}`);
    }
  });

  if (summary.missing_env_vars?.length) {
    lines.push("", `Missing env vars: ${summary.missing_env_vars.join(", ")}`);
  }
  if (checklist.notes.length) {
    lines.push("", "Notes:");
    checklist.notes.forEach((note) => lines.push(`- ${note}`));
  }
  lines.push("", "Paste rotated keys only into Provider Setup or the local server key file.");
  return lines.join("\n");
}

function parseReadyStatusLink(text: string) {
  const match = text.match(/^(.+?) link ready: (.+)$/);
  if (!match) {
    return null;
  }
  return { label: match[1], url: match[2] };
}

function providerUnlockPriority(model: StudioModel) {
  const priorities: Record<string, number> = {
    "google-nb-pro": 1,
    "google-nb-2": 1,
    "openai-gpt-image-2": 2,
    "riverflow-2-pro": 2,
    "reve-2-1": 3,
    "mai-image-2-5": 3,
    "seedream-5-pro": 3
  };

  return priorities[model.id] ?? 99;
}


function capabilitySummary(models: StudioModel[]) {
  const capabilities = models.reduce(
    (result, model) => ({
      generation: result.generation || model.capabilities.generation,
      edit: result.edit || model.capabilities.edit,
      masked_edit: result.masked_edit || model.capabilities.masked_edit,
      video: result.video || model.capabilities.video
    }),
    { generation: false, edit: false, masked_edit: false, video: false }
  );
  const labels = [
    capabilities.generation ? "gen" : "",
    capabilities.edit ? "edit" : "",
    capabilities.masked_edit ? "mask" : "",
    capabilities.video ? "video" : ""
  ].filter(Boolean);
  const badges = Array.from(new Set(models.map((model) => model.badge).filter(Boolean)));

  return [labels.join(" + "), badges.join(" / ")].filter(Boolean).join(" / ");
}

function providerAuditOperationSummary(operationKinds: string[] = [], requestPreviews?: Record<string, unknown>) {
  const previewCount = Object.keys(requestPreviews ?? {}).length || operationKinds.length;
  const labels = operationKinds.map((kind) => kind.replace(/_/g, " "));
  return `${previewCount} ops: ${labels.join(", ") || "none"}`;
}

function joinWithOr(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  return `${values.slice(0, -1).join(", ")} or ${values[values.length - 1]}`;
}

function referenceUrlForGeneration(asset: Asset) {
  return asset.remote_url || asset.preview_url || asset.file_path;
}

function composeVideoReferencePrompt(
  prompt: string,
  references: Asset[],
  firstFrame?: Asset | null,
  lastFrame?: Asset | null
) {
  const frames: string[] = [];
  if (firstFrame) frames.push(`First frame (@first) = ${firstFrame.title}`);
  if (lastFrame) frames.push(`Last frame (@last) = ${lastFrame.title}`);
  let body = prompt
    .replace(/@first\b/gi, "the first frame image (@first)")
    .replace(/@last\b/gi, "the last frame image (@last)");
  if (references.length) {
    body = [buildReferenceManifest(references), expandReferenceTags(body, references)].join("\n");
  }
  return frames.length ? [...frames, body].join("\n") : body;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read image preview."));
    reader.readAsDataURL(file);
  });
}

function makeLocalSession(): StudioSession {
  const now = new Date().toISOString();
  return {
    id: makeLocalId("session"),
    name: "Local image session",
    mode: "image",
    status: "preview",
    created_at: now,
    updated_at: now,
    sync_status: "local"
  };
}

function makeLocalTurn(sessionId: string, request: ReturnType<typeof buildTurnRequest>): StudioTurn {
  const now = new Date().toISOString();
  return {
    id: makeLocalId("turn"),
    session_id: sessionId,
    kind: request.kind,
    provider: "local-preview",
    model: request.model,
    prompt: request.prompt,
    settings_json: JSON.stringify(request.settings),
    reference_asset_ids_json: JSON.stringify(request.reference_asset_ids),
    output_asset_ids_json: "[]",
    frank_body_mode: request.frank_body_mode,
    preset_key: request.preset_key,
    status: "blocked",
    error_json: JSON.stringify({ code: "offline" }),
    sync_status: "local",
    created_at: now,
    updated_at: now
  };
}
