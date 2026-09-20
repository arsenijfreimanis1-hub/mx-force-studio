"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  BIKE_TRACE_IDS,
  DEFAULT_TRACE_IDS,
  HANDS_TRACE_IDS,
  TRACE_CHANNELS,
  TRACE_GROUPS,
  TRACE_TITLES,
  formatTraceValue,
  humanTraceCallout,
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

function drawPane(
  ctx: CanvasRenderingContext2D,
  buf: TraceBuffer,
  ids: string[],
  w: number,
  h: number,
) {
  ctx.fillStyle = "rgba(12, 10, 8, 0.55)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5);
  ctx.lineTo(w, h * 0.5);
  ctx.stroke();

  if (buf.len < 2) return;
  const t0 = buf.times[traceIndex(buf, 0)];
  const t1 = buf.times[traceIndex(buf, buf.len - 1)];
  const span = Math.max(16, t1 - t0);
  for (const id of ids) {
    const ch = traceChannel(id);
    const series = buf.values[id];
    if (!ch || !series) continue;
    ctx.beginPath();
    ctx.strokeStyle = ch.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let a = 0; a < buf.len; a++) {
      const idx = traceIndex(buf, a);
      const n = series[idx] / ch.span;
      const x = ((buf.times[idx] - t0) / span) * w;
      const y = h * 0.5 - Math.max(-1.2, Math.min(1.2, n)) * h * 0.4;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function Pane({
  title,
  unit,
  ids,
  bufferRef,
  nowValues,
}: {
  title: string;
  unit: string;
  ids: string[];
  bufferRef: MutableRefObject<TraceBuffer>;
  nowValues: Record<string, number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      const w = Math.max(80, parent.clientWidth);
      const h = Math.max(56, parent.clientHeight);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawPane(ctx, bufferRef.current, ids, w, h);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [bufferRef, ids]);

  const headline = ids
    .map((id) => humanTraceCallout(id, nowValues[id] ?? 0))
    .filter((text, i, all) => all.indexOf(text) === i)
    .slice(0, 3)
    .join(" · ");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-amber-100/90 uppercase">{title}</p>
          <p className="text-[10px] text-white/45">{unit}</p>
        </div>
        <p className="truncate text-sm font-medium text-white">{headline}</p>
      </div>
      <div className="min-h-0 flex-1">
        <canvas ref={canvasRef} className="block h-full w-full rounded-sm" />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/70">
        {ids.map((id) => {
          const ch = traceChannel(id);
          if (!ch) return null;
          return (
            <span key={id} className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full" style={{ background: ch.color }} />
              {TRACE_TITLES[id] ?? ch.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function TelemetryGraph({
  bufferRef,
  live,
}: {
  bufferRef: MutableRefObject<TraceBuffer>;
  live: boolean;
}) {
  const lastHud = useRef(0);
  const [ids, setIds] = useState<string[]>(DEFAULT_TRACE_IDS);
  const [nowValues, setNowValues] = useState<Record<string, number>>({});
  const [more, setMore] = useState(false);

  useEffect(() => {
    setIds(loadTraceIds());
  }, []);

  const setNext = (next: string[]) => {
    setIds(next);
    saveTraceIds(next);
  };

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      if (now - lastHud.current > 120) {
        lastHud.current = now;
        const latest: Record<string, number> = {};
        for (const ch of TRACE_CHANNELS) latest[ch.id] = newestTraceValue(bufferRef.current, ch.id);
        setNowValues(latest);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [bufferRef]);

  const byGroup = useMemo(() => {
    const map = new Map<TraceGroup, typeof TRACE_CHANNELS>();
    for (const ch of TRACE_CHANNELS) {
      const list = map.get(ch.group) ?? [];
      list.push(ch);
      map.set(ch.group, list);
    }
    return map;
  }, []);

  const extraIds = ids.filter((id) => !DEFAULT_TRACE_IDS.includes(id));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 rounded-md border border-white/15 bg-zinc-950/95 p-2.5 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-white/60">
          {live ? "Live from the game and your pad" : "Waiting for the bike"}
          <span className="ml-2 text-white/35">15s ago → now</span>
        </p>
        <Button size="xs" variant={more ? "default" : "secondary"} onClick={() => setMore((v) => !v)}>
          {more ? "Hide extra channels" : "More channels"}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-2 gap-2">
        <Pane
          title="Your hands"
          unit="Gas and brake 0–1"
          ids={HANDS_TRACE_IDS.filter((id) => ids.includes(id))}
          bufferRef={bufferRef}
          nowValues={nowValues}
        />
        <Pane
          title="The bike"
          unit="Lean left/right · pitch · km/h"
          ids={[...BIKE_TRACE_IDS, ...extraIds].filter((id) => ids.includes(id))}
          bufferRef={bufferRef}
          nowValues={nowValues}
        />
      </div>

      {more ? (
        <div className="flex flex-col gap-1.5 border-t border-white/10 pt-1.5">
          <div className="flex flex-wrap items-center gap-1">
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
          <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
            {TRACE_CHANNELS.map((ch) => {
              const on = ids.includes(ch.id);
              const value = nowValues[ch.id];
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setNext(toggleTraceId(ids, ch.id))}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    on ? "bg-white/12 text-white" : "bg-white/5 text-white/35"
                  }`}
                >
                  <span className="mr-1 inline-block size-1.5 rounded-full" style={{ background: on ? ch.color : "#444" }} />
                  {TRACE_TITLES[ch.id] ?? ch.label}
                  {on && value != null ? ` ${formatTraceValue(ch.id, value)}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
