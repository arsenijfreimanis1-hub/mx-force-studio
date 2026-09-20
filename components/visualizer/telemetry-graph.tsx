"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_TRACE_IDS,
  TRACE_CHANNELS,
  TRACE_GROUPS,
  formatTraceValue,
  loadTraceIds,
  newestTraceValue,
  saveTraceIds,
  toggleTraceGroup,
  toggleTraceId,
  traceChannel,
  traceIndex,
  type TraceBuffer,
  type TraceGroup,
} from "@/lib/mxb/trace";

export function TelemetryGraph({
  bufferRef,
  live,
}: {
  bufferRef: MutableRefObject<TraceBuffer>;
  live: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastHud = useRef(0);
  const [ids, setIds] = useState<string[]>(DEFAULT_TRACE_IDS);
  const [nowValues, setNowValues] = useState<Record<string, number>>({});

  useEffect(() => {
    setIds(loadTraceIds());
  }, []);

  const setNext = (next: string[]) => {
    setIds(next);
    saveTraceIds(next);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      const parent = canvas.parentElement;
      if (!ctx || !parent) {
        frame = requestAnimationFrame(draw);
        return;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(120, parent.clientWidth);
      const h = Math.max(80, parent.clientHeight);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(8, 6, 5, 0.35)";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(w, h * 0.5);
      for (let i = 1; i < 4; i++) {
        const y = (h * i) / 4;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      const buf = bufferRef.current;
      const latest: Record<string, number> = {};
      if (buf.len > 1) {
        for (const id of ids) {
          const ch = traceChannel(id);
          const series = buf.values[id];
          if (!ch || !series) continue;
          ctx.beginPath();
          ctx.strokeStyle = ch.color;
          ctx.lineWidth = 1.4;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          for (let a = 0; a < buf.len; a++) {
            const idx = traceIndex(buf, a);
            const n = series[idx] / ch.span;
            const x = (a / (buf.len - 1)) * w;
            const y = h * 0.5 - Math.max(-1.35, Math.min(1.35, n)) * h * 0.42;
            if (a === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          latest[id] = newestTraceValue(buf, id);
        }
      }
      const now = performance.now();
      if (now - lastHud.current > 120) {
        lastHud.current = now;
        setNowValues(latest);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [bufferRef, ids]);

  const byGroup = useMemo(() => {
    const map = new Map<TraceGroup, typeof TRACE_CHANNELS>();
    for (const ch of TRACE_CHANNELS) {
      const list = map.get(ch.group) ?? [];
      list.push(ch);
      map.set(ch.group, list);
    }
    return map;
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 rounded-md border border-white/10 bg-black/70 p-2 text-white backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[10px] font-medium tracking-wide text-white/55 uppercase">
          Game data {live ? "· live" : "· last packet"}
        </span>
        {TRACE_GROUPS.map((g) => {
          const members = byGroup.get(g.id) ?? [];
          const on = members.every((c) => ids.includes(c.id));
          return (
            <Button
              key={g.id}
              size="xs"
              variant={on ? "default" : "secondary"}
              onClick={() => setNext(toggleTraceGroup(ids, g.id))}
            >
              {g.label}
            </Button>
          );
        })}
        <Button
          size="xs"
          variant={ids.length === TRACE_CHANNELS.length ? "default" : "secondary"}
          onClick={() =>
            setNext(ids.length === TRACE_CHANNELS.length ? [...DEFAULT_TRACE_IDS] : TRACE_CHANNELS.map((c) => c.id))
          }
        >
          {ids.length === TRACE_CHANNELS.length ? "Default" : "All"}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
      <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
        {TRACE_CHANNELS.map((ch) => {
          const on = ids.includes(ch.id);
          const value = nowValues[ch.id];
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => setNext(toggleTraceId(ids, ch.id))}
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                on ? "bg-white/12 text-white" : "bg-white/5 text-white/35"
              }`}
            >
              <span className="mr-1 inline-block size-1.5 rounded-full" style={{ background: on ? ch.color : "#444" }} />
              {ch.label}
              {on && value != null ? ` ${formatTraceValue(ch.id, value)}` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
