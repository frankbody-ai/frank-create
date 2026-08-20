import { memo } from "react";

import { Icon } from "../ds";
import { OutputStrip } from "./StudioPieces";
import {
  formatAspectChip,
  modelName,
  referenceCountLabel,
  turnAspect,
  turnEmptyLabel,
  turnErrorCopy,
  turnExpectedCount,
  turnKindLabel
} from "./studioFormat";
import { parseCompareMeta, parseJsonList, referenceTagFor } from "../lib/studio";
import { clampWords } from "../lib/clampWords";
import type { Asset, FrankConfig, StudioTurn } from "../lib/types";

/**
 * One round in the timeline.
 *
 * This lived inline in `App` until it turned out that every keystroke in the
 * composer re-rendered the whole history. It is memoised, so the props it takes
 * are deliberately narrow: the assets for *this* turn rather than the whole
 * library, and callbacks the caller keeps stable with `useCallback`. Passing a
 * freshly-built array or arrow function here silently undoes the memo.
 */

// Hoisted so they are not rebuilt — and made unequal — on every render.
const CARD_STYLE = { position: "relative" } as const;
const CORNER_ACTIONS_STYLE = {
  position: "absolute",
  top: 8,
  right: 8,
  display: "flex",
  gap: 6,
  alignItems: "center",
} as const;
const FRESH_BADGE_STYLE = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  padding: "2px 6px",
  borderRadius: 999,
  background: "rgba(34,197,94,0.15)",
  color: "rgb(21,128,61)",
  border: "1px solid rgba(34,197,94,0.35)",
} as const;
const CORNER_BUTTON_STYLE = {
  width: 22,
  height: 22,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(255,255,255,0.85)",
  cursor: "pointer",
  color: "rgba(0,0,0,0.55)",
} as const;
const MONO_STYLE = { fontFamily: "ui-monospace, monospace" } as const;
const PARTIAL_CHIP_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(245,158,11,0.15)",
  color: "rgb(146,64,14)",
  border: "1px solid rgba(245,158,11,0.4)",
  cursor: "help",
} as const;
const RETRY_MISSING_STYLE = {
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(59,130,246,0.12)",
  color: "rgb(30,64,175)",
  border: "1px solid rgba(59,130,246,0.4)",
  cursor: "pointer",
} as const;

export interface TurnCardProps {
  turn: StudioTurn;
  config: FrankConfig;
  /** Outputs belonging to this turn only. Keep the array identity stable. */
  turnAssets: Asset[];
  /** Every asset by id, for resolving the reference thumbnails. */
  assetsById: Map<string, Asset>;
  /** Newest round in the timeline — earns the "New" badge for its first 30s. */
  isNewest: boolean;
  promptExpanded: boolean;
  selectedAssetId?: string;
  onTogglePrompt: (turnId: string) => void;
  onRetry: (turn: StudioTurn, missing?: number) => void;
  onDelete: (turn: StudioTurn) => void;
  onShowPayload: (turnId: string) => void;
  onCopyPrompt: (turn: StudioTurn) => void;
  onCopyId: (turn: StudioTurn) => void;
  onPreviewReference: (asset: Asset) => void;
  onSelectAsset: (asset: Asset) => void;
}

