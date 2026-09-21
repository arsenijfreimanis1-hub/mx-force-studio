"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Gamepad2, LineChart, Loader2, Radio, Unplug, User } from "lucide-react";
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
import {
  describePad,
  gamepadActive,
  isRiderPad,
  padTraceActive,
  readBodyStick,
  readFirstGamepad,
  readPadTrace,
} from "@/lib/mxb/gamepad";
import { riderFromTelemetry } from "@/lib/mxb/rider";
import { createRidePhaseFilter, describeRidePhase, detectCrash, type RidePhase } from "@/lib/mxb/crash";
import { setupLabel } from "@/lib/mxb/inputs";
import { dofStep, saveStoredDof } from "@/lib/mxb/dof";
import { displayBikeName, holdLive, isPlaceholderBikeName, stabilizeBikeEvent } from "@/lib/mxb/live-store";
import { sanitizeTelemetry } from "@/lib/mxb/sanitize";
import { fmtLapMs, fmtOnTrackS, sessionKind, suspUsedPct, trackPct } from "@/lib/mxb/session";
import {
  createMotionFilter,
  loadStoredTravel,
  saveStoredTravel,
  sanitizeTravel,
  STUDIO_TRAVEL,
  identityPose,
  resetMotionFilter,
  type FrameTravel,
  type Pose6,
} from "@/lib/mxb/motion";
import { buildForceModel } from "@/lib/mxb/forces";
import {
  clearTraceBuffer,
  createTraceBuffer,
  loadTraceOpen,
  pushTraceSample,
  saveTraceOpen,
} from "@/lib/mxb/trace";
import type { BikeEvent, ForceId, ForceModel, LivePacket, SandboxInputs, Telemetry } from "@/lib/mxb/types";
import { applyLesson, describeLesson, emptyLesson, learnFromRows, type SheetLesson } from "@/lib/mxb/lesson";
import { describeHarness, idleHarness, type HarnessState } from "@/lib/mxb/harness";
import {
  createSheetBuffer,
  parseSheetCsv,
  pushSheetRow,
  readSheetRows,
  sheetDurationS,
  sheetFilename,
  sheetToCsv,
} from "@/lib/mxb/sheet";
import { TelemetryGraph } from "@/components/visualizer/telemetry-graph";

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
        className="py-1.5"
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
  const [inspect, setInspect] = useState(false);
  const [travel, setTravel] = useState<FrameTravel>(STUDIO_TRAVEL);
  const [hudEvent, setHudEvent] = useState<BikeEvent>(DEFAULT_EVENT);
  const [padOn, setPadOn] = useState(false);
  const [padName, setPadName] = useState("");
  const [driving, setDriving] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [logMode, setLogMode] = useState<"off" | "auto" | "start">("off");
  const [sheetCount, setSheetCount] = useState(0);
  const [sheetSeconds, setSheetSeconds] = useState(0);
  const [lesson, setLesson] = useState<SheetLesson>(() => emptyLesson());
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [logDir, setLogDir] = useState("");
  const [hudHarness, setHudHarness] = useState<HarnessState>(() => idleHarness());
  const [hudPhase, setHudPhase] = useState<RidePhase>("parked");
  const [pov, setPov] = useState(false);
  const [devOpen, setDevOpen] = useState(false);

  const pollRef = useRef<() => Promise<void>>(async () => {});
  const motionRef = useRef(createMotionFilter());
  const poseRef = useRef(identityPose());
  const travelRef = useRef(STUDIO_TRAVEL);
  const connectRef = useRef(connectRequested);
  const lastHudRef = useRef(0);
  const lastHarnessHud = useRef(0);
  const bikeLatchRef = useRef({ id: "", name: "" });
  const liveRef = useRef(false);
  const telemetryRef = useRef<Telemetry>(hudTel);
  const eventRef = useRef<BikeEvent>(DEFAULT_EVENT);
  const padActiveRef = useRef(false);
  const sandboxRef = useRef<SandboxInputs>({ ...DEFAULT_SANDBOX });
  const forcesRef = useRef<ForceModel>(buildForceModel(hudTel, DEFAULT_EVENT));
  const hiddenRef = useRef<Set<ForceId>>(new Set());
  const adaptRef = useRef<BikeProfile>(defaultProfile());
  const userTravelRef = useRef(STUDIO_TRAVEL);
  const drivingRef = useRef(false);
  const padOnRef = useRef(false);
  const padNameRef = useRef("");
  const lastPublishedLiveRef = useRef(false);
  const traceRef = useRef(createTraceBuffer(900));
  const lastTraceMs = useRef(0);
  const graphOpenRef = useRef(false);
  const sheetRef = useRef(createSheetBuffer(24000));
  const harnessRef = useRef(idleHarness());
  const ridePhaseRef = useRef(createRidePhaseFilter());
  const lastSheetMs = useRef(0);
  const lastLearnMs = useRef(0);
  const lastSignFlipMs = useRef(0);
  const logModeRef = useRef<"off" | "auto" | "start">("off");
  const lessonRef = useRef<SheetLesson>(emptyLesson());

  useEffect(() => {
    const stored = loadStoredTravel(STUDIO_TRAVEL);
    setTravel(stored);
    setGraphOpen(loadTraceOpen(false));
    void fetch("/api/sheet")
      .then((res) => res.json())
      .then((data: { dir?: string; latestCsv?: string; latestName?: string }) => {
        if (data.dir) setLogDir(data.dir);
        if (data.latestCsv && data.latestCsv.length > 20) {
          const rows = parseSheetCsv(data.latestCsv);
          const nextLesson = learnFromRows(rows, {
            visualPitch: stored.visualPitch,
            leanSign: stored.leanSign,
          });
          lessonRef.current = nextLesson;
          setLesson(nextLesson);
          const patched = applyLesson(stored, nextLesson, { allowSignFlip: false, slew: 0.55 });
          setTravel(patched);
          travelRef.current = patched;
          userTravelRef.current = patched;
          saveStoredTravel(patched);
          if (data.latestName) setSaveMsg(`Learned from ${data.latestName}`);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    connectRef.current = connectRequested;
    userTravelRef.current = travel;
    travelRef.current = travel;
    graphOpenRef.current = graphOpen;
    logModeRef.current = logMode;
    if (!connectRequested) liveRef.current = false;
  });

  const patchTravel = (patch: Partial<FrameTravel>) => {
    setTravel((prev) => {
      const next = sanitizeTravel({ ...prev, ...patch });
      saveStoredTravel(next);
      saveStoredDof(next.dof);
      return next;
    });
  };

  const saveSheet = async () => {
    if (sheetRef.current.len < 2 || saving) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const csv = sheetToCsv(sheetRef.current);
      const filename = sheetFilename(displayBikeName(eventRef.current) || "session");
      const res = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, filename }),
      });
      const data = (await res.json()) as { file?: string; dir?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.dir) setLogDir(data.dir);
      setSaveMsg(data.file ? `Saved ${data.file}` : "Saved next to the plugin.");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Could not save next to the plugin.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      const gp = readFirstGamepad();
      const riderGp = isRiderPad(gp) ? gp : null;
      const padTrace = readPadTrace(riderGp);
      let pad = padActiveRef.current;
      if (!liveRef.current && !connectRef.current) {
        pad = Boolean(riderGp && gamepadActive(riderGp)) || pad;
      } else {
        pad = false;
        padActiveRef.current = false;
      }
      if (pad !== padOnRef.current) {
        padOnRef.current = pad;
        setPadOn(pad);
      }
      const nextPadName = riderGp ? describePad(riderGp) : "";
      if (nextPadName !== padNameRef.current) {
        padNameRef.current = nextPadName;
        setPadName(nextPadName);
      }
      const nextDriving = liveRef.current;
      if (nextDriving !== drivingRef.current) {
        drivingRef.current = nextDriving;
        setDriving(nextDriving);
      }

      const now = performance.now();
      const logPad = graphOpenRef.current || liveRef.current || padTraceActive(padTrace);
      if (logPad && now - lastTraceMs.current >= 16) {
        lastTraceMs.current = now;
        pushTraceSample(
          traceRef.current,
          telemetryRef.current,
          now,
          padTrace,
          poseRef.current,
          travelRef.current.visualPitch,
        );
      }
      // Live applyLive also stamps lastHudRef; keep harness off that clock.
      if (now - lastHarnessHud.current >= HUD_MS) {
        lastHarnessHud.current = now;
        setHudHarness(harnessRef.current);
        setHudPhase(ridePhaseRef.current.phase);
      }
      const mode = logModeRef.current;
      const shouldLog = mode === "start" || (mode === "auto" && nextDriving);
      if (shouldLog && now - lastSheetMs.current >= 40) {
        lastSheetMs.current = now;
        pushSheetRow(
          sheetRef.current,
          telemetryRef.current,
          poseRef.current,
          now,
          padTrace,
          travelRef.current.visualPitch,
        );
      }
      if (
        mode === "auto" &&
        shouldLog &&
        sheetRef.current.len >= 80 &&
        now - lastLearnMs.current >= 4000
      ) {
        lastLearnMs.current = now;
        const rows = readSheetRows(sheetRef.current, 4500);
        const nextLesson = learnFromRows(rows, {
          visualPitch: travelRef.current.visualPitch,
          leanSign: travelRef.current.leanSign,
          dtMs: 40,
        });
        lessonRef.current = nextLesson;
        setLesson(nextLesson);
        const allowSignFlip = now - lastSignFlipMs.current > 20000;
        const patched = applyLesson(travelRef.current, nextLesson, { allowSignFlip, slew: 0.22 });
        const flipped =
          patched.visualPitch !== travelRef.current.visualPitch ||
          patched.leanSign !== travelRef.current.leanSign;
        if (flipped) lastSignFlipMs.current = now;
        if (
          patched.visualTau !== travelRef.current.visualTau ||
          patched.smoothTau !== travelRef.current.smoothTau ||
          patched.response !== travelRef.current.response ||
          patched.rateAng !== travelRef.current.rateAng ||
          flipped
        ) {
          userTravelRef.current = patched;
          travelRef.current = patched;
          setTravel(patched);
          saveStoredTravel(patched);
        }
      }
      if (now - lastHudRef.current < HUD_MS) return;
      lastHudRef.current = now;
      setHudTel(telemetryRef.current);
      setHudEvent(eventRef.current);
      setSheetCount(sheetRef.current.len);
      setSheetSeconds(sheetDurationS(sheetRef.current));
      setHudHarness(harnessRef.current);
      setHudPhase(ridePhaseRef.current.phase);
    }, 16);
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
        telemetryRef.current = sanitizeTelemetry(
          applyProfileToTelemetry(body.packet.telemetry, adaptRef.current),
          telemetryRef.current,
        );
      } else {
        liveRef.current = false;
        const reallyGone = !wantLive || (body.staleMs != null && body.staleMs > 1500);
        if (reallyGone) {
          telemetryRef.current = restTelemetry({ rpm: 0 });
          resetMotionFilter(motionRef.current);
          poseRef.current = identityPose();
          clearTraceBuffer(traceRef.current);
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
        setHudHarness(harnessRef.current);
        setHudPhase(ridePhaseRef.current.phase);
        drivingRef.current = liveNow;
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
      setHudHarness(harnessRef.current);
      setHudPhase(ridePhaseRef.current.phase);
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
      ? padName || "Xbox pad"
      : liveState === "waiting"
        ? "Waiting for MX Bikes"
        : "Awaiting game";
  const frontSuspPct = Math.round(suspUsedPct(telemetry.suspLength[0], hudEvent.suspMaxTravel[0]) * 100);
  const rearSuspPct = Math.round(suspUsedPct(telemetry.suspLength[1], hudEvent.suspMaxTravel[1]) * 100);
  const onTrackPct = Math.round(trackPct(telemetry) * 100);
  const step = dofStep();

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold tracking-tight">MX Force Studio</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {step.title} · {step.adds}
          </p>
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
              clearTraceBuffer(traceRef.current);
            } else {
              setConnectRequested(true);
              telemetryRef.current = restTelemetry({ rpm: 0 });
              sandboxRef.current = { ...DEFAULT_SANDBOX };
              padActiveRef.current = false;
              motionRef.current = createMotionFilter();
              poseRef.current = identityPose();
              setHudTel(restTelemetry({ rpm: 0 }));
              setPadOn(false);
              void pollRef.current();
            }
          }}
        >
          <Radio />
          Live
        </Button>
        {padOn || padName ? (
          <Badge variant="outline" className="gap-1 max-w-[9rem]">
            <Gamepad2 className="size-3" />
            <span className="truncate">{padName || "Pad"}</span>
          </Badge>
        ) : null}
        {crashed || hudPhase === "crash" ? (
          <Badge variant="destructive" className="gap-1">
            Crash
          </Badge>
        ) : (
          <Badge variant={hudPhase === "air" || hudPhase === "land" ? "default" : "outline"} className="gap-1">
            {describeRidePhase(hudPhase)}
          </Badge>
        )}
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

      <div className="grid min-h-0 flex-1 lg:grid-cols-[8.75rem_minmax(0,1fr)_16.5rem]">
        <InputsColumn telemetry={telemetry} padName={padName} />
        <section className="relative min-h-[52vh] border-b border-border lg:border-r lg:border-b-0">
          <BikeCanvas
            telemetryRef={telemetryRef}
            hideForces={hideForces}
            inspect={inspect}
            poseRef={poseRef}
            motionRef={motionRef}
            travelRef={travelRef}
            liveRef={liveRef}
            connectRef={connectRef}
            padActiveRef={padActiveRef}
            sandboxRef={sandboxRef}
            eventRef={eventRef}
            forcesRef={forcesRef}
            hiddenRef={hiddenRef}
            driving={driving}
            showPadLabels={!graphOpen && !pov}
            harnessRef={harnessRef}
            ridePhaseRef={ridePhaseRef}
            pov={pov}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-2">
            <div className="flex max-w-full items-center gap-x-3 overflow-x-auto rounded-md border border-white/10 bg-black/55 px-2.5 py-1.5 font-mono text-[11px] text-white backdrop-blur-sm">
              <span className="max-w-[10rem] truncate text-amber-200">{bikeLabel}</span>
              <span className="text-sky-200">{step.title}</span>
              <span>{speedKph(telemetry.speedMs).toFixed(0)} km/h</span>
              <span>{Math.round(telemetry.rpm)}</span>
              <span>{gearLabel(telemetry.gear)}</span>
              <span className="text-white/35">·</span>
              <span>
                lean {telemetry.roll.toFixed(0)}° · pitch {telemetry.pitch.toFixed(0)}°
              </span>
              {usingLive ? (
                <>
                  <span className="text-white/35">·</span>
                  <span>Gx {formatG(telemetry.accelG.x)}</span>
                  <span>Gy {formatG(telemetry.accelG.y)}</span>
                  <span>Gz {formatG(telemetry.accelG.z)}</span>
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
            <Button size="xs" variant={pov ? "default" : "secondary"} onClick={() => setPov((v) => !v)}>
              <User />
              {pov ? "Garage" : "POV"}
            </Button>
            {pov ? null : (
              <Button size="xs" variant="secondary" onClick={() => setInspect((v) => !v)}>
                {inspect ? "Orbit" : "Lock"}
              </Button>
            )}
          </div>

          <div className="pointer-events-none absolute top-11 left-2 z-10 hidden font-mono text-[10px] text-white/70 sm:grid gap-1">
            <span className="text-amber-300">▲ FRONT</span>
            <span className="text-sky-300">▶ RIGHT</span>
            <span className="text-rose-300">◀ LEFT</span>
          </div>

          {!driving && liveState === "idle" ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-12 z-10 flex justify-center">
              <div className="max-w-sm rounded-md border border-white/10 bg-black/65 px-3 py-2 text-xs text-amber-50">
                <p className="font-medium text-amber-100">New here?</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-white/80">
                  <li>Start MX Bikes on this PC and go on track.</li>
                  <li>Press Connect. The bike stays parked until the game is live.</li>
                  <li>POV is first-person dynamic, same idea as MX Bikes.</li>
                </ol>
              </div>
            </div>
          ) : null}

          {graphOpen ? (
            <div className="absolute inset-x-0 bottom-0 z-20 h-[50%] min-h-[18rem] p-2 pt-0">
              <TelemetryGraph
                bufferRef={traceRef}
                live={usingLive}
                sheetHint={
                  logMode === "off"
                    ? sheetCount
                      ? `Stopped · ${sheetCount.toLocaleString()} rows · ${sheetSeconds.toFixed(1)}s`
                      : "Logging is off — Auto log or Start log"
                    : `${logMode === "auto" ? "Auto" : "Recording"} · ${sheetCount.toLocaleString()} rows · ${sheetSeconds.toFixed(1)}s`
                }
              />
            </div>
          ) : null}
        </section>

        <aside className="flex min-h-0 flex-col bg-card">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-3">
              {liveState === "idle" ? (
                <>
                  <p className="text-xs leading-4 text-muted-foreground">
                    {step.hint} Amber edge is the front of the deck. Start MX Bikes, go on track,
                    then Connect. The deck stays parked until MX Bikes is live.
                  </p>
                  <Button
                    size="sm"
                    className="w-full bg-sky-500 text-white hover:bg-sky-400"
                    onClick={() => {
                      setConnectRequested(true);
                      telemetryRef.current = restTelemetry({ rpm: 0 });
                      sandboxRef.current = { ...DEFAULT_SANDBOX };
                      padActiveRef.current = false;
                      motionRef.current = createMotionFilter();
                      poseRef.current = identityPose();
                      setHudTel(restTelemetry({ rpm: 0 }));
                      setPadOn(false);
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
                      clearTraceBuffer(traceRef.current);
                    }}
                  >
                    Disconnect
                  </Button>
                </>
              ) : null}

              <p className="font-mono text-[11px] leading-4 text-muted-foreground">{describeHarness(hudHarness)}</p>
              <NumberSlider
                label="Rod stroke"
                value={travel.rodStroke}
                min={0.08}
                max={0.55}
                step={0.01}
                display={`±${travel.rodStroke.toFixed(2)} m`}
                onChange={(rodStroke) => patchTravel({ rodStroke })}
              />

              <Button size="sm" variant={devOpen ? "default" : "outline"} onClick={() => setDevOpen((v) => !v)}>
                {devOpen ? <ChevronDown /> : <ChevronRight />}
                Dev
              </Button>

              {devOpen ? (
              <>
              <div className="grid gap-2">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Spreadsheet
                </p>
                <p className="text-xs leading-4 text-muted-foreground">
                  {logMode === "off"
                    ? sheetCount
                      ? `Stopped · ${sheetCount.toLocaleString()} rows · ${sheetSeconds.toFixed(1)} s`
                      : "Off until you press Auto log or Start log."
                    : logMode === "auto"
                      ? `Auto · ${sheetCount.toLocaleString()} rows · ${sheetSeconds.toFixed(1)} s`
                      : `Recording · ${sheetCount.toLocaleString()} rows · ${sheetSeconds.toFixed(1)} s`}
                </p>
                <p className="text-[11px] leading-4 text-muted-foreground">
                  Saves into the game plugins folder, next to the MX Bikes plugin.
                  {logDir ? ` ${logDir}` : ""}
                </p>
                {saveMsg ? <p className="text-[11px] leading-4 text-emerald-300">{saveMsg}</p> : null}
                <p className="text-[11px] leading-4 text-foreground/80">{describeLesson(lesson)}</p>
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    size="xs"
                    variant={graphOpen ? "default" : "outline"}
                    onClick={() => {
                      const next = !graphOpen;
                      setGraphOpen(next);
                      saveTraceOpen(next);
                    }}
                  >
                    <LineChart />
                    {graphOpen ? "Hide graph" : "Graph"}
                  </Button>
                  <Button size="xs" variant={hideForces ? "outline" : "default"} onClick={() => setHideForces((v) => !v)}>
                    {hideForces ? <Eye /> : <EyeOff />}
                    {hideForces ? "Show arrows" : "Hide arrows"}
                  </Button>
                  <Button
                    size="xs"
                    variant={logMode === "auto" ? "default" : "outline"}
                    onClick={() => setLogMode("auto")}
                  >
                    Auto log
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={logMode === "off"}
                    onClick={() => setLogMode("off")}
                  >
                    Stop log
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => void saveSheet()} disabled={sheetCount < 2 || saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    size="xs"
                    variant={logMode === "start" ? "default" : "outline"}
                    onClick={() => setLogMode("start")}
                  >
                    Start log
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  6DOF travel · {step.title}
                </p>
                <NumberSlider
                  label="Response"
                  value={travel.response}
                  min={0.1}
                  max={3}
                  step={0.05}
                  display={`${Math.round(travel.response * 100)}%`}
                  onChange={(response) => patchTravel({ response })}
                />
                <NumberSlider
                  label="Axis speed · slide"
                  value={travel.rateLin}
                  min={0.2}
                  max={6}
                  step={0.1}
                  display={`${travel.rateLin.toFixed(1)} m/s`}
                  onChange={(rateLin) => patchTravel({ rateLin })}
                />
                <NumberSlider
                  label="Axis speed · tilt"
                  value={travel.rateAng}
                  min={0.2}
                  max={6}
                  step={0.1}
                  display={`${((travel.rateAng * 180) / Math.PI).toFixed(0)} °/s`}
                  onChange={(rateAng) => patchTravel({ rateAng })}
                />
                <NumberSlider
                  label="Smooth"
                  value={travel.smoothTau}
                  min={0.01}
                  max={0.25}
                  step={0.005}
                  display={`${Math.round(travel.smoothTau * 1000)} ms`}
                  onChange={(smoothTau) => patchTravel({ smoothTau })}
                />
                <NumberSlider
                  label="Visual follow"
                  value={travel.visualTau}
                  min={0.01}
                  max={0.18}
                  step={0.005}
                  display={`${Math.round(travel.visualTau * 1000)} ms`}
                  onChange={(visualTau) => patchTravel({ visualTau })}
                />
                <NumberSlider
                  label="Roll · lean"
                  value={(travel.limitRoll * 180) / Math.PI}
                  min={0}
                  max={70}
                  step={1}
                  display={`${((travel.limitRoll * 180) / Math.PI).toFixed(0)}°`}
                  onChange={(deg) => patchTravel({ limitRoll: (deg * Math.PI) / 180 })}
                />
                <NumberSlider
                  label="Pitch · wheelie"
                  value={(travel.limitPitch * 180) / Math.PI}
                  min={0}
                  max={70}
                  step={1}
                  display={`${((travel.limitPitch * 180) / Math.PI).toFixed(0)}°`}
                  onChange={(deg) => patchTravel({ limitPitch: (deg * Math.PI) / 180 })}
                />
                <NumberSlider
                  label="Yaw · heading"
                  value={(travel.limitYaw * 180) / Math.PI}
                  min={0}
                  max={60}
                  step={1}
                  display={`${((travel.limitYaw * 180) / Math.PI).toFixed(0)}°`}
                  onChange={(deg) => patchTravel({ limitYaw: (deg * Math.PI) / 180 })}
                />
                <NumberSlider
                  label="Heave · up / down"
                  value={travel.limitY}
                  min={0}
                  max={2}
                  step={0.05}
                  display={`${travel.limitY.toFixed(2)} m`}
                  onChange={(limitY) => patchTravel({ limitY })}
                />
                <NumberSlider
                  label="Surge · fore / aft"
                  value={travel.limitZ}
                  min={0}
                  max={2}
                  step={0.05}
                  display={`${travel.limitZ.toFixed(2)} m`}
                  onChange={(limitZ) => patchTravel({ limitZ })}
                />
                <NumberSlider
                  label="Sway · left / right"
                  value={travel.limitX}
                  min={0}
                  max={2}
                  step={0.05}
                  display={`${travel.limitX.toFixed(2)} m`}
                  onChange={(limitX) => patchTravel({ limitX })}
                />
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    size="xs"
                    variant={travel.visualPitch < 0 ? "default" : "outline"}
                    onClick={() => patchTravel({ visualPitch: travel.visualPitch < 0 ? 1 : -1 })}
                  >
                    {travel.visualPitch < 0 ? "Wheelie nose-up" : "Wheelie flipped"}
                  </Button>
                  <Button
                    size="xs"
                    variant={travel.leanSign < 0 ? "default" : "outline"}
                    onClick={() => patchTravel({ leanSign: travel.leanSign < 0 ? 1 : -1 })}
                  >
                    {travel.leanSign < 0 ? "Lean camera-left" : "Lean flipped"}
                  </Button>
                  <Button
                    size="xs"
                    variant={travel.parkLock ? "default" : "outline"}
                    onClick={() => patchTravel({ parkLock: !travel.parkLock })}
                  >
                    {travel.parkLock ? "Parked stays level" : "Parked still tilts"}
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      const next = sanitizeTravel(STUDIO_TRAVEL);
                      setTravel(next);
                      saveStoredTravel(next);
                      saveStoredDof(next.dof);
                    }}
                  >
                    Reset travel
                  </Button>
                </div>
              </div>
              </>
              ) : null}
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
        el.current.textContent = [
          `R ${fmtDeg(pose.roll)}`,
          `P ${fmtDeg(pose.pitch)}`,
          `Y ${fmtM(pose.y)}`,
          `Z ${fmtM(pose.z)}`,
          `X ${fmtM(pose.x)}`,
          `Yw ${fmtDeg(pose.yaw)}`,
        ].join("  ");
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [poseRef]);
  return <span ref={el}>R +0°  P +0°</span>;
}

