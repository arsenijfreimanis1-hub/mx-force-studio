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
import {
  createMotionFilter,
  DEFAULT_FRAME_TRAVEL,
  identityPose,
  stepMotion,
  type FrameTravel,
} from "@/lib/mxb/motion";
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
    <label className="grid gap-1">
      <span className="flex items-center justify-between text-[11px] text-muted-foreground">
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
  const [travel, setTravel] = useState<FrameTravel>(DEFAULT_FRAME_TRAVEL);
  const [poseHud, setPoseHud] = useState(identityPose());
  const clockRef = useRef(0);
  const pollRef = useRef<() => Promise<void>>(async () => {});
  const motionRef = useRef(createMotionFilter());
  const poseRef = useRef(identityPose());
  const travelRef = useRef(DEFAULT_FRAME_TRAVEL);
  const lastStepRef = useRef(0);
  const modeRef = useRef(mode);
  const connectRef = useRef(connectRequested);
  const lastHudRef = useRef(0);
  const scenarioRef = useRef(scenario);
  const sandboxRef = useRef(sandbox);

  useEffect(() => {
    modeRef.current = mode;
    connectRef.current = connectRequested;
    travelRef.current = travel;
    scenarioRef.current = scenario;
    sandboxRef.current = sandbox;
  });

  const stepPose = (next: Telemetry) => {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - lastStepRef.current) / 1000));
    lastStepRef.current = now;
    const pose = stepMotion(motionRef.current, next, dt, travelRef.current);
    poseRef.current = pose;
    return pose;
  };

  useEffect(() => {
    motionRef.current = createMotionFilter();
    lastStepRef.current = performance.now();
  }, [mode, scenario]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playing && modeRef.current !== "live") {
        clockRef.current += dt;
        const tel = telemetryForScenario(
          modeRef.current === "sandbox" ? "sandbox" : scenarioRef.current,
          clockRef.current,
          sandboxRef.current,
        );
        const pose = stepPose(tel);
        setPoseHud(pose);
        setClock(clockRef.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    let cancelled = false;
    let lastSse = 0;

    const applyHud = (body: {
      live: boolean;
      packet: LivePacket | null;
      staleMs: number | null;
    }) => {
      if (cancelled) return;
      if (body.packet?.telemetry && modeRef.current === "live" && connectRef.current) {
        stepPose(body.packet.telemetry);
      }
      const now = performance.now();
      if (now - lastHudRef.current < 40) return;
      lastHudRef.current = now;
      setLiveOk(body.live);
      setLivePacket(body.packet);
      setStaleMs(body.staleMs);
      setPoseHud(poseRef.current);
    };

    const poll = async () => {
      try {
        const response = await fetch("/api/telemetry", { cache: "no-store" });
        const body = (await response.json()) as {
          live: boolean;
          packet: LivePacket | null;
          staleMs: number | null;
        };
        applyHud(body);
      } catch {
        if (!cancelled) setLiveOk(false);
      }
    };
    pollRef.current = poll;

    const es = new EventSource("/api/telemetry/stream");
    es.onmessage = (event) => {
      lastSse = performance.now();
      try {
        applyHud(JSON.parse(event.data) as {
          live: boolean;
          packet: LivePacket | null;
          staleMs: number | null;
        });
      } catch {
        // ignore malformed chunks
      }
    };

    const id = window.setInterval(() => {
      if (performance.now() - lastSse < 400) return;
      void poll();
    }, 50);

    return () => {
      cancelled = true;
      es.close();
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
  const telemetry: Telemetry =
    usingLive && livePacket
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
      <header className="flex items-center gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold tracking-tight">MX Force Studio</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant={mode === "demo" ? "default" : "ghost"}
            onClick={() => {
              setMode("demo");
              if (scenario === "sandbox") setScenario("launch");
            }}
          >
            <Gauge />
            Demo
          </Button>
          <Button
            size="xs"
            variant={mode === "sandbox" ? "default" : "ghost"}
            onClick={() => {
              setMode("sandbox");
              setScenario("sandbox");
            }}
          >
            <SlidersHorizontal />
            Sandbox
          </Button>
          <Button size="xs" variant={mode === "live" ? "default" : "ghost"} onClick={() => setMode("live")}>
            <Radio />
            Live
          </Button>
        </div>
        <Badge variant={usingLive ? "default" : "outline"} className="gap-1">
          {usingLive ? (
            <Radio className="size-3" />
          ) : liveState === "waiting" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Unplug className="size-3" />
          )}
          {usingLive ? "Live" : liveState === "waiting" ? "Waiting" : event.bikeName}
        </Badge>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_16.5rem]">
        <section className="relative min-h-[52vh] border-b border-border lg:border-r lg:border-b-0">
          <BikeCanvas
            telemetry={telemetry}
            model={model}
            hidden={hidden}
            inspect={inspect}
            poseRef={poseRef}
            travel={travel}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-2">
            <div className="flex max-w-full items-center gap-x-3 overflow-x-auto rounded-md border border-white/10 bg-black/55 px-2.5 py-1.5 font-mono text-[11px] text-white backdrop-blur-sm">
              <span>{speedKph(telemetry.speedMs).toFixed(0)} km/h</span>
              <span>{Math.round(telemetry.rpm)}</span>
              <span>{gearLabel(telemetry.gear)}</span>
              <span className="text-white/35">·</span>
              <span>Gx {formatG(telemetry.accelG.x)}</span>
              <span>Gy {formatG(telemetry.accelG.y)}</span>
              <span>Gz {formatG(telemetry.accelG.z)}</span>
              <span className="text-white/35">·</span>
              <span>
                {telemetry.pitch.toFixed(0)}° / {telemetry.roll.toFixed(0)}°
              </span>
              <span className="text-white/35">·</span>
              <span>
                {fmtCm(poseHud.x)} {fmtCm(poseHud.y)} {fmtCm(poseHud.z)}
              </span>
              {model.airborne ? <span className="text-amber-300">air</span> : null}
            </div>
          </div>

          <div className="absolute top-11 right-2 z-20 flex gap-1">
            <Button size="xs" variant="secondary" onClick={() => setInspect((v) => !v)}>
              {inspect ? "Orbit" : "Lock"}
            </Button>
            <Button
              size="icon-xs"
              variant="secondary"
              onClick={() => setPlaying((v) => !v)}
              disabled={mode === "live"}
            >
              {playing ? <Pause /> : <Play />}
            </Button>
          </div>

          <InputsOverlay telemetry={telemetry} />
        </section>

        <aside className="flex min-h-0 flex-col bg-card">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-3">
              {mode === "live" ? (
                <div className="grid gap-2">
                  {liveState === "idle" ? (
                    <Button
                      size="sm"
                      className="w-full bg-sky-500 text-white hover:bg-sky-400"
                      onClick={() => {
                        setConnectRequested(true);
                        motionRef.current = createMotionFilter();
                        void pollRef.current();
                      }}
                    >
                      <Radio />
                      Connect
                    </Button>
                  ) : null}

                  {liveState === "waiting" ? (
                    <>
                      <p className="text-xs leading-4 text-amber-300">
                        Waiting for MX Bikes
                        {staleMs != null && staleMs <= 5000 ? ` · ${fmtAge(staleMs)} ago` : " · UDP 47387"}
                      </p>
                      <Button size="xs" variant="outline" onClick={() => setConnectRequested(false)}>
                        Cancel
                      </Button>
                    </>
                  ) : null}

                  {liveState === "connected" ? (
                    <>
                      <p className="text-xs leading-4 text-emerald-300">
                        Live · {fmtAge(staleMs ?? 0)}
                      </p>
                      <Button size="xs" variant="outline" onClick={() => setConnectRequested(false)}>
                        Disconnect
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}

              {mode !== "live" ? (
                <div className="grid grid-cols-2 gap-1">
                  {SCENARIOS.filter((item) => item.id !== "sandbox").map((item) => (
                    <Button
                      key={item.id}
                      size="xs"
                      variant={mode === "demo" && scenario === item.id ? "default" : "outline"}
                      className="justify-start"
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
              ) : null}

              {mode === "sandbox" ? (
                <div className="grid gap-2">
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
                    label="Steer"
                    value={sandbox.steer}
                    min={-40}
                    max={40}
                    step={0.5}
                    display={`${sandbox.steer.toFixed(0)}°`}
                    onChange={(steer) => patchSandbox({ steer })}
                  />
                  <NumberSlider
                    label="Lean"
                    value={sandbox.lean}
                    min={-45}
                    max={45}
                    step={0.5}
                    display={`${sandbox.lean.toFixed(0)}°`}
                    onChange={(lean) => patchSandbox({ lean })}
                  />
                  <NumberSlider
                    label="Pitch"
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
                </div>
              ) : null}

              <div className="grid gap-2">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Frame travel ±m
                </p>
                <NumberSlider
                  label="Left / right"
                  value={travel.limitX}
                  min={0}
                  max={2}
                  step={0.05}
                  display={`${travel.limitX.toFixed(2)} m`}
                  onChange={(limitX) => setTravel((prev) => ({ ...prev, limitX }))}
                />
                <NumberSlider
                  label="Up / down"
                  value={travel.limitY}
                  min={0}
                  max={2}
                  step={0.05}
                  display={`${travel.limitY.toFixed(2)} m`}
                  onChange={(limitY) => setTravel((prev) => ({ ...prev, limitY }))}
                />
                <NumberSlider
                  label="Fore / aft"
                  value={travel.limitZ}
                  min={0}
                  max={2}
                  step={0.05}
                  display={`${travel.limitZ.toFixed(2)} m`}
                  onChange={(limitZ) => setTravel((prev) => ({ ...prev, limitZ }))}
                />
                <NumberSlider
                  label="Response"
                  value={travel.response}
                  min={0.25}
                  max={2}
                  step={0.05}
                  display={`${Math.round(travel.response * 100)}%`}
                  onChange={(response) => setTravel((prev) => ({ ...prev, response }))}
                />
              </div>

              <Separator />

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    Forces
                  </p>
                  <Button size="xs" variant="ghost" onClick={() => setHidden(new Set())}>
                    All
                  </Button>
                </div>
                {FORCE_ORDER.map((id) => {
                  const force = model.forces.find((item) => item.id === id);
                  if (!force) return null;
                  const meta = FORCE_META[id];
                  return (
                    <div
                      key={id}
                      title={force.description}
                      className="flex items-center gap-2 rounded-md px-1 py-0.5"
                    >
                      <span className="size-2 rounded-full" style={{ background: meta.color }} />
                      <span className="flex-1 truncate text-xs">{force.shortName}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {force.kind === "moment"
                          ? `${force.magnitude.toFixed(0)}`
                          : formatNewtons(force.magnitude)}
                      </span>
                      <Switch
                        checked={!hidden.has(id)}
                        onCheckedChange={() => toggleForce(id)}
                        size="sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}

function fmtCm(m: number) {
  const cm = Math.round(m * 100);
  return `${cm >= 0 ? "+" : ""}${cm}`;
}

function InputsOverlay({ telemetry }: { telemetry: Telemetry }) {
  const steerMax = 40;
  const steerT = Math.min(1, Math.max(-1, telemetry.steer / steerMax));
  const steerLeft = steerT > 0;
  const steerWidth = Math.abs(steerT) * 50;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-2">
      <div className="grid grid-cols-5 gap-x-2 rounded-md border border-white/10 bg-black/55 px-2.5 py-1.5 backdrop-blur-sm">
        <InputBar label="Thr" value={telemetry.throttle} fillClass="bg-emerald-400" />
        <InputBar label="F brk" value={telemetry.frontBrake} fillClass="bg-rose-500" />
        <InputBar label="R brk" value={telemetry.rearBrake} fillClass="bg-pink-400" />
        <InputBar label="Clh" value={telemetry.clutch} fillClass="bg-slate-300" />
        <div className="grid gap-1">
          <div className="flex items-center justify-between text-[10px] tracking-wide text-white/55 uppercase">
            <span>Str</span>
            <span className="font-mono text-white">{telemetry.steer.toFixed(0)}°</span>
          </div>
          <div className="relative h-1 overflow-hidden rounded-full bg-white/15">
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
        <span className="font-mono text-white">{pct}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/15">
        <div className={`h-full ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