function TurnCardBase({
  turn,
  config,
  turnAssets,
  assetsById,
  isNewest,
  promptExpanded,
  selectedAssetId,
  onTogglePrompt,
  onRetry,
  onDelete,
  onShowPayload,
  onCopyPrompt,
  onCopyId,
  onPreviewReference,
  onSelectAsset,
}: TurnCardProps) {
  const compareSide = parseCompareMeta(turn.settings_json).side;
  const createdMs = turn.created_at ? new Date(turn.created_at).getTime() : 0;
  const isFresh = isNewest && !!createdMs && Date.now() - createdMs < 30_000;
  const shortId = turn.id.slice(0, 8);
  const timeLabel = turn.created_at ? new Date(turn.created_at).toLocaleString() : "";

  const clamped = clampWords(turn.prompt || "", 25);
  const refIds = parseJsonList(turn.reference_asset_ids_json);

  // Real returned pixel size, read from the delivered file.
  const sizes = Array.from(
    new Set(turnAssets.filter((a) => a.width && a.height).map((a) => `${a.width} × ${a.height}`))
  );

  const anyTurn = turn as unknown as { requested_count?: number; partial_errors_json?: string };
  const requested = typeof anyTurn.requested_count === "number" ? anyTurn.requested_count : 0;
  const produced = turnAssets.length;
  let partial: Array<{ code?: string; message?: string; request_id?: string; retryable?: boolean }> = [];
  try {
    partial = JSON.parse(anyTurn.partial_errors_json || "[]");
  } catch {
    partial = [];
  }
  const showPartial = partial.length > 0 || (requested > 0 && produced < requested);
  const missing = Math.max(0, requested - produced);
  const anyRetryable = partial.some((p) => p?.retryable !== false);

  return (
    <article className={`turn-card${isFresh ? " turn-card-fresh" : ""}`} style={CARD_STYLE}>
      <div style={CORNER_ACTIONS_STYLE}>
        {isFresh ? <span style={FRESH_BADGE_STYLE}>New</span> : null}
        <button
          type="button"
          aria-label="Copy generation ID"
          title={`Copy ID (${turn.id})`}
          onClick={() => onCopyId(turn)}
          style={CORNER_BUTTON_STYLE}
        >
          <Icon source="document-duplicate" tone="inherit" size={12} />
        </button>
        <button
          type="button"
          aria-label="Retry this generation"
          title="Retry with the same settings"
          onClick={() => onRetry(turn)}
          style={CORNER_BUTTON_STYLE}
        >
          <Icon source="arrow-path" tone="inherit" size={12} />
        </button>
        <button
          type="button"
          aria-label="Delete this round"
          title="Delete this round"
          onClick={() => onDelete(turn)}
          style={CORNER_BUTTON_STYLE}
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
              {!clamped.truncated ? (
                <p>{turn.prompt}</p>
              ) : (
                <p
                  className="turn-prompt-text"
                  role="button"
                  title={promptExpanded ? "Collapse prompt" : "Show full prompt"}
                  onClick={() => onTogglePrompt(turn.id)}
                >
                  {promptExpanded ? turn.prompt : clamped.text}
                  <span className="turn-prompt-more">{promptExpanded ? "less" : "more"}</span>
                </p>
              )}

              <div className="turn-meta">
                <span title={turn.id} style={MONO_STYLE}>#{shortId}</span>
                {timeLabel ? <span title={timeLabel}>{timeLabel}</span> : null}
                <span>{turn.status}</span>
                {turn.frank_body_mode ? <span>Frank Body Mode</span> : <span>User prompt</span>}
                {turnAspect(turn) ? (
                  <span className="turn-chip-aspect">{formatAspectChip(turnAspect(turn))}</span>
                ) : null}
                {sizes.length ? (
                  <span className="turn-chip-resolution" title="Resolution returned by the provider">
                    {sizes.join(" · ")}
                  </span>
                ) : null}
                {turnAssets.some((a) => a.storage_missing) ? (
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
                  onClick={() => onShowPayload(turn.id)}
                  title="Show the JSON body sent to the provider"
                >
                  JSON
                </button>
                <button
                  type="button"
                  className="turn-copy-prompt"
                  onClick={() => onCopyPrompt(turn)}
                  title="Copy prompt"
                >
                  <Icon source="document-duplicate" tone="inherit" size={12} />
                  Copy prompt
                </button>

                {refIds.length ? (
                  <span className="turn-ref-strip" title={referenceCountLabel(refIds.length)}>
                    {refIds.map((refId, refIndex) => {
                      const refAsset = assetsById.get(refId);
                      const tag = referenceTagFor(refIndex);
                      return (
                        <span
                          key={`${turn.id}-${refId}`}
                          className="turn-ref-thumb"
                          title={`${tag} · ${refAsset?.title ?? "reference"}`}
                          onClick={() => { if (refAsset) onPreviewReference(refAsset); }}
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
                ) : null}

                {turnErrorCopy(turn) ? <span className="turn-error">{turnErrorCopy(turn)}</span> : null}

                {showPartial ? (
                  <>
                    <span
                      className="turn-partial"
                      title={partial
                        .map((p, i) => `${i + 1}. [${p.code || "error"}] ${p.message || ""}${p.request_id ? ` (id: ${p.request_id})` : ""}`)
                        .join("\n")}
                      style={PARTIAL_CHIP_STYLE}
                    >
                      {produced} of {requested || produced + partial.length} succeeded
                      {missing > 0 ? ` · ${missing} failed` : ""}
                    </span>
                    {missing > 0 && anyRetryable ? (
                      <button
                        type="button"
                        className="turn-retry-missing"
                        onClick={() => onRetry(turn, missing)}
                        title={`Re-run the ${missing} missing image${missing === 1 ? "" : "s"} with the same settings`}
                        style={RETRY_MISSING_STYLE}
                      >
                        Retry missing ({missing})
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="turn-visual">
          <OutputStrip
            assets={turnAssets}
            onSelect={onSelectAsset}
            emptyLabel={turnEmptyLabel(turn)}
            pending={turn.status === "queued" || turn.status === "running"}
            pendingCount={turnExpectedCount(turn)}
            pendingAspect={turnAspect(turn)}
            selectedAssetId={selectedAssetId}
          />
        </div>
      </div>
    </article>
  );
}

export const TurnCard = memo(TurnCardBase);
