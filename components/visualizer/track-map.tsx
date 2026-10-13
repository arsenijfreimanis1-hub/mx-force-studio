"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Telemetry } from "@/lib/mxb/types";

type Pt = { x: number; z: number };

/**
 * Corner track map: the MX Bikes map image when we can find it on disk,
 * otherwise the lap path drawn from live world XZ. A marker sits on the bike.
 */
export function TrackMap({
  trackId,
  trackName,
  telemetry,
  live,
  className = "",
}: {
  trackId: string;
  trackName: string;
  telemetry: Telemetry;
  live: boolean;
  className?: string;
}) {
  const [hasImage, setHasImage] = useState(false);
  const [imgKey, setImgKey] = useState("");
  const path = useRef<Pt[]>([]);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!trackId && !trackName) {
      setHasImage(false);
      setImgKey("");
      return;
    }
    const key = `${trackId}|${trackName}`;
    let cancelled = false;
    void fetch(`/api/track-map?meta=1&trackId=${encodeURIComponent(trackId)}&trackName=${encodeURIComponent(trackName)}`)
      .then((r) => r.json())
      .then((body: { found?: boolean }) => {
        if (cancelled) return;
        setHasImage(Boolean(body.found));
        setImgKey(key);
        path.current = [];
      })
      .catch(() => {
        if (!cancelled) setHasImage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trackId, trackName]);

  useEffect(() => {
    if (!live) return;
    const p = telemetry.position;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return;
    const list = path.current;
    const last = list[list.length - 1];
    if (last && Math.hypot(last.x - p.x, last.z - p.z) < 1.2) return;
    list.push({ x: p.x, z: p.z });
    if (list.length > 800) list.splice(0, list.length - 800);
    tick((n) => n + 1);
  }, [live, telemetry.position.x, telemetry.position.z, telemetry.time]);

  const bounds = useMemo(() => {
    const pts = path.current;
    if (pts.length < 2) {
      const p = telemetry.position;
      return { minX: p.x - 40, maxX: p.x + 40, minZ: p.z - 40, maxZ: p.z + 40 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const pt of pts) {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minZ = Math.min(minZ, pt.z);
      maxZ = Math.max(maxZ, pt.z);
    }
    const pad = Math.max(8, Math.max(maxX - minX, maxZ - minZ) * 0.08);
    return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
  }, [telemetry.position.x, telemetry.position.z, telemetry.time, hasImage]);

  const label = trackName || trackId || "Track";
  const imgSrc =
    hasImage && imgKey
      ? `/api/track-map?trackId=${encodeURIComponent(trackId)}&trackName=${encodeURIComponent(trackName)}&t=${encodeURIComponent(imgKey)}`
      : "";

  const w = bounds.maxX - bounds.minX || 1;
  const h = bounds.maxZ - bounds.minZ || 1;
  const toX = (x: number) => ((x - bounds.minX) / w) * 100;
  // Screen Y grows down; world +Z is drawn toward the bottom so the map reads like the game.
  const toY = (z: number) => ((z - bounds.minZ) / h) * 100;
  const bike = telemetry.position;
  const yaw = ((telemetry.yaw % 360) + 360) % 360;

  if (!live && path.current.length < 2 && !hasImage) return null;

  return (
    <div
      className={`pointer-events-none absolute bottom-3 z-20 w-44 overflow-hidden rounded-md border border-white/15 bg-black/55 shadow-lg backdrop-blur-sm ${className}`}
    >
      <div className="relative aspect-square w-full">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt={label} className="absolute inset-0 h-full w-full object-contain opacity-90" />
        ) : (
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
            <rect width="100" height="100" fill="#0c0a09" />
            {path.current.length > 1 ? (
              <polyline
                fill="none"
                stroke="#a8a29e"
                strokeWidth="1.2"
                points={path.current.map((p) => `${toX(p.x)},${toY(p.z)}`).join(" ")}
              />
            ) : null}
          </svg>
        )}
        {/* Rider marker — world XZ fitted into the drawing */}
        <div
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-amber-300 shadow"
          style={{
            left: `${toX(bike.x)}%`,
            top: `${toY(bike.z)}%`,
            transform: `translate(-50%, -50%) rotate(${yaw}deg)`,
          }}
        />
      </div>
      <p className="truncate px-1.5 py-1 font-mono text-[9px] text-white/80">{label}</p>
    </div>
  );
}
