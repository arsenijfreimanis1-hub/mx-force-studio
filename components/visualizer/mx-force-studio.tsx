"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Eye, EyeOff, Gamepad2, Loader2, Radio, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  applyProfileToTelemetry,
  defaultProfile,
  loadProfile,
  lockParkedUnits,
  type BikeProfile,
} from "@/lib/mxb/adapt";
import { DEFAULT_EVENT, DEFAULT_SANDBOX, restTelemetry } from "@/lib/mxb/defaults";
import { formatG, speedKph } from "@/lib/mxb/forces";
import { gamepadActive, readFirstGamepad } from "@/lib/mxb/gamepad";
import { detectCrash } from "@/lib/mxb/crash";
import { setupLabel } from "@/lib/mxb/inputs";
import { displayBikeName, holdLive, isPlaceholderBikeName, stabilizeBikeEvent } from "@/lib/mxb/live-store";
import { fmtLapMs, fmtOnTrackS, sessionKind, suspUsedPct, trackPct } from "@/lib/mxb/session";
import {
  createMotionFilter,
  DEFAULT_FRAME_TRAVEL,
  identityPose,
  resetMotionFilter,
  type FrameTravel,
  type Pose6,
} from "@/lib/mxb/motion";
import { buildForceModel } from "@/lib/mxb/forces";
import type { BikeEvent, ForceId, ForceModel, LivePacket, SandboxInputs, Telemetry } from "@/lib/mxb/types";

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

