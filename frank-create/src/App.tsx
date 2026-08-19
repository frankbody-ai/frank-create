import {
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
  Badge,
  Banner,
  Button,
  Icon,
  PageHeader,
  Pagination,

  Spinner,
} from "./ds";
import { Shell } from "./Shell";
import { modeFromUrl, navigate } from "./nav";
import type { InAppScreen, Screen } from "./nav";

import {
  createInferenceTurn,
  fetchTurnStatus,
  createReference,
  createSession,
  createVideoStoryboard,
  deleteAsset,
  deleteTurn,
  fetchConfig,
  fetchHealth,
  listAssets,
  listSessions,
  listTurns,
  updateSession
} from "./lib/api";

import { fallbackBrandKit, fallbackConfig } from "./lib/presets";
import { supabase, hardSignOut } from "./lib/supabaseClient";
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
} from "./lib/studio";
import type { StudioFieldErrors } from "./lib/studio";

import { StudioRail } from "./components/StudioRail";


import { PromptGenerator } from "./components/PromptGenerator";
import Enhancer from "./components/Enhancer";

import type {
  Asset,
  FrankConfig,
  FrankTask,
  StudioModel,
  StudioSession,
  StudioSettings,
  StudioTurn
} from "./lib/types";
import { loadLocalAssets, saveLocalAssets } from "./lib/localAssets";
import { SessionFolders } from "./components/SessionFolders";
import { clampWords } from "./lib/clampWords";



// Official AutoSolutions OS tenant ambient ramps. Each theme re-tints the shell
// gradient, the blurred blob and the accent from one brand colour.
/** Tiles painted per page in the Add references overlay, upload tile included. */
import {
  AssetPreviewMedia,
  CompareDialog,
  MaskPainterDialog,
  OutputStrip,
  ReferencePickerCard,
  SessionCancelDialog
} from "./studio/StudioPieces";
import {
  chooseLaunchSession,
  composeVideoReferencePrompt,
  fileToDataUrl,
  firstReviewableAsset,
  formatAspectChip,
  formatProviderPayload,
  makeLocalSession,
  makeLocalTurn,
  mergeConfig,
  modelMissingKeyAction,
  modelName,
  modelReferenceLimitAction,
  parseReadyStatusLink,
  preferredStudioModel,
  promptForTask,
  readLastUsedModelId,
  referenceCountLabel,
  referenceUrlForGeneration,
  safeFileStem,
  settingsForTask,
  taskShortcutIcon,
  turnAspect,
  turnEmptyLabel,
  turnErrorCopy,
  turnExpectedCount,
  turnKindLabel,
  writeLastUsedModelId
} from "./studio/studioFormat";

const REFERENCE_PICKER_PAGE_SIZE = 9;