function InputsColumn({ telemetry, padName }: { telemetry: Telemetry; padName: string }) {
  const gp = readFirstGamepad();
  const rider = riderFromTelemetry(telemetry, readBodyStick(isRiderPad(gp) ? gp : null));
  const steerMax = 40;
  const steerT = Math.min(1, Math.max(-1, telemetry.steer / steerMax));
  const leanT = Math.min(1, Math.max(-1, rider.lean / 0.7));
  const leanDeg = (rider.lean * 180) / Math.PI;
  return (
    <aside className="flex min-h-0 flex-col gap-1.5 border-b border-border bg-card px-2.5 py-2 lg:border-b-0 lg:border-r">
      <div className="flex items-baseline justify-between gap-1">
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Inputs</p>
        {padName ? <p className="truncate text-[9px] text-muted-foreground">{padName}</p> : null}
      </div>
      <InputBar label="Thr" value={telemetry.throttle} fillClass="bg-emerald-400" />
      <InputBar label="F brk" value={telemetry.frontBrake} fillClass="bg-rose-500" />
      <InputBar label="R brk" value={telemetry.rearBrake} fillClass="bg-pink-400" />
      <InputBar label="Clh" value={telemetry.clutch} fillClass="bg-slate-300" />
      <SignedBar label="Str" value={steerT} display={`${telemetry.steer.toFixed(0)}°`} fillClass="bg-violet-400" />
      <InputBar
        label="Seat"
        value={rider.stand}
        fillClass="bg-amber-300"
        display={rider.stand > 0.45 ? "Stand" : "Sit"}
      />
      <SignedBar
        label="Lean"
        value={leanT}
        display={`${leanDeg >= 0 ? "+" : ""}${leanDeg.toFixed(0)}°`}
        fillClass="bg-sky-400"
      />
    </aside>
  );
}