const HUD_MS = 50;

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
  const [hideForces, setHideForces] = useState(true);
  const [livePacket, setLivePacket] = useState<LivePacket | null>(null);
  const [liveOk, setLiveOk] = useState(false);
  const [connectRequested, setConnectRequested] = useState(false);
  const [staleMs, setStaleMs] = useState<number | null>(null);
  const [hudTel, setHudTel] = useState<Telemetry>(() => restTelemetry({ rpm: 0 }));
  const [inspect, setInspect] = useState(true);
  const [travel, setTravel] = useState<FrameTravel>(DEFAULT_FRAME_TRAVEL);
  const [hudEvent, setHudEvent] = useState<BikeEvent>(DEFAULT_EVENT);
  const [padOn, setPadOn] = useState(false);
  const [driving, setDriving] = useState(false);

  const pollRef = useRef<() => Promise<void>>(async () => {});
  const motionRef = useRef(createMotionFilter());
  const poseRef = useRef(identityPose());
  const travelRef = useRef(DEFAULT_FRAME_TRAVEL);
  const connectRef = useRef(connectRequested);
  const lastHudRef = useRef(0);
  const bikeLatchRef = useRef({ id: "", name: "" });
  const liveRef = useRef(false);
  const telemetryRef = useRef<Telemetry>(hudTel);
  const eventRef = useRef<BikeEvent>(DEFAULT_EVENT);
  const padActiveRef = useRef(false);
  const sandboxRef = useRef<SandboxInputs>({ ...DEFAULT_SANDBOX });
  const forcesRef = useRef<ForceModel>(buildForceModel(hudTel, DEFAULT_EVENT));
  const hiddenRef = useRef<Set<ForceId>>(new Set());
  const adaptRef = useRef<BikeProfile>(defaultProfile());
  const userTravelRef = useRef(DEFAULT_FRAME_TRAVEL);
  const drivingRef = useRef(false);
  const padOnRef = useRef(false);
  const lastPublishedLiveRef = useRef(false);

  useEffect(() => {
    connectRef.current = connectRequested;
    userTravelRef.current = travel;
    travelRef.current = travel;
    if (!connectRequested) liveRef.current = false;
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      let pad = padActiveRef.current;
      if (!liveRef.current) {
        const gp = readFirstGamepad();
        pad = Boolean(gp && gamepadActive(gp)) || pad;
      } else {
        pad = false;
      }
      if (pad !== padOnRef.current) {
        padOnRef.current = pad;
        setPadOn(pad);
      }
      const nextDriving = liveRef.current || pad;
      if (nextDriving !== drivingRef.current) {
        drivingRef.current = nextDriving;
        setDriving(nextDriving);
      }

      const now = performance.now();
      if (now - lastHudRef.current < HUD_MS) return;
      lastHudRef.current = now;
      setHudTel(telemetryRef.current);
      setHudEvent(eventRef.current);
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let lastSse = 0;

    const applyLive = (body: {
      live: boolean;
      packet: LivePacket | null;
      staleMs: number | null;
    }) => {
      if (cancelled) return;
      const wantLive = connectRef.current;
      const streamLive = wantLive && holdLive(body.staleMs, body.live, Boolean(body.packet?.telemetry));
      if (streamLive && body.packet?.telemetry) {
        liveRef.current = true;
        if (body.packet.event) {
          const locked = stabilizeBikeEvent(body.packet.event, bikeLatchRef.current, true);
          bikeLatchRef.current = locked.latch;
          eventRef.current = locked.event;
        }
        const bikeId = eventRef.current.bikeId;
        const realBike = Boolean(eventRef.current.bikeName) && !isPlaceholderBikeName(eventRef.current.bikeName, bikeId);
        if (realBike && (adaptRef.current.bikeId === "live" || !adaptRef.current.bikeId)) {
          adaptRef.current = loadProfile(bikeId, eventRef.current.bikeName);
        }
        adaptRef.current = lockParkedUnits(adaptRef.current, body.packet.telemetry);
        telemetryRef.current = applyProfileToTelemetry(body.packet.telemetry, adaptRef.current);
      } else {
        liveRef.current = false;
        const reallyGone = !wantLive || (body.staleMs != null && body.staleMs > 1500);
        if (reallyGone) {
          telemetryRef.current = restTelemetry({ rpm: 0 });
          resetMotionFilter(motionRef.current);
          poseRef.current = identityPose();
          if (!wantLive) {
            eventRef.current = DEFAULT_EVENT;
            bikeLatchRef.current = { id: "", name: "" };
          }
        }
      }

      const liveNow = liveRef.current;
      const liveEdge = liveNow !== lastPublishedLiveRef.current;
      lastPublishedLiveRef.current = liveNow;
      if (liveEdge) {
        setLiveOk(liveNow);
        setLivePacket(body.packet);
        setStaleMs(body.staleMs);
        setHudTel(telemetryRef.current);
        setHudEvent(eventRef.current);
        drivingRef.current = liveNow || padOnRef.current;
        setDriving(drivingRef.current);
        lastHudRef.current = performance.now();
        return;
      }

      const now = performance.now();
      if (now - lastHudRef.current < HUD_MS) return;
      lastHudRef.current = now;
      setLiveOk(liveNow);
      setLivePacket(body.packet);
      setStaleMs(body.staleMs);
      setHudTel(telemetryRef.current);
      setHudEvent(eventRef.current);
    };

    const poll = async () => {
      try {
        const response = await fetch("/api/telemetry", { cache: "no-store" });
        const body = (await response.json()) as {
          live: boolean;
          packet: LivePacket | null;
          staleMs: number | null;
        };
        applyLive(body);
      } catch {
        if (!cancelled) setLiveOk(false);
      }
    };
    pollRef.current = poll;

    const es = new EventSource("/api/telemetry/stream");
    es.onmessage = (event) => {
      lastSse = performance.now();
      try {
        applyLive(
          JSON.parse(event.data) as {
            live: boolean;
            packet: LivePacket | null;
            staleMs: number | null;
          },
        );
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

  const usingLive = Boolean(connectRequested && liveOk && livePacket);
  const liveState: "idle" | "waiting" | "connected" = !connectRequested
    ? "idle"
    : liveOk && livePacket
      ? "connected"
      : "waiting";
  const telemetry = hudTel;
  const crashed = detectCrash(telemetry);
  const liveName = displayBikeName(hudEvent);
  const setupName = setupLabel(livePacket?.session.setupFileName);
  const bikeLabel = usingLive
    ? liveName || "MX Bikes"
    : padOn
      ? "Xbox pad"
      : liveState === "waiting"
        ? "Waiting for MX Bikes"
        : "Awaiting game";
  const frontSuspPct = Math.round(suspUsedPct(telemetry.suspLength[0], hudEvent.suspMaxTravel[0]) * 100);
  const rearSuspPct = Math.round(suspUsedPct(telemetry.suspLength[1], hudEvent.suspMaxTravel[1]) * 100);
  const onTrackPct = Math.round(trackPct(telemetry) * 100);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold tracking-tight">MX Force Studio</h1>
        </div>
        <Button
          size="xs"
          variant={connectRequested ? "default" : "ghost"}
          onClick={() => {
            if (connectRequested) {
              setConnectRequested(false);
              liveRef.current = false;
              telemetryRef.current = restTelemetry();
              eventRef.current = DEFAULT_EVENT;
              motionRef.current = createMotionFilter();
              poseRef.current = identityPose();
              setHudTel(restTelemetry());
              setHudEvent(DEFAULT_EVENT);
              bikeLatchRef.current = { id: "", name: "" };
            } else {
              setConnectRequested(true);
              motionRef.current = createMotionFilter();
              poseRef.current = identityPose();
              void pollRef.current();
            }
          }}
        >
          <Radio />
          Live
        </Button>
        {padOn ? (
          <Badge variant="outline" className="gap-1">
            <Gamepad2 className="size-3" />
            Pad
          </Badge>
        ) : null}
        {crashed ? (
          <Badge variant="destructive" className="gap-1">
            Crash
          </Badge>
        ) : null}
        <Badge variant={usingLive ? "default" : "outline"} className="gap-1 max-w-[14rem]">
          {usingLive ? (
            <Radio className="size-3" />
          ) : liveState === "waiting" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Unplug className="size-3" />
          )}
          <span className="truncate">
            {bikeLabel}
          </span>
        </Badge>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_16.5rem]">
        <section className="relative min-h-[52vh] border-b border-border lg:border-r lg:border-b-0">
          <BikeCanvas
            telemetryRef={telemetryRef}
            hideForces={hideForces}
            inspect={inspect}
            poseRef={poseRef}
            motionRef={motionRef}
            travelRef={travelRef}
            liveRef={liveRef}
            padActiveRef={padActiveRef}
            sandboxRef={sandboxRef}
            eventRef={eventRef}
            forcesRef={forcesRef}
            hiddenRef={hiddenRef}
            driving={driving}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-2">
            <div className="flex max-w-full items-center gap-x-3 overflow-x-auto rounded-md border border-white/10 bg-black/55 px-2.5 py-1.5 font-mono text-[11px] text-white backdrop-blur-sm">
              <span className="max-w-[10rem] truncate text-amber-200">{bikeLabel}</span>
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
              {usingLive ? (
                <>
                  <span className="text-white/35">·</span>
                  <span className="max-w-[9rem] truncate">{hudEvent.trackName || "Track"}</span>
                  <span>{onTrackPct}%</span>
                  <span>{fmtOnTrackS(telemetry.time)}</span>
                  <span>F{frontSuspPct} R{rearSuspPct}</span>
                </>
              ) : null}
              <span className="text-white/35">·</span>
              <span>
                <PoseReadout poseRef={poseRef} />
              </span>
            </div>
          </div>

          <div className="absolute top-11 right-2 z-20 flex gap-1">
            <Button size="xs" variant={hideForces ? "default" : "secondary"} onClick={() => setHideForces((v) => !v)}>
              {hideForces ? <Eye /> : <EyeOff />}
              {hideForces ? "Show arrows" : "Hide arrows"}
            </Button>
            <Button size="xs" variant="secondary" onClick={() => setInspect((v) => !v)}>
              {inspect ? "Orbit" : "Lock"}
            </Button>
          </div>

          {!driving && liveState === "idle" ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-16">
              <p className="rounded-md border border-white/10 bg-black/60 px-3 py-2 text-center text-xs text-amber-100">
                Awaiting MX Bikes — frame stays upright until you go on track and Connect
              </p>
            </div>
          ) : null}

          <InputsOverlay telemetry={telemetry} />
        </section>

        <aside className="flex min-h-0 flex-col bg-card">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-3">
              {liveState === "idle" ? (
                <>
                  <p className="text-xs leading-4 text-muted-foreground">
                    Garage is parked upright. Start MX Bikes on this PC, go on track, then Connect.
                    Deck XYZ follows the game Cartesian point (chassis X right, Y up, Z forward).
                    Stock Xbox: RT throttle, LT front brake, LB rear, A clutch, left stick steer,
                    right stick body weight (dummy lean / sit).
                  </p>
                  <Button
                    size="sm"
                    className="w-full bg-sky-500 text-white hover:bg-sky-400"
                    onClick={() => {
                      setConnectRequested(true);
                      motionRef.current = createMotionFilter();
                      poseRef.current = identityPose();
                      void pollRef.current();
                    }}
                  >
                    <Radio />
                    Connect
                  </Button>
                </>
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
                    Live · {liveName || "MX Bikes"} · {fmtAge(staleMs ?? 0)}
                  </p>
                  <div className="grid gap-0.5 font-mono text-[11px] text-muted-foreground">
                    <p>
                      {hudEvent.trackName || "Track"} · {onTrackPct}%
                    </p>
                    <p>{sessionKind(hudEvent, livePacket?.session.session ?? 0)}</p>
                    <p>
                      Lap {telemetry.lapNum ?? 0} · {fmtOnTrackS(telemetry.time)}
                      {telemetry.lapInvalid ? " · invalid" : ""}
                    </p>
                    <p>
                      Last {fmtLapMs(telemetry.lastLapMs ?? 0)}
                      {telemetry.bestLap ? " · best" : ""}
                    </p>
                    <p>
                      Susp F {frontSuspPct}% · R {rearSuspPct}%
                    </p>
                    {setupName ? <p>Setup {setupName}</p> : null}
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setConnectRequested(false);
                      liveRef.current = false;
                      telemetryRef.current = restTelemetry();
                      eventRef.current = DEFAULT_EVENT;
                      motionRef.current = createMotionFilter();
                      poseRef.current = identityPose();
                      setHudTel(restTelemetry());
                      setHudEvent(DEFAULT_EVENT);
                      bikeLatchRef.current = { id: "", name: "" };
                    }}
                  >
                    Disconnect
                  </Button>
                </>
              ) : null}

              {padOn && !usingLive ? (
                <p className="text-[11px] text-muted-foreground">
                  Xbox pad driving the frame — RT throttle, LT front brake, LB rear, left stick steer/lean
                </p>
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
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}

function fmtM(m: number) {
  return `${m >= 0 ? "+" : ""}${m.toFixed(2)}`;
}

function fmtDeg(rad: number) {
  const d = (rad * 180) / Math.PI;
  return `${d >= 0 ? "+" : ""}${d.toFixed(0)}°`;
}

function PoseReadout({ poseRef }: { poseRef: MutableRefObject<Pose6> }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const pose = poseRef.current;
      if (el.current) {
        el.current.textContent = `X ${fmtM(pose.x)}  Y ${fmtM(pose.y)}  Z ${fmtM(pose.z)} m  R ${fmtDeg(pose.roll)}  P ${fmtDeg(pose.pitch)}  Yw ${fmtDeg(pose.yaw)}`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [poseRef]);
  return <span ref={el}>X +0.00  Y +0.00  Z +0.00 m  R +0°  P +0°  Yw +0°</span>;
}

function InputsOverlay({ telemetry }: { telemetry: Telemetry }) {
  const steerMax = 40;
  const steerT = Math.min(1, Math.max(-1, telemetry.steer / steerMax));
  const steerLeft = steerT > 0;
  const steerWidth = Math.abs(steerT) * 50;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-2 pl-14">
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
