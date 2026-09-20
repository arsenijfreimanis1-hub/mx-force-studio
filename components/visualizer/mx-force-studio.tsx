"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Gauge,
  Loader2,
  Pause,
  Play,
  Radio,
  SlidersHorizontal,
  Unplug,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_EVENT, DEFAULT_SANDBOX, restTelemetry } from "@/lib/mxb/defaults";
import { SCENARIOS, telemetryForScenario } from "@/lib/mxb/demo";
import { FORCE_META, buildForceModel, formatG, formatNewtons, speedKph } from "@/lib/mxb/forces";
import type {
  BikeEvent,
  ForceId,
  LivePacket,
  SandboxInputs,
  ScenarioId,
  SourceMode,
  Telemetry,
} from "@/lib/mxb/types";

const BikeCanvas = dynamic(
  () => import("@/components/visualizer/bike-canvas").then((mod) => mod.BikeCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Lighting the garage…
      </div>
    ),
  },
);

const FORCE_ORDER: ForceId[] = [
  "gravity",
  "frontNormal",
  "rearNormal",
  "drive",
  "frontBrake",
  "rearBrake",
  "longitudinal",
  "lateral",
  "vertical",
  "fork",
  "shock",
  "aero",
  "steer",
  "gyro",
];

function gearLabel(gear: number) {
  if (gear <= 0) return "N";
  return String(gear);
}

