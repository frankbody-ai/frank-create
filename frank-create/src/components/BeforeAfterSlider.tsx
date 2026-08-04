import { useCallback, useEffect, useRef, useState } from "react";

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  alt?: string;
  onExpand?: () => void;
}

/**
 * Drag-to-compare viewer: the "after" (enhanced) image is clipped to the
 * handle position so the original shows through on the left.
 */
export default function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before",
  afterLabel = "After",
  alt = "Before and after comparison",
  onExpand
}: BeforeAfterSliderProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);

  const moveTo = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (!rect.width) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      event.preventDefault();
      moveTo(event.clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, moveTo]);

  return (
    <div
      className={`compare-slider${dragging ? " is-dragging" : ""}`}
      ref={frameRef}
      onPointerDown={(event) => {
        setDragging(true);
        moveTo(event.clientX);
      }}
      onDoubleClick={() => onExpand?.()}
    >
      <img className="compare-slider-before" src={beforeSrc} alt={alt} draggable={false} />
      <img
        className="compare-slider-after"
        src={afterSrc}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      />
      <span className="compare-slider-tag compare-slider-tag--before">{beforeLabel}</span>
      <span className="compare-slider-tag compare-slider-tag--after">{afterLabel}</span>
      <div className="compare-slider-handle" style={{ left: `${position}%` }} aria-hidden="true">
        <span />
      </div>
      <input
        className="compare-slider-input"
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={position}
        aria-label="Before and after comparison position"
        onChange={(event) => setPosition(Number(event.target.value))}
      />
    </div>
  );
}
