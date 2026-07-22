import { useMemo } from "react";

interface AspectPreviewProps {
  aspect: string;
  size?: string;
  label?: string;
}

function parseAspect(aspect: string): { w: number; h: number } | null {
  if (!aspect) return null;
  const match = aspect.match(/^(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!w || !h) return null;
  return { w, h };
}

function parseSize(size?: string): { w: number; h: number } | null {
  if (!size) return null;
  const match = size.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return null;
  return { w: Number(match[1]), h: Number(match[2]) };
}

export function AspectPreview({ aspect, size, label }: AspectPreviewProps) {
  const ratio = useMemo(() => parseAspect(aspect), [aspect]);
  const sizePx = useMemo(() => parseSize(size), [size]);

  if (!ratio) return null;

  const orientation = ratio.w === ratio.h ? "square" : ratio.w > ratio.h ? "landscape" : "portrait";
  const cssRatio = `${ratio.w} / ${ratio.h}`;

  // Mismatch check: does image_size aspect match the selected aspect?
  const mismatch = sizePx
    ? Math.abs(sizePx.w / sizePx.h - ratio.w / ratio.h) > 0.02
    : false;

  return (
    <div className="aspect-preview" data-orientation={orientation} aria-label={`Preview of ${aspect} canvas`}>
      <div className="aspect-preview-stage">
        <div className="aspect-preview-frame" style={{ aspectRatio: cssRatio }}>
          <span className="aspect-preview-ratio">{aspect}</span>
          {sizePx ? (
            <span className="aspect-preview-size">{sizePx.w}×{sizePx.h}</span>
          ) : null}
        </div>
      </div>
      <div className="aspect-preview-meta">
        <span className="aspect-preview-orient">{orientation}</span>
        {label ? <span className="aspect-preview-label">{label}</span> : null}
        {mismatch ? (
          <span className="aspect-preview-warn" role="alert">Size doesn't match aspect — will letterbox/crop</span>
        ) : null}
      </div>
    </div>
  );
}

export default AspectPreview;