function fmtAge(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60000)} min`;
}

function NumberSlider({
  label,
  value,
  min,
  max,
  step = 0.01,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground">{display}</span>
      </span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => {
          const n = Array.isArray(next) ? next[0] : next;
          onChange(Number(n));
        }}
      />
    </label>
  );
}

export function MxForceStudio() {
  const [mode, setMode] = useState<SourceMode>("demo");
  const [scenario, setScenario] = useState<ScenarioId>("launch");
  const [playing, setPlaying] = useState(true);
  const [sandbox, setSandbox] = useState<SandboxInputs>(DEFAULT_SANDBOX);
  const [hidden, setHidden] = useState<Set<ForceId>>(new Set(["aero", "gyro"]));
  const [livePacket, setLivePacket] = useState<LivePacket | null>(null);
  const [liveOk, setLiveOk] = useState(false);
  const [connectRequested, setConnectRequested] = useState(false);
  const [staleMs, setStaleMs] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const [inspect, setInspect] = useState(true);
  const clockRef = useRef(0);
  const pollRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playing && mode !== "live") {
        clockRef.current += dt;
        setClock(clockRef.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, mode]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/telemetry", { cache: "no-store" });
        const body = (await response.json()) as {
          live: boolean;
          packet: LivePacket | null;
          staleMs: number | null;
        };
        if (!cancelled) {
          setLiveOk(body.live);
          setLivePacket(body.packet);
          setStaleMs(body.staleMs);
        }
      } catch {
        if (!cancelled) setLiveOk(false);
      }
    };
    pollRef.current = poll;
    poll();
    const id = window.setInterval(poll, 80);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const demoTelemetry = useMemo(
    () => telemetryForScenario(mode === "sandbox" ? "sandbox" : scenario, clock, sandbox),
    [mode, scenario, clock, sandbox],
  );

  const usingLive = Boolean(mode === "live" && connectRequested && liveOk && livePacket);
  const liveState: "idle" | "waiting" | "connected" = !connectRequested
    ? "idle"
    : liveOk && livePacket
      ? "connected"
      : "waiting";
  const telemetry: Telemetry = usingLive && livePacket
    ? livePacket.telemetry
    : mode === "live"
      ? restTelemetry({ rpm: 0, wheelMaterial: [0, 0] })
      : demoTelemetry;
  const event: BikeEvent = usingLive && livePacket ? livePacket.event : DEFAULT_EVENT;
  const model = useMemo(() => buildForceModel(telemetry, event), [telemetry, event]);

  const toggleForce = (id: ForceId) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const patchSandbox = (partial: Partial<SandboxInputs>) => {
    setMode("sandbox");
    setScenario("sandbox");
    setSandbox((prev) => ({ ...prev, ...partial }));
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-sky-400 uppercase">
            MX Bikes · 250F Force Studio
          </p>
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">
            Static 250, live forces
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={usingLive ? "default" : "outline"} className="gap-1.5">
            {usingLive ? (
              <Radio className="size-3" />
            ) : liveState === "waiting" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Unplug className="size-3" />
            )}
            {usingLive
              ? "MX Bikes live"
              : liveState === "waiting"
                ? "Waiting for MX Bikes"
                : "Demo physics"}
          </Badge>
          <Badge variant="secondary">
            {event.bikeName}
            {event.trackName ? ` · ${event.trackName}` : ""}
          </Badge>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="relative min-h-[52vh] border-b border-border lg:border-r lg:border-b-0">
          <BikeCanvas telemetry={telemetry} model={model} hidden={hidden} inspect={inspect} />

          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-2 p-3 md:p-4">
            <HudChip label="Speed" value={`${speedKph(telemetry.speedMs).toFixed(0)} km/h`} />
            <HudChip label="RPM" value={Math.round(telemetry.rpm).toLocaleString()} />
            <HudChip label="Gear" value={gearLabel(telemetry.gear)} />
            <HudChip label="Lean" value={`${telemetry.roll.toFixed(0)}°`} />
            <HudChip label="Long G" value={formatG(telemetry.accelG.z)} />
            <HudChip label="Lat G" value={formatG(telemetry.accelG.x)} />
            <HudChip label="Vert G" value={formatG(telemetry.accelG.y)} />
            {model.airborne ? <HudChip label="Contact" value="Airborne" warn /> : null}
          </div>

          <div className="absolute top-[4.75rem] right-3 z-20 flex gap-2 md:top-20 md:right-4">
            <Button size="sm" variant="secondary" onClick={() => setInspect((v) => !v)}>
              {inspect ? "Inspect on" : "Orbit lock"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPlaying((v) => !v)}
              disabled={mode === "live"}
            >
              {playing ? <Pause /> : <Play />}
              {playing ? "Pause" : "Play"}
            </Button>
          </div>

          <InputsOverlay telemetry={telemetry} />
        </section>

        <aside className="flex min-h-0 flex-col bg-card">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 p-4">
              <div className="grid gap-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Source
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    size="sm"
                    variant={mode === "demo" ? "default" : "outline"}
                    onClick={() => {
                      setMode("demo");
                      if (scenario === "sandbox") setScenario("launch");
                    }}
                  >
                    <Gauge />
                    Demo
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === "sandbox" ? "default" : "outline"}
                    onClick={() => {
                      setMode("sandbox");
                      setScenario("sandbox");
                    }}
                  >
                    <SlidersHorizontal />
                    Sandbox
                  </Button>
                  <Button
                    size="sm"
                    variant={mode === "live" ? "default" : "outline"}
                    onClick={() => setMode("live")}
                  >
                    <Radio />
                    Live
                  </Button>
                </div>
                {mode === "live" ? (
                  <div className="grid gap-2">
                    {liveState === "idle" ? (
                      <>
                        <Button
                          size="sm"
                          className="w-full bg-sky-500 text-white hover:bg-sky-400"
                          onClick={() => {
                            setConnectRequested(true);
                            void pollRef.current();
                          }}
                        >
                          <Radio />
                          Connect to MX Bikes
                        </Button>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Launch MX Bikes and go out on track, then click Connect. The desktop
                          icon already started the telemetry bridge — there is no in-game button,
                          so you connect from here.
                        </p>
                      </>
                    ) : null}

                    {liveState === "waiting" ? (
                      <>
                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
                          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-amber-400" />
                          <div className="grid gap-0.5">
                            <p className="text-sm font-medium text-amber-300">
                              Waiting for MX Bikes…
                            </p>
                            <p className="text-[11px] leading-4 text-amber-200/80">
                              Launch the game and go on track (listening on UDP 47387).
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-amber-200/60">
                              {staleMs != null && staleMs <= 5000
                                ? `signal lost · last packet ${fmtAge(staleMs)} ago`
                                : "no live telemetry on 47387 — check the bridge + plugin, and that you're on track"}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => setConnectRequested(false)}
                        >
                          <Unplug />
                          Cancel
                        </Button>
                      </>
                    ) : null}

                    {liveState === "connected" ? (
                      <>
                        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
                          <Radio className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                          <div className="grid gap-0.5">
                            <p className="text-sm font-medium text-emerald-300">
                              Connected — live forces streaming
                            </p>
                            <p className="text-[11px] leading-4 text-emerald-200/80">
                              The bike stays in the garage while the arrows update from your
                              session.
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-emerald-200/60">
                              receiving · last packet {fmtAge(staleMs ?? 0)} ago
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => setConnectRequested(false)}
                        >
                          <Unplug />
                          Disconnect
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {mode !== "live" ? (
                <div className="grid gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Riding case
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SCENARIOS.filter((item) => item.id !== "sandbox").map((item) => (
                      <Button
                        key={item.id}
                        size="sm"
                        variant={mode === "demo" && scenario === item.id ? "default" : "outline"}
                        className="h-auto justify-start py-2 text-left whitespace-normal"
                        onClick={() => {
                          setMode("demo");
                          setScenario(item.id);
                          setPlaying(true);
                        }}
                      >
                        {item.name}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {SCENARIOS.find((item) => item.id === (mode === "sandbox" ? "sandbox" : scenario))?.blurb}
                  </p>
                </div>
              ) : null}

              {mode === "sandbox" ? (
                <div className="grid gap-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Simulate each input
                  </p>
                  <NumberSlider
                    label="Throttle"
                    value={sandbox.throttle}
                    min={0}
                    max={1}
                    display={`${Math.round(sandbox.throttle * 100)}%`}
                    onChange={(throttle) => patchSandbox({ throttle })}
                  />
                  <NumberSlider
                    label="Front brake"
                    value={sandbox.frontBrake}
                    min={0}
                    max={1}
                    display={`${Math.round(sandbox.frontBrake * 100)}%`}
                    onChange={(frontBrake) => patchSandbox({ frontBrake })}
                  />
                  <NumberSlider
                    label="Rear brake"
                    value={sandbox.rearBrake}
                    min={0}
                    max={1}
                    display={`${Math.round(sandbox.rearBrake * 100)}%`}
                    onChange={(rearBrake) => patchSandbox({ rearBrake })}
                  />
                  <NumberSlider
                    label="Steer (neg = right)"
                    value={sandbox.steer}
                    min={-40}
                    max={40}
                    step={0.5}
                    display={`${sandbox.steer.toFixed(0)}°`}
                    onChange={(steer) => patchSandbox({ steer })}
                  />
                  <NumberSlider
                    label="Lean right"
                    value={sandbox.lean}
                    min={-45}
                    max={45}
                    step={0.5}
                    display={`${sandbox.lean.toFixed(0)}°`}
                    onChange={(lean) => patchSandbox({ lean })}
                  />
                  <NumberSlider
                    label="Pitch (wheelie +)"
                    value={sandbox.pitch}
                    min={-20}
                    max={35}
                    step={0.5}
                    display={`${sandbox.pitch.toFixed(0)}°`}
                    onChange={(pitch) => patchSandbox({ pitch })}
                  />
                  <NumberSlider
                    label="Speed"
                    value={sandbox.speedKph}
                    min={0}
                    max={90}
                    step={1}
                    display={`${sandbox.speedKph.toFixed(0)} km/h`}
                    onChange={(speedKphValue) => patchSandbox({ speedKph: speedKphValue })}
                  />
                  <NumberSlider
                    label="Fork travel"
                    value={sandbox.frontTravel}
                    min={0}
                    max={0.95}
                    display={`${Math.round(sandbox.frontTravel * 100)}%`}
                    onChange={(frontTravel) => patchSandbox({ frontTravel })}
                  />
                  <NumberSlider
                    label="Shock travel"
                    value={sandbox.rearTravel}
                    min={0}
                    max={0.95}
                    display={`${Math.round(sandbox.rearTravel * 100)}%`}
                    onChange={(rearTravel) => patchSandbox({ rearTravel })}
                  />
                  <NumberSlider
                    label="RPM"
                    value={sandbox.rpm}
                    min={1500}
                    max={14000}
                    step={50}
                    display={`${Math.round(sandbox.rpm)}`}
                    onChange={(rpm) => patchSandbox({ rpm })}
                  />
                  <NumberSlider
                    label="Gear"
                    value={sandbox.gear}
                    min={0}
                    max={5}
                    step={1}
                    display={gearLabel(sandbox.gear)}
                    onChange={(gear) => patchSandbox({ gear: Math.round(gear) })}
                  />
                </div>
              ) : null}

              <Separator />

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Forces
                  </p>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setHidden(new Set())}
                  >
                    Show all
                  </Button>
                </div>
                <div className="grid gap-2">
                  {FORCE_ORDER.map((id) => {
                    const force = model.forces.find((item) => item.id === id);
                    if (!force) return null;
                    const meta = FORCE_META[id];
                    return (
                      <div
                        key={id}
                        className="rounded-lg border border-border bg-background/60 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ background: meta.color }}
                          />
                          <span className="flex-1 text-sm font-medium">{force.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {force.kind === "moment"
                              ? `${force.magnitude.toFixed(0)} Nm`
                              : formatNewtons(force.magnitude)}
                          </span>
                          <Switch
                            checked={!hidden.has(id)}
                            onCheckedChange={() => toggleForce(id)}
                            size="sm"
                          />
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                          {force.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}

function InputsOverlay({ telemetry }: { telemetry: Telemetry }) {
  const steerMax = 40;
  const steerT = Math.min(1, Math.max(-1, telemetry.steer / steerMax));
  const steerLeft = steerT > 0;
  const steerWidth = Math.abs(steerT) * 50;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 pl-14 md:p-4 md:pl-16">
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-lg border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-sm sm:grid-cols-6">
        <InputBar label="Throttle" value={telemetry.throttle} fillClass="bg-emerald-400" />
        <InputBar label="Front brake" value={telemetry.frontBrake} fillClass="bg-rose-500" />
        <InputBar label="Rear brake" value={telemetry.rearBrake} fillClass="bg-pink-400" />
        <InputBar label="Clutch" value={telemetry.clutch} fillClass="bg-slate-300" />
        <div className="grid gap-1">
          <div className="flex items-center justify-between text-[10px] tracking-wide text-white/55 uppercase">
            <span>Steer</span>
            <span className="font-mono text-white">
              {telemetry.steer.toFixed(0)}°{telemetry.steer < 0 ? " R" : telemetry.steer > 0 ? " L" : ""}
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/50" />
            <div
              className="absolute inset-y-0 bg-violet-400"
              style={
                steerLeft
                  ? { left: `${50 - steerWidth}%`, width: `${steerWidth}%` }
                  : { left: "50%", width: `${steerWidth}%` }
              }
            />
          </div>
        </div>
        <div className="grid gap-1">
          <p className="text-[10px] tracking-wide text-white/55 uppercase">Gear</p>
          <p className="font-mono text-sm leading-none text-white">{gearLabel(telemetry.gear)}</p>
        </div>
      </div>
    </div>
  );
}

function InputBar({
  label,
  value,
  fillClass,
}: {
  label: string;
  value: number;
  fillClass: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-[10px] tracking-wide text-white/55 uppercase">
        <span>{label}</span>
        <span className="font-mono text-white">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className={`h-full ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HudChip({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="pointer-events-auto rounded-lg border border-white/10 bg-black/55 px-2.5 py-1.5 backdrop-blur-sm">
      <p className="text-[10px] tracking-wide text-white/55 uppercase">{label}</p>
      <p className={`font-mono text-sm ${warn ? "text-amber-300" : "text-white"}`}>{value}</p>
    </div>
  );
}