function InputBar({
  label,
  value,
  fillClass,
  display,
}: {
  label: string;
  value: number;
  fillClass: string;
  display?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="grid gap-0.5">
      <div className="flex items-center justify-between text-[10px] tracking-wide text-muted-foreground uppercase">
        <span>{label}</span>
        <span className="font-mono text-foreground">{display ?? pct}</span>
      </div>
      <div className="relative h-7 overflow-hidden rounded-sm bg-muted">
        <div className={`absolute inset-x-1 bottom-0 rounded-sm ${fillClass}`} style={{ height: `${pct}%` }} />
      </div>
    </div>
  );
}

function SignedBar({
  label,
  value,
  display,
  fillClass,
}: {
  label: string;
  value: number;
  display: string;
  fillClass: string;
}) {
  const t = Math.min(1, Math.max(-1, value));
  return (
    <div className="grid gap-0.5">
      <div className="flex items-center justify-between text-[10px] tracking-wide text-muted-foreground uppercase">
        <span>{label}</span>
        <span className="font-mono text-foreground">{display}</span>
      </div>
      <div className="relative h-7 overflow-hidden rounded-sm bg-muted">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <div
          className={`absolute inset-x-1 rounded-sm ${fillClass}`}
          style={
            t >= 0
              ? { top: `${50 - Math.abs(t) * 50}%`, height: `${Math.abs(t) * 50}%` }
              : { top: "50%", height: `${Math.abs(t) * 50}%` }
          }
        />
      </div>
    </div>
  );
}
