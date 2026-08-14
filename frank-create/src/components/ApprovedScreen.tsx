import React, { useMemo, useState } from "react";

import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  FilterBar,
  Icon,
  PageHeader,
  Pagination,
  Text,
  Thumbnail,
} from "../ds";
import type { DataTableColumn, DataTableRow } from "../ds";
import { navigate } from "../nav";
import type { Asset } from "../lib/types";

const PAGE_SIZE = 25;

const VIEWS = ["All approved", "Favourites", "Stills", "Clips"] as const;
type View = (typeof VIEWS)[number];

const COLUMNS: DataTableColumn[] = [
  { key: "pick", title: "Pick" },
  { key: "kind", title: "Kind" },
  { key: "model", title: "Model" },
  { key: "media", title: "Media" },
  { key: "size", title: "Delivered size", align: "end" },
  { key: "storage", title: "Storage" },
  { key: "when", title: "Approved" },
];

const KIND_LABELS: Record<string, string> = {
  generate: "Generated",
  edit: "Edit",
  masked_edit: "Masked edit",
  video: "Video",
  upscale: "Upscale",
  enhance: "Upscale",
};

/** Relative under a week, absolute after — the system's date rule. */
export function formatWhen(iso?: string): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (seconds < 172_800) {
    return `Yesterday, ${then.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase()}`;
  }
  if (seconds < 604_800) {
    const d = Math.floor(seconds / 86_400);
    return `${d} days ago`;
  }
  return then.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/** Where the file actually lives, which is what "can I still get it?" means. */
function storageBadge(asset: Asset) {
  if (asset.storage_missing || asset.temporary_url) {
    return <Badge tone="caution">Temporary link</Badge>;
  }
  if (asset.sync_status === "cloud" || asset.file_path) {
    return <Badge tone="success">Stored</Badge>;
  }
  return <Badge tone="info">Local only</Badge>;
}

export interface ApprovedScreenProps {
  /** Every non-reference asset in the session. Filtered to approved here. */
  assets: Asset[];
  sessionId: string | null;
  /** Shared top-bar search. */
  search?: string;
  onOpenAsset?: (asset: Asset) => void;
  onDownloadAsset?: (asset: Asset) => void;
  onStatus?: (message: string) => void;
}

/**
 * Every pick whose approval status is approved, as a resource index rather than
 * a filtered gallery: saved views, search, selection and export in one place.
 */
export function ApprovedScreen({
  assets,
  sessionId,
  search = "",
  onOpenAsset,
  onDownloadAsset,
  onStatus,
}: ApprovedScreenProps) {
  const [view, setView] = useState<View>("All approved");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const approved = useMemo(
    () => assets.filter((asset) => asset.approval_status === "approved"),
    [assets],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return approved.filter((asset) => {
      if (view === "Favourites" && !asset.favorite) return false;
      if (view === "Stills" && asset.media_type === "video") return false;
      if (view === "Clips" && asset.media_type !== "video") return false;
      if (!query) return true;
      return `${asset.title} ${asset.model ?? ""} ${asset.kind}`.toLowerCase().includes(query);
    });
  }, [approved, view, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const atRisk = approved.filter((a) => a.storage_missing || a.temporary_url);

  const rows: DataTableRow[] = visible.map((asset) => ({
    id: asset.id,
    pick: (
      <div className="approved-pick">
        <Thumbnail source={asset.preview_url} alt="" size="medium" />
        <Text fontWeight="medium" truncate>
          {asset.title}
        </Text>
        {asset.favorite ? <Icon source="star" size={16} tone="caution" label="Favourite" /> : null}
      </div>
    ),
    kind: KIND_LABELS[asset.kind] ?? asset.kind,
    model: asset.model ?? "—",
    media: asset.media_type === "video" ? "Video" : "Image",
    size: asset.width && asset.height ? `${asset.width} × ${asset.height}` : "—",
    storage: storageBadge(asset),
    when: formatWhen(asset.updated_at ?? asset.created_at),
  }));

  const exportSelection = () => {
    const picks = filtered.filter((asset) => selected.includes(asset.id));
    if (!picks.length) {
      onStatus?.("Select at least one pick to export.");
      return;
    }
    picks.forEach((asset) => onDownloadAsset?.(asset));
    onStatus?.(`Exporting ${picks.length} pick${picks.length === 1 ? "" : "s"}.`);
  };

  return (
    <>
      <PageHeader
        title="Approved"
        subtitle="Every pick whose approval status is approved. Export them, or open the session's review board."
        badge={<Badge tone="success">{`${approved.length.toLocaleString()} approved`}</Badge>}
        actions={
          <>
            <Button icon="arrow-down-tray" disabled={!selected.length} onClick={exportSelection}>
              Export selection
            </Button>
            <Button
              variant="primary"
              icon="link"
              disabled={!sessionId}
              onClick={() => navigate("review", sessionId)}
            >
              Open review board
            </Button>
          </>
        }
      />

      {atRisk.length ? (
        <Banner tone="warning" title="Some files are on a temporary provider link">
          <span>
            {atRisk.length === 1
              ? `${atRisk[0].title} was`
              : `${atRisk.length} picks were`}{" "}
            over the storage limit, so they stream from the provider instead of storage. Export them
            now to keep them.
          </span>
        </Banner>
      ) : null}

      <Card padding="none">
        <FilterBar
          views={[...VIEWS]}
          selectedView={view}
          onSelectView={(next) => {
            setView(next as View);
            setPage(0);
          }}
          placeholder="Search picks by title"
          actions={null}
        />
        <DataTable
          columns={COLUMNS}
          rows={rows}
          selectable
          selectedIds={selected}
          onToggleRow={(id) =>
            setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
          }
          onToggleAll={(next) => setSelected(next ? visible.map((a) => a.id) : [])}
          onRowClick={(row) => {
            const asset = visible.find((a) => a.id === row.id);
            if (asset) onOpenAsset?.(asset);
          }}
          emptyState={
            <div className="approved-empty">
              <Text as="p" tone="secondary">
                {approved.length
                  ? "No approved picks match this view."
                  : "Nothing is approved yet. Picks stay in review until someone signs them off."}
              </Text>
              {approved.length ? (
                <Button onClick={() => setView("All approved")}>Show all approved</Button>
              ) : (
                <Button variant="primary" icon="link" disabled={!sessionId} onClick={() => navigate("review", sessionId)}>
                  Open review board
                </Button>
              )}
            </div>
          }
          footer={
            filtered.length ? (
              <Pagination
                label={`${current * PAGE_SIZE + 1}–${current * PAGE_SIZE + visible.length} of ${filtered.length.toLocaleString()}`}
                hasPrevious={current > 0}
                hasNext={current < pageCount - 1}
                onPrevious={() => setPage((p) => Math.max(0, p - 1))}
                onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              />
            ) : null
          }
        />
      </Card>
    </>
  );
}