export default function App() {

  const [config, setConfig] = useState<FrankConfig>(fallbackConfig);
  const [connection, setConnection] = useState<"checking" | "online" | "offline">("checking");
  const [sessions, setSessions] = useState<StudioSession[]>([]);
  const [activeSession, setActiveSession] = useState<StudioSession | null>(null);
  const [turns, setTurns] = useState<StudioTurn[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [prompt, setPrompt] = useState("");
  const [selectedModelId, setSelectedModelId] = useState(
    () => preferredStudioModel(fallbackConfig.models, readLastUsedModelId()).id
  );
  const [expandedPromptTurnIds, setExpandedPromptTurnIds] = useState<string[]>([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(null);
  const [attachedPresetSnapshot, setAttachedPresetSnapshot] = useState<string | null>(null);
  const [frankBodyMode, setFrankBodyMode] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  const [studioMode, setStudioMode] = useState<InAppScreen>(() => modeFromUrl());
  useEffect(() => {
    document.body.dataset.feedbackView = studioMode;
    return () => {
      delete document.body.dataset.feedbackView;
    };
  }, [studioMode]);
  const [settings, setSettings] = useState<StudioSettings>(defaultStudioSettings(fallbackConfig.models[0]));
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [lightboxAsset, setLightboxAsset] = useState<Asset | null>(null);
  // Inline "edit this image" composer inside the lightbox (ChatGPT-style).
  const [lightboxEditText, setLightboxEditText] = useState("");
  const [lightboxEditBusy, setLightboxEditBusy] = useState(false);
  const [referencePreviewAsset, setReferencePreviewAsset] = useState<Asset | null>(null);
  const [referenceDropActive, setReferenceDropActive] = useState(false);
  const [referencePickerOpen, setReferencePickerOpen] = useState(false);
  // The picker fills either the prompt reference dock or the upscaler's source slot.
  const [referencePickerTarget, setReferencePickerTarget] = useState<"dock" | "upscaler">("dock");
  const [upscalerSource, setUpscalerSource] = useState<Asset | null>(null);
  // Turn whose provider request body is being inspected via the JSON chip.
  const [payloadTurnId, setPayloadTurnId] = useState<string | null>(null);

  const [referenceLibrary, setReferenceLibrary] = useState<Asset[]>([]);
  const [referencePickerSelection, setReferencePickerSelection] = useState<string[]>([]);
  const [referencePickerBusy, setReferencePickerBusy] = useState(false);
  const [referencePickerNote, setReferencePickerNote] = useState<string | null>(null);
  const [referenceLibraryLoading, setReferenceLibraryLoading] = useState(false);
  // True once bootstrap settled, so empty-state tiles never flash before turns load.
  const [studioBooted, setStudioBooted] = useState(false);
  // The picker paints 10 cards at a time so the overlay opens instantly even
  // when the library holds hundreds of approved picks and uploads.
  const [referencePickerPage, setReferencePickerPage] = useState(0);



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
  const [mentionState, setMentionState] = useState<{ start: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const [compareBaseAsset, setCompareBaseAsset] = useState<Asset | null>(null);
  const [compareTargetAsset, setCompareTargetAsset] = useState<Asset | null>(null);
  const [editSourceAsset, setEditSourceAsset] = useState<Asset | null>(null);
  const [maskAsset, setMaskAsset] = useState<Asset | null>(null);
  const [maskPainterAsset, setMaskPainterAsset] = useState<Asset | null>(null);
  const [sessionCancelTarget, setSessionCancelTarget] = useState<StudioSession | null>(null);
  // Explicit composer-only attachments. Historical reference assets remain
  // saved for run provenance but are never hydrated into a new run.
  const [activeReferenceIds, setActiveReferenceIds] = useState<string[]>([]);

  const [maskPainterBusy, setMaskPainterBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  // `compareGroup` ties the two sides of a side-by-side run together so the
  // timeline shows one loading round with two slots, not two separate rounds.
  type InflightGen = { id: string; modelId: string; modelLabel: string; prompt: string; aspect: string; count: number; startedAt: number; compareGroup?: string };

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

  // Always-fresh view of the pending cards for interval/event callbacks.
  const inflightRef = useRef<InflightGen[]>([]);
  useEffect(() => { inflightRef.current = inflightGens; }, [inflightGens]);

  // Ticks once a second while something is pending so the card can show elapsed time.
  const [pendingTick, setPendingTick] = useState(Date.now());
  useEffect(() => {
    if (!inflightGens.length) return;
    setPendingTick(Date.now());
    const iv = window.setInterval(() => setPendingTick(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [inflightGens.length]);

  // Watchdog: a dropped connection or a provider that never answers used to leave
  // the pending card spinning forever. After RUN_TIMEOUT_MS we re-check the server
  // first (the round may well have landed), then abort and surface a retryable error.
  const RUN_TIMEOUT_MS = 12 * 60 * 1000;
  useEffect(() => {
    if (!inflightGens.length) return;
    let disposed = false;
    const timer = window.setInterval(() => {
      const cutoff = Date.now() - RUN_TIMEOUT_MS;
      if (!inflightRef.current.some((g) => g.startedAt <= cutoff)) return;
      void (async () => {
        // Never fail a run that actually finished server-side.
        await settleFinishedRunsFromServer();
        if (disposed) return;
        const stale = inflightRef.current.filter((g) => g.startedAt <= cutoff);
        if (!stale.length) return;
        try { generateAbortRef.current?.abort(); } catch { /* already settled */ }
        try { videoAbortRef.current?.abort(); } catch { /* already settled */ }
        setGenError({
          message: `${stale.length === 1 ? "That run" : `${stale.length} runs`} never came back after 12 minutes, so we stopped waiting. Nothing was charged twice — hit Generate again.`,
          code: "client_timeout",
          retryable: true,
        });
        setGenErrorOpen(true);
        const staleIds = new Set(stale.map((g) => g.id));
        setInflightGens((current) => {
          const remaining = current.filter((g) => !staleIds.has(g.id));
          if (!remaining.length) {
            setBusy(false);
            setGenPhase("idle");
            setStatusText("Run timed out. Ready when you are.");
          }
          return remaining;
        });
      })();
    }, 15000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [inflightGens.length]);

  // Set by "Switch model and retry": once the picker has re-rendered on the new
  // model, the effect below fires the generation with the fresh selection.
  const [autoRetryModelId, setAutoRetryModelId] = useState<string | null>(null);
  const [retryRunToken, setRetryRunToken] = useState(0);

  const [settingsRailOpen, setSettingsRailOpen] = useState(true);

  const [mediaKind, setMediaKind] = useState<"image" | "video" | "compare">("image");

  // Video generation is off for everyone until an admin grants it.
  const [videoAllowed, setVideoAllowed] = useState(false);
  useEffect(() => {
    let live = true;
    import("./lib/admin").then(({ getMyVideoAccess }) => {
      getMyVideoAccess()
        .then((allowed) => { if (live) setVideoAllowed(allowed); })
        .catch(() => { /* denied by default */ });
    });
    return () => { live = false; };
  }, [userEmail]);


  const [compareMedia, setCompareMedia] = useState<"image" | "video">("image");
  const [compareModelBId, setCompareModelBId] = useState<string>("");
  const [compareApproved, setCompareApproved] = useState(false);

  useEffect(() => {
    if (videoAllowed) return;
    setMediaKind((current) => (current === "video" ? "image" : current));
    setCompareMedia((current) => (current === "video" ? "image" : current));
  }, [videoAllowed]);



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

      setLightboxAsset(null);
    }


    window.addEventListener("keydown", handleDrawerKeyDown);
    return () => window.removeEventListener("keydown", handleDrawerKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(attempt = 1) {
      try {
        // The health probe is diagnostics only — a transient 503 from a cycling
        // edge container must not knock the whole studio into offline mode.
        await fetchHealth().catch(() => null);

        const freshConfig = mergeConfig(await fetchConfig());
        const sessionResult = await listSessions();
        let nextSession = chooseLaunchSession(sessionResult.sessions);
        let nextSessions = sessionResult.sessions;

        if (!nextSession) {
          const created = await createSession({ name: "Launch Image Studio", mode: "image" });
          nextSession = created.session;
          nextSessions = [created.session];
        }

        const [turnResult, assetResult] = await Promise.all([
          listTurns(nextSession.id),
          listAssets({ sessionId: nextSession.id })
        ]);

        if (cancelled) {
          return;
        }

        setConfig(freshConfig);
        setSelectedModelId(preferredStudioModel(freshConfig.models, readLastUsedModelId()).id);
        setSessions(nextSessions);
        setActiveSession(nextSession);
        setActiveReferenceIds([]);
        setTurns(turnResult.turns);
        setAssets(assetResult.assets);
        setSelectedAsset(firstReviewableAsset(assetResult.assets));

        setConnection("online");
        setStatusText("Studio is connected.");
        setStudioBooted(true);
      } catch {
        if (cancelled) {
          return;
        }
        // Ride out transient backend degradation before falling back to local mode.
        if (attempt < 5) {
          setStatusText("Backend is warming up — retrying…");
          await new Promise((r) => setTimeout(r, attempt * 1500));
          if (!cancelled) await bootstrap(attempt + 1);
          return;
        }
        const localSession = makeLocalSession();
        setSessions([localSession]);
      setActiveSession(localSession);
      setConnection("offline");
      const persisted = loadLocalAssets();
      if (persisted.length) {
        setAssets(persisted);
        setSelectedAsset(firstReviewableAsset(persisted));
      }
        setStatusText("Preview backend offline — reconnecting in the background.");
        setStudioBooted(true);
        // Keep trying: a degraded edge container usually recovers within a
        // minute, and we want the studio to come back online on its own.
        retryTimer = window.setTimeout(() => {
          if (!cancelled) void bootstrap(1);
        }, 15_000);
      }
    }

    let retryTimer = 0;
    bootstrap();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, []);


  useEffect(() => {
    if (connection !== "offline") return;
    saveLocalAssets(assets);
  }, [assets, connection]);



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
  // Round-level retry: retryTurn refills prompt/model/settings/references, then
  // bumps this token so the run fires on the committed state, not a stale closure.
  useEffect(() => {
    if (!retryRunToken) return;
    void handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryRunToken]);

  const modelOptions = useMemo(() => selectModelOptions(config.models, selectedModelId), [config.models, selectedModelId]);
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
    // A model the user picked before for this media kind wins over any default.
    const remembered = readLastUsedModelId(kind);
    const restored = remembered ? pool.find((model) => model.id === remembered) : null;
    return restored ?? pool.find((model) => model.status === "ready" && !model.degraded) ?? pool[0] ?? null;
  }

  function selectModel(id: string) {
    setSelectedModelId(id);
    const model = config.models.find((item) => item.id === id);
    writeLastUsedModelId(id, model ? (isVideoModel(model) ? "video" : "image") : undefined);
  }

  function switchMediaKind(kind: "image" | "video" | "compare") {
    if (kind === "video" && !videoAllowed) {
      setStatusText("Video generation is off for your account. Ask an admin to switch it on.");
      return;
    }
    setMediaKind(kind);
    setCompareApproved(false);
    const media = kind === "compare" ? compareMedia : kind;

    const next = pickModelForMedia(media);
    if (next && next.id !== selectedModelId) selectModel(next.id);
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
    if (media === "video" && !videoAllowed) {
      setStatusText("Video generation is off for your account. Ask an admin to switch it on.");
      return;
    }
    setCompareMedia(media);
    setCompareApproved(false);

    const primary = pickModelForMedia(media);
    if (primary && primary.id !== selectedModelId) selectModel(primary.id);
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

  const promptPresets = useMemo(() => config.promptPresets, [config.promptPresets]);
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

  // Run an edit round straight from the full-screen preview. The lightbox stays
  // open and jumps to the first new pick, so edits can be chained.
  async function submitLightboxEdit() {
    const asset = lightboxAsset;
    const text = lightboxEditText.trim();
    if (!asset || !text || lightboxEditBusy) return;
    if (!selectedModel?.capabilities.edit) {
      setStatusText(
        `${selectedModel?.short_label ?? selectedModel?.label ?? "This model"} cannot edit images yet — pick an edit-capable model.`
      );
      return;
    }
    setLightboxEditBusy(true);
    try {
      const created = await handleGenerate(undefined, { prompt: text, editSourceAsset: asset });
      if (created?.length) {
        setLightboxEditText("");
        setLightboxAsset(created[0]);
      }
    } finally {
      setLightboxEditBusy(false);
    }
  }




  useEffect(() => {
    if (!selectedModel) {
      return;
    }

    setSettings((current) => normalizeStudioSettingsForModel(current, selectedModel));
    if (!selectedModel.capabilities.masked_edit) {
      setMaskAsset(null);
    }
  }, [selectedModel]);

  // Dock order (activeReferenceIds) drives @refN tags and video frame order.
  const referenceAssets = activeReferenceIds
    .map((id) => assets.find((asset) => asset.id === id && asset.kind === "reference"))
    .filter((asset): asset is Asset => Boolean(asset));

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

  // Frames are derived from the reference dock: ref #1 is the first frame and,
  // when the model accepts an end frame, ref #2 is the last frame.
  const videoFirstFrame = referenceAssets[0] ?? null;
  const videoLastFrame = referenceAssets[1] ?? null;

  function clearReferenceDock() {
    setActiveReferenceIds([]);
    setReferencePreviewAsset(null);
  }

  function swapFrameOrder() {
    setActiveReferenceIds((current) => {
      if (current.length < 2) return current;
      const next = [...current];
      const [a, b] = [next[0], next[1]];
      next[0] = b;
      next[1] = a;
      return next;
    });
    setStatusText("Swapped the start and end frames.");
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
  const displayOutputAssets = outputAssets;
  // Picks from the same run, so the preview can step left/right through a round.
  const lightboxSiblings = lightboxAsset
    ? (() => {
        const group = outputAssets.filter((asset) => asset.turn_id && asset.turn_id === lightboxAsset.turn_id);
        return group.length ? group : [lightboxAsset];
      })()
    : [];
  const lightboxIndex = lightboxAsset ? lightboxSiblings.findIndex((asset) => asset.id === lightboxAsset.id) : -1;
  function stepLightbox(delta: number) {
    if (lightboxIndex < 0 || lightboxSiblings.length < 2) return;
    const next = (lightboxIndex + delta + lightboxSiblings.length) % lightboxSiblings.length;
    setLightboxAsset(lightboxSiblings[next] ?? null);
  }

  useEffect(() => {
    if (!lightboxAsset) setLightboxEditText("");
  }, [lightboxAsset]);


  useEffect(() => {
    if (!lightboxAsset) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxAsset(null);
      // Arrow keys stay with the inline edit field while it has focus.
      const target = event.target as HTMLElement | null;
      const typing = !!target && /^(input|textarea)$/i.test(target.tagName);
      if (typing) return;
      if (event.key === "ArrowRight") stepLightbox(1);
      if (event.key === "ArrowLeft") stepLightbox(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxAsset, lightboxSiblings.length, lightboxIndex]);




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


  function showImageStudio() {
    setStudioMode("studio");
    setSettingsRailOpen(true);
    setStatusText("Studio is open.");
  }


  function showEnhancer() {
    setStudioMode("upscaler");
    setSettingsRailOpen(false);
    setStatusText("Enhancer is open.");
  }

  function showPromptGenerator() {
    setStudioMode("prompt");
    setSettingsRailOpen(false);
    setStatusText("Prompt Generator is open.");
  }




  async function handleNewSession() {
    const nextMode = mediaKind === "video" ? "video" : "image";
    const sessionName = nextMode === "video" ? "New video session" : "New image session";
    const sessionPayload = { name: sessionName, mode: nextMode };

    if (connection === "online") {
      const created = await createSession(sessionPayload);
      setSessions((current) => [created.session, ...current]);
      setActiveSession(created.session);
      setActiveReferenceIds([]);
      setTurns([]);
      setAssets([]);
      setSelectedAsset(null);
      setPrompt("");
      clearEditSource();
      clearCompare();
      setStatusText("New session. Fresh canvas.");
      return;
    }

    const localSession = { ...makeLocalSession(), ...sessionPayload };
    setSessions((current) => [localSession, ...current]);
    setActiveSession(localSession);
    setActiveReferenceIds([]);
    setTurns([]);
    setAssets([]);
    setSelectedAsset(null);
    setPrompt("");
    clearEditSource();
    clearCompare();
    setStatusText("Local preview session ready.");
  }

  async function selectSession(session: StudioSession) {
    setActiveSession(session);
    setActiveReferenceIds([]);
    setReferencePreviewAsset(null);
    setSelectedAsset(null);
    clearEditSource();
    clearCompare();

    if (connection !== "online") {
      return;
    }

    const [turnResult, assetResult] = await Promise.all([
      listTurns(session.id),
      listAssets({ sessionId: session.id })
    ]);
    setTurns(turnResult.turns);
    setAssets(assetResult.assets);
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




  function inspectAsset(asset: Asset) {

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


  function clearCompare() {
    setCompareBaseAsset(null);
    setCompareTargetAsset(null);
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

  const mentionOptions = (() => {
    const options = taggedReferences(referenceAssets).map((ref) => {
      const asset = referenceAssets[Number(ref.tag.replace(/\D/g, "")) - 1];
      return { tag: ref.tag, title: ref.title, preview: asset?.preview_url ?? null };
    });
    if (videoFirstFrame)
      options.push({ tag: "@first", title: videoFirstFrame.title, preview: videoFirstFrame.preview_url ?? null });
    if (videoLastFrame)
      options.push({ tag: "@last", title: videoLastFrame.title, preview: videoLastFrame.preview_url ?? null });
    return options;
  })();

  const mentionSuggestions = mentionState
    ? mentionOptions.filter((option) => {
        const q = mentionState.query.toLowerCase();
        if (!q) return true;
        return option.tag.slice(1).toLowerCase().startsWith(q) || option.title.toLowerCase().includes(q);
      })
    : [];
  const mentionOpen = Boolean(mentionState) && (mentionSuggestions.length > 0 || mentionOptions.length === 0);
  const activeMention = mentionOpen ? mentionSuggestions[Math.min(mentionIndex, mentionSuggestions.length - 1)] : undefined;

  function detectMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const match = /(?:^|\s)@([A-Za-z0-9_]*)$/.exec(before);
    if (!match) return null;
    const query = match[1] ?? "";
    return { start: caret - query.length - 1, query };
  }

  function syncMention(value: string, caret: number | null) {
    const next = caret == null ? null : detectMention(value, caret);
    setMentionState(next);
    setMentionIndex(0);
  }

  function closeMention() {
    setMentionState(null);
    setMentionIndex(0);
  }

  function applyMention(tag: string) {
    if (!mentionState) {
      insertReferenceTag(tag);
      return;
    }
    const el = promptInputRef.current;
    const caret = el ? (el.selectionStart ?? prompt.length) : prompt.length;
    const before = prompt.slice(0, mentionState.start);
    const after = prompt.slice(caret);
    const insert = `${tag}${after.startsWith(" ") ? "" : " "}`;
    const nextCaret = before.length + insert.length;
    setPrompt(`${before}${insert}${after}`);
    closeMention();
    setHoveredReferenceTag(null);
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


  const referencePickerLimit =
    referencePickerTarget === "upscaler" ? 1 : Math.min(10, modelOptions.referenceLimit || 10);
  const referencePickerRangeStart = referenceLibrary.length
    ? referencePickerPage * REFERENCE_PICKER_PAGE_SIZE + 1
    : 0;
  const referencePickerRangeEnd = Math.min(
    referenceLibrary.length,
    (referencePickerPage + 1) * REFERENCE_PICKER_PAGE_SIZE
  );
  const referencePickerPageItems = referenceLibrary.slice(
    referencePickerPage * REFERENCE_PICKER_PAGE_SIZE,
    referencePickerRangeEnd
  );


  async function openReferencePicker(target: "dock" | "upscaler" = "dock") {
    setReferencePickerTarget(target);
    setReferencePickerOpen(true);
    setReferencePickerSelection([]);
    setReferencePickerPage(0);
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
    // Single-pick mode for the upscaler: tapping a tile swaps the selection.
    if (referencePickerTarget === "upscaler") {
      setReferencePickerSelection((current) => (current[0] === asset.id ? [] : [asset.id]));
      return;
    }
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
    if (referencePickerTarget === "upscaler") {
      setUpscalerSource(picks[0]);
      setReferencePickerSelection([]);
      setReferencePickerOpen(false);
      setStatusText(`${picks[0].title || "Source"} is ready to upscale.`);
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


  /** Files dropped straight onto the picker's upload tile from Finder. */
  async function handlePickerFiles(files: File[]) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;
    setReferencePickerBusy(true);
    setReferencePickerNote(null);
    try {
      const created = await addReferenceFiles(images, { attach: false });
      if (created?.length) {
        setReferenceLibrary((current) => [...created, ...current]);
        setReferencePickerPage(0);
        setReferencePickerSelection((current) =>
          Array.from(new Set([...current, ...created.map((asset) => asset.id)])).slice(0, referencePickerLimit)
        );
      }
    } finally {
      setReferencePickerBusy(false);
    }
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

  /**
   * Prompt Generator handoff: the reference images used in that conversation
   * (data URLs) become real session references attached to the next run, so the
   * prompt and its visual context arrive in Studio together.
   */
  async function adoptPromptGeneratorReferences(images: string[]) {
    if (!images.length) {
      setStatusText("Prompt loaded into the Studio composer.");
      return;
    }
    if (!activeSession) {
      setStatusText("Prompt loaded. Start a session to carry the reference images over.");
      return;
    }
    const limit = modelOptions.referenceLimit || images.length;
    const picked = images.slice(0, limit);
    setStatusText("Loading prompt and references into the Studio composer...");
    const files: File[] = [];
    for (const [index, src] of picked.entries()) {
      try {
        const blob = await (await fetch(src)).blob();
        const ext = (blob.type.split("/")[1] || "png").split("+")[0];
        files.push(new File([blob], `prompt-ref-${index + 1}.${ext}`, { type: blob.type || "image/png" }));
      } catch (err) {
        console.error("[frank] could not convert prompt reference", err);
      }
    }
    if (!files.length) {
      setStatusText("Prompt loaded, but the reference images could not be transferred.");
      return;
    }
    const created = await addReferenceFiles(files, { attach: true });
    const modelLabel = modelOptions.model?.short_label ?? modelOptions.model?.label ?? "This model";
    if (!created.length) {
      setStatusText("Prompt loaded, but the reference images could not be uploaded.");
    } else if (picked.length < images.length) {
      setStatusText(
        `Prompt loaded with ${created.length} of ${images.length} references — ${modelLabel} accepts ${limit}.`
      );
    } else if (created.length < files.length) {
      setStatusText(
        `Prompt loaded with ${created.length} of ${files.length} references — ${files.length - created.length} failed to upload.`
      );
    } else {
      setStatusText(
        `Prompt loaded with ${created.length} reference${created.length === 1 ? "" : "s"} from the Prompt Generator.`
      );
    }
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
      // The upscaler owns paste on its own screen (pasted file becomes the source).
      if (studioMode === "upscaler") return;
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
  }, [activeSession?.id, modelOptions.referenceLimit, connection, studioMode]);


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





  async function handleGenerate(
    event?: FormEvent,
    override?: { prompt?: string; editSourceAsset?: Asset }
  ): Promise<Asset[] | null> {
    event?.preventDefault();
    const promptText = override?.prompt ?? prompt;
    const editSource = override?.editSourceAsset ?? editSourceAsset;
    const activePromptMode: typeof promptMode = editSource
      ? (!override && maskAsset ? "masked_edit" : "edit")
      : "generate";
    if (!activeSession || !selectedModel || !promptText.trim()) {
      setStatusText("Give the studio a prompt first.");
      return null;
    }

    if (!override && mediaKind === "compare") {
      await handleCompareGenerate();
      return null;
    }

    if (!override && (mediaKind === "video" || isVideoModel(selectedModel))) {
      await handleVideoGenerate();
      return null;
    }


    if (activePromptMode === "edit" && !selectedModel.capabilities.edit) {
      setStatusText(`${selectedModel.short_label ?? selectedModel.label} cannot edit images yet.`);
      return null;
    }

    if (activePromptMode === "masked_edit" && !selectedModel.capabilities.masked_edit) {
      setStatusText(`${selectedModel.short_label ?? selectedModel.label} cannot use masks yet.`);
      return null;
    }

    const referenceLimitMessage = modelReferenceLimitAction(selectedModel, selectedReferenceAssets.length);
    if (referenceLimitMessage) {
      setStatusText(referenceLimitMessage);
      return null;
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
      return null;
    }

    const referencePairs = selectedReferenceAssets
      .map((asset) => ({ asset, url: referenceUrlForGeneration(asset) }))
      .filter((pair): pair is { asset: Asset; url: string } =>
        typeof pair.url === "string" && /^https?:\/\//.test(pair.url));
    const generationReferenceUrls = referencePairs.map((pair) => pair.url);
    const generationReferenceAssets = referencePairs.map((pair) => pair.asset);
    const unknownTags = unknownReferenceTags(promptText, generationReferenceAssets.length);
    if (unknownTags.length) {
      setStatusText(`${unknownTags.join(", ")} ${unknownTags.length === 1 ? "does" : "do"} not match a loaded reference. Remove the tag or add the image.`);
      return null;
    }
    const providerPrompt = composeReferencePrompt(promptText, generationReferenceAssets);
    if (selectedReferenceAssets.length && !generationReferenceUrls.length) {
      setStatusText("Reference images are still uploading. Try again in a moment.");
      return null;
    }

    setBusy(true);
    setGenPhase("queued");
    setGenError(null);
    setGenErrorOpen(false);
    setStatusText(activePromptMode === "generate" ? "Preparing the next round..." : "Preparing the edit brief...");
    const inflightId = makeLocalId("gen");
    const inflightEntry: InflightGen = {
      id: inflightId,
      modelId: selectedModel.id,
      modelLabel: modelName(config, selectedModel.id),
      prompt: promptText,
      aspect: settings.aspect_ratio,
      count: Math.max(1, settings.count),
      startedAt: Date.now(),
    };
    setInflightGens((current) => [...current, inflightEntry]);
    const finishInflight = () => setInflightGens((current) => current.filter((g) => g.id !== inflightId));


    const request = buildTurnRequest({
      sessionId: activeSession.id,
      modelId: selectedModel.id,
      prompt: promptText,
      promptMode: activePromptMode,
      frankBodyMode,
      presetKey: selectedPresetKey ?? undefined,
      settings,
      referenceAssetIds: selectedReferenceAssets.map((asset) => asset.id),
      referenceImageUrls: generationReferenceUrls,
      providerPrompt,
      editSourceAssetId: editSource?.id,
      maskAssetId: activePromptMode === "masked_edit" ? maskAsset?.id : undefined
    });

    // The request owns the snapshot above. Empty the visible dock and the
    // composer immediately, before waiting for the provider, so the next run
    // always starts clean.
    clearReferenceDock();
    if (!override) setPrompt("");

    if (connection !== "online") {
      // Auto-name the session from the first prompt if it still has the default name.
      if (activeSession && (!activeSession.name || /^(new session|launch image studio|untitled)/i.test(activeSession.name)) && turns.length === 0) {
        const autoName = promptText.trim().replace(/\s+/g, " ").slice(0, 40) || activeSession.name;
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
      let producedAssets: Asset[] | null = null;
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
        producedAssets = newAssets;
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

      return producedAssets;
    }

    const missingKeyMessage = modelMissingKeyAction(selectedModel);
    if (missingKeyMessage) {
      setStatusText(missingKeyMessage);
      return null;
    }

    let onlineAssets: Asset[] | null = null;
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
          onlineAssets = result.assets;
          if (activePromptMode !== "generate" && !override) {
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
    return onlineAssets;
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
    if (connection !== "online" || !activeSession) return null;
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
      return { turns: turnResult.turns, assets: assetResult.assets };
    } catch {
      /* reconcile is best-effort */
      return null;
    }
  }

  // The provider work is persisted server-side before the HTTP call returns, so a
  // dropped/timed-out response used to leave the pending card spinning even though
  // the round had finished. Re-read the session and settle any local pending card
  // whose round already landed. Returns the number of cards settled.
  async function settleFinishedRunsFromServer() {
    const snapshot = await reconcileSessionAssets();
    if (!snapshot) return 0;

    const pending = inflightRef.current;
    if (!pending.length) return 0;

    const claimed = new Set<string>();
    const settledIds: string[] = [];
    let newestAsset: Asset | undefined;

    for (const gen of pending) {
      const match = snapshot.turns.find((turn) => {
        if (claimed.has(turn.id)) return false;
        if (turn.status === "queued" || turn.status === "running") return false;
        if (turn.model !== gen.modelId) return false;
        // Allow a little clock skew between the browser and the backend.
        if (new Date(turn.created_at).getTime() < gen.startedAt - 15000) return false;
        const done =
          turn.status === "failed" ||
          turn.status === "blocked" ||
          snapshot.assets.some((asset) => asset.turn_id === turn.id);
        return done;
      });
      if (!match) continue;
      claimed.add(match.id);
      settledIds.push(gen.id);
      const asset = snapshot.assets.find((item) => item.turn_id === match.id);
      if (asset && !newestAsset) newestAsset = asset;
    }

    if (!settledIds.length) return 0;

    const settled = new Set(settledIds);
    setInflightGens((current) => {
      const remaining = current.filter((gen) => !settled.has(gen.id));
      if (!remaining.length) {
        setBusy(false);
        setGenPhase("completed");
        setStatusText(
          newestAsset
            ? "Round landed while you were waiting — picks are ready."
            : "Round closed out on the server.",
        );
      }
      return remaining;
    });
    if (newestAsset) setSelectedAsset(newestAsset);
    return settledIds.length;
  }

  // Live reconcile: while anything is pending locally or a round is queued/running
  // on the backend, keep re-reading our own database so finished work appears
  // without a manual refresh. Idle sessions poll nothing.
  const hasLiveTurn = turns.some((turn) => turn.status === "queued" || turn.status === "running");
  const shouldPollSession = (inflightGens.length > 0 || hasLiveTurn) && connection === "online";
  useEffect(() => {
    if (!shouldPollSession) return;
    let disposed = false;
    const startedAt = Date.now();
    let timer = 0;
    const tick = async () => {
      if (disposed) return;
      await settleFinishedRunsFromServer();
      if (disposed) return;
      const elapsed = Date.now() - startedAt;
      timer = window.setTimeout(tick, elapsed > 60000 ? 10000 : 5000);
    };
    timer = window.setTimeout(tick, 5000);
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [shouldPollSession, activeSession?.id]);

  // Coming back to a backgrounded tab shows finished work straight away.
  useEffect(() => {
    if (!shouldPollSession) return;
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      void settleFinishedRunsFromServer();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [shouldPollSession, activeSession?.id]);





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

    // Frames come from the reference dock: ref #1 starts the clip, ref #2 ends it.
    const sourceAsset = videoFirstFrame ?? undefined;
    const lastFrameAsset = videoModel?.supports_last_frame && sourceAsset ? (videoLastFrame ?? undefined) : undefined;

    if (videoModel?.requires_source_image && !sourceAsset) {
      setStatusText(`${videoModel.short_label ?? videoModel.label} only runs image-to-video — attach a reference image first.`);
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
    setPrompt("");

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
        startedAt: Date.now(),
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
      startedAt: Date.now(),
      compareGroup: groupId,
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
    setPrompt("");

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
      
      setAttachedPresetSnapshot(null);
      if (turn.model) setSelectedModelId(turn.model);
      if (turn.preset_key) setSelectedPresetKey(turn.preset_key); else setSelectedPresetKey(null);
      setFrankBodyMode(!!turn.frank_body_mode);
      // Restore the exact reference dock this round ran with, in the same order,
      // so @refN tags and video frame order stay identical.
      const refIds = parseJsonList(turn.reference_asset_ids_json).filter((id) =>
        assets.some((asset) => asset.id === id && asset.kind === "reference"),
      );
      if (refIds.length) setActiveReferenceIds(refIds);
      setSettings((current) => ({
        ...current,
        ...parsed,
        ...(typeof overrideCount === "number" ? { count: Math.max(1, Math.min(maxCountForModel(config.models.find((m) => m.id === turn.model) ?? selectedModel), overrideCount)) } : {}),
      }));
      setStatusText(typeof overrideCount === "number" ? `Retrying ${overrideCount} missing…` : "Retrying with previous settings…");
      setRetryRunToken((token) => token + 1);
    } catch (err) {
      setStatusText(err instanceof Error ? err.message : "Could not retry this round.");
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




  function selectTaskShortcut(task: FrankTask) {
    const taskPrompt = promptForTask(task);
    setSelectedPresetKey(task.key);
    setAttachedPresetSnapshot(null);
    setStudioMode("studio");
    setPrompt((current) => (current.trim() ? `${current.trim()}\n\n${taskPrompt}` : taskPrompt));
    setSettings((current) => settingsForTask(task.key, current, selectedModel));
    setStatusText(`${task.label} is loaded.`);
  }



  /** Nav clicks: the in-shell screens are a mode change, the rest are routes. */
  function goToScreen(screen: Screen) {
    
    switch (screen) {
      case "studio": return showImageStudio();
      case "prompt": return showPromptGenerator();
      case "upscaler": return showEnhancer();
      default: return navigate(screen);
    }
  }

  function renameSession(session: StudioSession) {
    const next = window.prompt("Rename session", session.name);
    if (!next) return;
    const trimmed = next.trim().slice(0, 80);
    if (!trimmed || trimmed === session.name) return;
    const optimistic = { ...session, name: trimmed };
    if (activeSession?.id === session.id) setActiveSession(optimistic);
    setSessions((current) => current.map((s) => (s.id === session.id ? optimistic : s)));
    void updateSession(session.id, { name: trimmed })
      .then((result) => {
        if (!result?.session) return;
        if (activeSession?.id === result.session.id) setActiveSession(result.session);
        setSessions((current) => current.map((s) => (s.id === result.session.id ? result.session : s)));
      })
      .catch((error) => { console.error("Failed to rename session", error); });
  }

  function confirmArchiveSession(session: StudioSession) {
    // Names the consequence rather than asking "are you sure".
    const ok = window.confirm(
      `Archive "${session.name}"? Its rounds stay in the audit trail, but it leaves your session list.`
    );
    if (ok) void archiveSession(session);
  }

  const statusReadyLink = parseReadyStatusLink(statusText);

  return (
    <Shell
      screen={studioMode}
      onSelectInApp={goToScreen}
      navExtra={
        <SessionFolders
          sessions={sessions}
          activeSessionId={activeSession?.id ?? null}
          onSelect={(session) => {
            if (session.id === activeSession?.id) return;
            void selectSession(session);
          }}
          onRename={renameSession}
          onArchive={confirmArchiveSession}
          onNew={() => void handleNewSession()}
        />
      }
      search={roundSearch}
      onSearchChange={setRoundSearch}
      searchPlaceholder="Search sessions and picks"
      maxWidth="var(--page-max-width-wide)"
    >
      {desktopNotice ? (
        <Banner tone="warning" title="Desktop only" onDismiss={() => setDesktopNotice(null)}>
          <span>{desktopNotice}</span>
        </Banner>
      ) : null}

      {videoStartedAt != null ? (
        <div className="run-toast" role="status">
          <Spinner size="small" />
          <span className="run-toast__label">Generating video</span>
          <span className="run-toast__meta as-tabular">
            {Math.max(0, Math.floor((videoNowTick - videoStartedAt) / 1000))}s elapsed
          </span>
          <Button size="micro" onClick={() => videoAbortRef.current?.abort()}>
            Cancel run
          </Button>
        </div>
      ) : null}

      {studioMode === "upscaler" ? (
        <Enhancer
          models={config.models}
          sessionId={activeSession?.id ?? null}
          connection={connection}
          source={upscalerSource}
          onPickSource={() => void openReferencePicker("upscaler")}
          onSourceChange={setUpscalerSource}
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

      ) : studioMode === "prompt" ? (
        <PromptGenerator
          onStatus={setStatusText}
          onUsePrompt={(value, images) => {
            setPrompt(value);
            showImageStudio();
            void adoptPromptGeneratorReferences(images ?? []);
          }}
        />
      ) : (

      <>
        <PageHeader
          title="Studio"
          subtitle="Brief the shot in plain English. References and settings are optional."
          badge={activeSession ? <Badge tone="neutral">{activeSession.name}</Badge> : null}
        />

        {/* The session metric strip was removed on purpose — the studio starts here. */}


        <div className="studio-columns">
          <div className="studio-main">
            <form
                className="composer"
                onSubmit={handleGenerate}
              >
                <div className="brief-card-head" aria-hidden="true">
                  <span className="brief-card-eyebrow">Brief</span>
                  <span className="brief-card-meta">
                    {settings.aspect_ratio} · {settings.image_size} · {settings.count} pick{settings.count === 1 ? "" : "s"}
                  </span>
                </div>

                {editSourceAsset ? (
                  <div className="edit-banner">
                    <Icon source="photo" tone="inherit" size={16} />
                    Editing {editSourceAsset.title}
                    {maskAsset ? <span className="mask-pill">Mask {maskAsset.title}</span> : null}
                    <button type="button" onClick={clearEditSource}>
                      Clear
                    </button>
                  </div>
                ) : null}



                <div className="prompt-mention-wrap">
                <textarea
                  ref={promptInputRef}
                  value={prompt}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    syncMention(event.target.value, event.target.selectionStart);
                  }}
                  onClick={(event) => syncMention(prompt, event.currentTarget.selectionStart)}
                  onBlur={() => window.setTimeout(closeMention, 120)}
                  onPaste={handlePromptPaste}
                  onDragOver={handlePromptDragOver}
                  onDrop={handlePromptDrop}
                  onKeyDown={(event) => {
                    // Enter sends. Shift+Enter is the newline, everywhere in the app.
                    if (event.key === "Enter" && !event.shiftKey && !mentionOpen) {
                      event.preventDefault();
                      if (prompt.trim()) void handleGenerate();
                      else setStatusText("Enter a prompt to generate.");
                      return;
                    }
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      if (prompt.trim()) void handleGenerate();
                      else if (!prompt.trim()) setStatusText("Enter a prompt to generate.");
                      return;
                    }

                    if (!mentionOpen) return;
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeMention();
                      return;
                    }
                    if (!mentionSuggestions.length) return;
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setMentionIndex((i) => (i + 1) % mentionSuggestions.length);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setMentionIndex((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                    } else if (event.key === "Enter" || event.key === "Tab") {
                      event.preventDefault();
                      if (activeMention) applyMention(activeMention.tag);
                    }
                  }}
                  placeholder="Brief the image: product, context, channel, mood, and what must stay accurate. Type @ to point at a reference. Enter to generate, Shift+Enter for a new line."
                />
                {mentionOpen ? (
                  <div className="prompt-mention-popover" role="listbox" aria-label="Reference tags">
                    {mentionSuggestions.length ? (
                      mentionSuggestions.map((option, i) => (
                        <button
                          key={option.tag}
                          type="button"
                          role="option"
                          aria-selected={activeMention?.tag === option.tag}
                          className={`prompt-mention-option${activeMention?.tag === option.tag ? " is-active" : ""}`}
                          onMouseEnter={() => {
                            setMentionIndex(i);
                            setHoveredReferenceTag(option.tag);
                          }}
                          onMouseLeave={() => setHoveredReferenceTag(null)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyMention(option.tag)}
                        >
                          {option.preview ? (
                            <img src={option.preview} alt="" />
                          ) : (
                            <span className="prompt-mention-thumb-fallback">
                              <Icon source="photo" tone="inherit" size={12} />
                            </span>
                          )}
                          <strong>{option.tag}</strong>
                          <span>{option.title}</span>
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        className="prompt-mention-option prompt-mention-option--empty"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          closeMention();
                          void openReferencePicker();
                        }}
                      >
                        <span>No references loaded — add references</span>
                      </button>
                    )}
                  </div>
                ) : null}
                </div>








                <div
                  className={`composer-actions${referenceDropActive ? " reference-drop-active" : ""}${referenceAssets.length ? " composer-actions--icons" : ""}`}
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
                    <Icon source="arrow-up-tray" tone="inherit" size={16} />
                    Add references

                    {referenceAssets.length ? (
                      <span className="reference-count-badge" aria-label={`${referenceAssets.length} references loaded`}>
                        <Icon source="photo" tone="inherit" size={11} />
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
                        {asset.preview_url ? <img src={asset.preview_url} alt={asset.title} /> : <Icon source="photo" tone="inherit" size={15} />}
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
                          <Icon source="x-mark" tone="inherit" size={12} />
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
                          <Icon source="pencil-square" tone="inherit" size={16} />
                          Paint mask
                        </button>
                        <label className="upload-button mask-upload-button">
                          <Icon source="squares-2x2" tone="inherit" size={16} />
                          Mask
                          <input aria-label="Upload edit mask" type="file" accept="image/png,image/webp,image/jpeg" onChange={handleMaskUpload} />
                        </label>
                      </>
                    ) : null}
                    {maskAsset ? (
                      <button className="mask-chip" type="button" onClick={() => setMaskAsset(null)} title="Clear edit mask">
                        {maskAsset.preview_url ? <img src={maskAsset.preview_url} alt="" aria-hidden="true" /> : <Icon source="squares-2x2" tone="inherit" size={14} />}
                        <span>Mask {maskAsset.title}</span>
                        <Icon source="x-mark" tone="inherit" size={14} />
                      </button>
                    ) : null}
                    {!settingsRailOpen ? (
                      <button className="secondary-button" type="button" onClick={() => setSettingsRailOpen(true)}>
                        <Icon source="adjustments-horizontal" tone="inherit" size={16} />
                        Setup
                      </button>
                    ) : null}
                    <div className="action-compact-pile">
                      <button
                        className="secondary-button danger-button composer-cancel-button"
                        type="button"
                        onClick={requestCancelCurrentSession}
                        disabled={!activeSession}
                        title="Cancel"
                        aria-label="Cancel"
                      >
                        <Icon source="x-mark" tone="inherit" size={14} />
                        <span className="action-label">Cancel</span>
                      </button>
                    </div>
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={!prompt.trim() || hasStudioFieldErrors(fieldErrors)}
                      aria-label={primaryActionLabel}
                      title={
                        !prompt.trim()
                          ? "Enter a prompt to generate"
                          : hasStudioFieldErrors(fieldErrors)
                            ? "Fix the highlighted settings before generating"
                            : primaryActionLabel
                      }
                    >
                      <Icon source="bolt" tone="inherit" size={18} />
                      <span className="action-label">{primaryActionLabel}</span>
                    </button>

                  </div>
                </div>
                {studioBooted && !turns.length && !prompt.trim() && productTaskShortcuts.length ? (
                  <div className="task-shortcut-list composer-task-shortcuts" aria-label="Ways to start">
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
                {(() => {
                  const videoActive = mediaKind === "video" || (mediaKind === "compare" && compareMedia === "video");
                  if (!videoActive) return null;
                  const vModel = isVideoModel(selectedModel) ? selectedModel : null;
                  const refs = referenceAssets.length;
                  const endFrames = Boolean(vModel?.supports_last_frame);
                  let note: React.ReactNode;
                  if (endFrames) {
                    note = refs === 0
                      ? "Add 1 reference to animate from it, or 2 to set a start and end frame."
                      : refs === 1
                        ? "Starts on @ref1. Add a second reference to set the end frame."
                        : <>Starts on <strong>@ref1</strong>, ends on <strong>@ref2</strong>.</>;
                  } else if (refs > 0) {
                    note = <>Image-to-video from <strong>@ref1</strong>.</>;
                  } else if (vModel?.requires_source_image) {
                    note = "This model needs one reference image — add one to run.";
                  } else {
                    note = "No references — text-to-video.";
                  }
                  return (
                    <p className="video-frame-note">
                      {note}
                      {endFrames && refs > 1 ? (
                        <button type="button" className="video-frame-swap" onClick={swapFrameOrder}>
                          Swap
                        </button>
                      ) : null}
                    </p>
                  );
                })()}

              </form>

              <section
                className="thread-surface"
                aria-label="Prompt and output thread"
              >
                <div className="rounds-well-head" aria-hidden="true">
                  <span className="rounds-well-title">Rounds — newest first</span>
                  <span className="rounds-well-count">
                    {turns.length
                      ? `${outputAssets.length.toLocaleString()} pick${outputAssets.length === 1 ? "" : "s"} · ${turns.length.toLocaleString()} round${turns.length === 1 ? "" : "s"}`
                      : "No rounds yet"}
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
                {(() => {
                  // Once the backend has a queued/running round of its own, that round card
                  // IS the loading state — never show a second local card for the same run.
                  if (hasLiveTurn || !inflightGens.length) return null;
                  // Both sides of a side-by-side run collapse into one pending
                  // round with a slot per model, instead of two separate cards.
                  const pendingCards: InflightGen[] = [];
                  const seenGroups = new Set<string>();
                  for (const gen of inflightGens) {
                    if (!gen.compareGroup) { pendingCards.push(gen); continue; }
                    if (seenGroups.has(gen.compareGroup)) continue;
                    seenGroups.add(gen.compareGroup);
                    const pair = inflightGens.filter((entry) => entry.compareGroup === gen.compareGroup);
                    pendingCards.push({
                      ...gen,
                      modelLabel: `Side-by-side · ${pair.map((entry) => entry.modelLabel.replace(/^Side [AB] · /, "")).join(" vs ")}`,
                      count: pair.reduce((total, entry) => total + entry.count, 0),
                      startedAt: Math.min(...pair.map((entry) => entry.startedAt)),
                    });
                  }
                  return pendingCards.slice().reverse().map((gen) => {

                  const p = aspectRatioParts(gen.aspect);
                  const ar = p ? `${p.width} / ${p.height}` : "1 / 1";
                  const waitedMs = Math.max(0, pendingTick - gen.startedAt);
                  const waitedSeconds = Math.floor(waitedMs / 1000);
                  const waitedLabel = waitedSeconds >= 60
                    ? `${Math.floor(waitedSeconds / 60)}m ${String(waitedSeconds % 60).padStart(2, "0")}s`
                    : `${waitedSeconds}s`;
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
                            {waitedSeconds >= 5 ? <span>{waitedLabel} elapsed</span> : null}
                          </div>
                          {waitedMs > 90000 ? (
                            <div className="turn-pending-recheck">
                              <span>Taking longer than usual — the picks may already be saved.</span>
                              <button type="button" onClick={() => void settleFinishedRunsFromServer()}>
                                Check for results
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      </div>

                      <div className="turn-visual">
                      <div className="output-grid">
                        {Array.from({ length: gen.count }).map((_, i) => (
                          <div
                            className="output-skeleton"
                            key={i}
                            style={{ ["--asset-aspect" as string]: ar } as React.CSSProperties}
                          >
                            <span className="output-skeleton-shimmer" aria-hidden="true" />
                            <span className="output-skeleton-spinner" aria-hidden="true" />
                          </div>
                        ))}
                      </div>
                      </div>
                      </div>

                    </article>
                  );
                });
                })()}


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
                          <Icon source="document-duplicate" tone="inherit" size={12} />
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
                          <Icon source="arrow-path" tone="inherit" size={12} />
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
                          <Icon source="x-mark" tone="inherit" size={12} />
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
                          {(() => {
                            const expanded = expandedPromptTurnIds.includes(turn.id);
                            const clamped = clampWords(turn.prompt || "", 25);
                            if (!clamped.truncated) return <p>{turn.prompt}</p>;
                            return (
                              <p
                                className="turn-prompt-text"
                                role="button"
                                title={expanded ? "Collapse prompt" : "Show full prompt"}
                                onClick={() =>
                                  setExpandedPromptTurnIds((current) =>
                                    current.includes(turn.id)
                                      ? current.filter((id) => id !== turn.id)
                                      : [...current, turn.id]
                                  )
                                }
                              >
                                {expanded ? turn.prompt : clamped.text}
                                <span className="turn-prompt-more">{expanded ? "less" : "more"}</span>
                              </p>
                            );
                          })()}
                          <div className="turn-meta">
                            <span title={turn.id} style={{ fontFamily: "ui-monospace, monospace" }}>#{shortId}</span>
                            {timeLabel ? <span title={timeLabel}>{timeLabel}</span> : null}
                            <span>{turn.status}</span>
                            {turn.frank_body_mode ? <span>Frank Body Mode</span> : <span>User prompt</span>}
                            {turnAspect(turn) ? <span className="turn-chip-aspect">{formatAspectChip(turnAspect(turn))}</span> : null}
                            {(() => {
                              // Real returned pixel size, read from the delivered file.
                              const sizes = Array.from(new Set(
                                displayOutputAssets
                                  .filter((a) => a.turn_id === turn.id && a.width && a.height)
                                  .map((a) => `${a.width} × ${a.height}`),
                              ));
                              if (!sizes.length) return null;
                              return (
                                <span className="turn-chip-resolution" title="Resolution returned by the provider">
                                  {sizes.join(" · ")}
                                </span>
                              );
                            })()}
                            {displayOutputAssets.some((a) => a.turn_id === turn.id && a.storage_missing) ? (
                              <span
                                className="turn-chip-resolution"
                                title="This file was over the 20 MB storage limit, so it streams from the provider's temporary link. Save it now to keep it."
                              >
                                Temporary link
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className="turn-chip-json"
                              onClick={() => setPayloadTurnId(turn.id)}
                              title="Show the JSON body sent to the provider"
                            >
                              JSON
                            </button>


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
                              <Icon source="document-duplicate" tone="inherit" size={12} />
                              Copy prompt
                            </button>
                            {(() => {
                              const refIds = parseJsonList(turn.reference_asset_ids_json);
                              if (!refIds.length) return null;
                              return (
                                <span className="turn-ref-strip" title={referenceCountLabel(refIds.length)}>
                                  {refIds.map((refId, refIndex) => {
                                    const refAsset = assets.find((a) => a.id === refId);
                                    const tag = referenceTagFor(refIndex);
                                    return (
                                      <span
                                        key={`${turn.id}-${refId}`}
                                        className="turn-ref-thumb"
                                        title={`${tag} · ${refAsset?.title ?? "reference"}`}
                                        onClick={() => { if (refAsset) setReferencePreviewAsset(refAsset); }}
                                        role={refAsset ? "button" : undefined}
                                      >
                                        {refAsset?.preview_url ? (
                                          <img src={refAsset.preview_url} alt={refAsset.title} loading="lazy" />
                                        ) : (
                                          <Icon source="photo" tone="inherit" size={12} />
                                        )}
                                      </span>
                                    );
                                  })}
                                </span>
                              );
                            })()}

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
                        emptyLabel={turnEmptyLabel(turn)}
                        pending={turn.status === "queued" || turn.status === "running"}
                        pendingCount={turnExpectedCount(turn)}
                        pendingAspect={turnAspect(turn)}


                        selectedAssetId={selectedAsset?.id}

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
                    <Icon source="magnifying-glass" tone="inherit" size={38} />
                    <strong>No rounds match “{roundSearch.trim()}”</strong>
                    <span>Clear the search in the top bar to see all {turns.length} rounds again.</span>
                  </div>
                ) : (
                  <div className="empty-thread">
                    <Icon source="photo" tone="inherit" size={38} />
                    <strong>{config.voice.emptyState}</strong>
                    <span>Describe the shot in the brief above. References and run settings are optional.</span>
                  </div>
                )}
              </section>



          </div>

          {settingsRailOpen ? (
            <aside className="studio-rail" aria-label="Run settings">
                <StudioRail
                  mediaKind={mediaKind}
                  onMediaKindChange={switchMediaKind}
                  models={mediaModels}
                  selectedModelId={selectedModelId}
                  onModelChange={(id) => selectModel(id)}
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
                  videoAllowed={videoAllowed}


                />

            </aside>
          ) : null}
        </div>
      </>
      )}



      {sessionCancelTarget ? (
        <SessionCancelDialog
          session={sessionCancelTarget}
          onCancel={() => setSessionCancelTarget(null)}
          onConfirm={confirmCancelSession}
        />
      ) : null}

      {lightboxAsset ? (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setLightboxAsset(null)}>
          <div className="lightbox-inner is-viewer" onClick={(event) => event.stopPropagation()}>
            <button className="lightbox-close" type="button" onClick={() => setLightboxAsset(null)} aria-label="Close preview">
              <Icon source="x-mark" tone="inherit" size={18} />
            </button>
            {lightboxSiblings.length > 1 ? (
              <>
                <button
                  className="lightbox-nav prev"
                  type="button"
                  onClick={() => stepLightbox(-1)}
                  aria-label="Previous pick"
                >
                  <Icon source="chevron-left" tone="inherit" size={20} />
                </button>
                <button
                  className="lightbox-nav next"
                  type="button"
                  onClick={() => stepLightbox(1)}
                  aria-label="Next pick"
                >
                  <Icon source="chevron-right" tone="inherit" size={20} />
                </button>
              </>
            ) : null}
            <AssetPreviewMedia asset={lightboxAsset} fallbackIconSize={42} controls />
            <div className="lightbox-meta">
              {lightboxAsset.aspect_ratio ? <span>{formatAspectChip(lightboxAsset.aspect_ratio)}</span> : null}
              {lightboxAsset.width && lightboxAsset.height ? (
                <span title="Resolution returned by the provider">{lightboxAsset.width} × {lightboxAsset.height}</span>
              ) : null}
              {lightboxAsset.model ? <span>{modelName(config, lightboxAsset.model)}</span> : null}
              {lightboxSiblings.length > 1 ? (
                <span>{lightboxIndex + 1} / {lightboxSiblings.length}</span>
              ) : null}
            </div>
            {lightboxAsset.media_type !== "video" ? (
              <form
                className="lightbox-edit"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitLightboxEdit();
                }}
              >
                <textarea
                  className="lightbox-edit-input"
                  rows={1}
                  value={lightboxEditText}
                  placeholder={
                    selectedModel?.capabilities.edit
                      ? `Describe the change — ${modelName(config, selectedModel.id)} will run a new round`
                      : "Pick an edit-capable model to edit from here"
                  }
                  disabled={lightboxEditBusy}
                  onChange={(event) => setLightboxEditText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitLightboxEdit();
                    }
                  }}
                />
                <button
                  className="lightbox-edit-send"
                  type="submit"
                  disabled={lightboxEditBusy || !lightboxEditText.trim() || !selectedModel?.capabilities.edit}
                  aria-label="Run edit"
                >
                  {lightboxEditBusy ? (
                    <span className="lightbox-edit-spinner" aria-hidden="true" />
                  ) : (
                    <Icon source="paper-airplane" tone="inherit" size={16} />
                  )}
                </button>
              </form>
            ) : null}
            {lightboxEditBusy ? <p className="lightbox-edit-status">Running the edit…</p> : null}
            <div className="lightbox-actions">
              <button type="button" onClick={() => void downloadAssetFile(lightboxAsset)}>
                <Icon source="arrow-down-tray" tone="inherit" size={16} />
                Save
              </button>
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
              <Icon source="x-mark" tone="inherit" size={18} />
            </button>
            <header className="reference-picker-header">
              <h3>{referencePickerTarget === "upscaler" ? "Pick a source" : "Add references"}</h3>
              <p>
                {referencePickerTarget === "upscaler"
                  ? "Pick one image to upscale — newest first. Uploads land here selected."
                  : `Pick up to ${referencePickerLimit} images — newest first. Uploads land here preselected.`}
              </p>
            </header>
            <input
              ref={referencePickerInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => { void handlePickerUpload(event); }}
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
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      void handlePickerFiles(Array.from(event.dataTransfer.files || []));
                    }}
                    disabled={referencePickerBusy}
                  >

                    <Icon source="arrow-up-tray" tone="inherit" size={22} />
                    <strong>{referencePickerBusy ? "Uploading…" : "Upload from computer"}</strong>
                    <span>PNG, JPG or WEBP · you can also paste or drop</span>
                  </button>
                  {referencePickerPageItems.length ? (
                    referencePickerPageItems.map((asset) => (
                      <ReferencePickerCard
                        key={asset.id}
                        asset={asset}
                        active={referenceAssets.some(
                          (ref) => ref.id === asset.id || ref.source_asset_id === asset.id
                        )}
                        selected={referencePickerSelection.includes(asset.id)}
                        onPick={() => togglePickerSelection(asset)}
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
            {referenceLibrary.length > REFERENCE_PICKER_PAGE_SIZE ? (
              <div className="reference-picker-pagination">
                <Pagination
                  label={`${referencePickerRangeStart}–${referencePickerRangeEnd} of ${referenceLibrary.length}`}
                  hasPrevious={referencePickerPage > 0}
                  hasNext={referencePickerRangeEnd < referenceLibrary.length}
                  onPrevious={() => setReferencePickerPage((page) => Math.max(0, page - 1))}
                  onNext={() => setReferencePickerPage((page) => page + 1)}
                />
              </div>
            ) : null}
            <footer className="reference-picker-footer">
              <span className="reference-picker-count">
                {referencePickerSelection.length} of {referencePickerLimit} selected
                {referencePickerNote ? <em> · {referencePickerNote}</em> : null}
              </span>

              <div className="reference-picker-footer-actions">
                <button type="button" className="ghost-button" onClick={() => setReferencePickerOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!referencePickerSelection.length || referencePickerBusy}
                  onClick={() => void confirmReferencePickerSelection()}
                >
                  {referencePickerBusy
                    ? "Working…"
                    : referencePickerTarget === "upscaler"
                      ? "Use this source"
                      : `Add references${referencePickerSelection.length ? ` (${referencePickerSelection.length})` : ""}`}
                </button>
              </div>
            </footer>


          </div>
        </div>,
        document.body
      ) : null}

      {payloadTurnId ? createPortal(
        <div
          className="payload-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setPayloadTurnId(null)}
        >
          <div className="payload-modal" onClick={(event) => event.stopPropagation()}>
            <header className="payload-modal-header">
              <div>
                <p className="eyebrow">Provider request</p>
                <h3>JSON sent to the model</h3>
              </div>
              <div className="payload-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    const body = formatProviderPayload(turns.find((t) => t.id === payloadTurnId));
                    void navigator.clipboard?.writeText(body).then(() => {
                      setStatusText("Provider JSON copied to clipboard.");
                    }).catch(() => setStatusText("Could not copy the JSON."));
                  }}
                >
                  <Icon source="document-duplicate" tone="inherit" size={14} />
                  Copy
                </button>
                <button type="button" onClick={() => setPayloadTurnId(null)} aria-label="Close JSON view">
                  <Icon source="x-mark" tone="inherit" size={18} />
                </button>
              </div>
            </header>
            <pre className="payload-modal-body">{formatProviderPayload(turns.find((t) => t.id === payloadTurnId))}</pre>
          </div>
        </div>,
        document.body
      ) : null}



      {referencePreviewAsset ? (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setReferencePreviewAsset(null)}>
          <div className="lightbox-inner reference-preview-inner" onClick={(event) => event.stopPropagation()}>
            <button className="lightbox-close" type="button" onClick={() => setReferencePreviewAsset(null)} aria-label="Close reference preview">
              <Icon source="x-mark" tone="inherit" size={18} />
            </button>
            {referencePreviewAsset.preview_url ? (
              <img src={referencePreviewAsset.preview_url} alt={referencePreviewAsset.title} />
            ) : (
              <div className="reference-preview-placeholder"><Icon source="photo" tone="inherit" size={48} /></div>
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
                <Icon source="x-mark" tone="inherit" size={16} />
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
          
          onEdit={(asset) => {
            startEditFromAsset(asset);
            clearCompare();
          }}
        />
      ) : null}
    </Shell>
  );
}
