"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Eye, EyeOff, Download, Gamepad2, LineChart, Loader2, Radio, Sparkles, Unplug, Upload } from "lucide-react";
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
import { gamepadActive, padTraceActive, readFirstGamepad, readPadTrace } from "@/lib/mxb/gamepad";
import { detectCrash } from "@/lib/mxb/crash";
import { setupLabel } from "@/lib/mxb/inputs";
import {
  DOF_STEPS,
  clampDof,
  dofAxes,
  dofStep,
  saveStoredDof,
  type DofLevel,
} from "@/lib/mxb/dof";
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
import {
  applyLesson,
  describeLesson,
  emptyLesson,
  learnFromRows,
  type SheetLesson,
} from "@/lib/mxb/lesson";
import {
  clearSheetBuffer,
  createSheetBuffer,
  downloadSheetCsv,
  loadAutoLearn,
  parseSheetCsv,
  pushSheetRow,
  readSheetRows,
  saveAutoLearn,
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
  const [driving, setDriving] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [autoLearn, setAutoLearn] = useState(true);
  const [sheetCount, setSheetCount] = useState(0);
  const [sheetSeconds, setSheetSeconds] = useState(0);
  const [lesson, setLesson] = useState<SheetLesson>(() => emptyLesson());

  const pollRef = useRef<() => Promise<void>>(async () => {});
  const motionRef = useRef(createMotionFilter());
  const poseRef = useRef(identityPose());
  const travelRef = useRef(STUDIO_TRAVEL);
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
  const userTravelRef = useRef(STUDIO_TRAVEL);
  const drivingRef = useRef(false);
  const padOnRef = useRef(false);
  const lastPublishedLiveRef = useRef(false);
  const traceRef = useRef(createTraceBuffer(900));
  const lastTraceMs = useRef(0);
  const graphOpenRef = useRef(false);
  const sheetRef = useRef(createSheetBuffer(24000));
  const lastSheetMs = useRef(0);
  const lastLearnMs = useRef(0);
  const lastSignFlipMs = useRef(0);
  const autoLearnRef = useRef(true);
  const lessonRef = useRef<SheetLesson>(emptyLesson());
  const sheetFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadStoredTravel(STUDIO_TRAVEL);
    setTravel(stored);
    setGraphOpen(loadTraceOpen(false));
    setAutoLearn(loadAutoLearn(true));
  }, []);

  useEffect(() => {
    connectRef.current = connectRequested;
    userTravelRef.current = travel;
    travelRef.current = travel;
    graphOpenRef.current = graphOpen;
    autoLearnRef.current = autoLearn;
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

  const setDof = (dof: DofLevel) => {
    patchTravel({ dof: clampDof(dof) });
  };

  const exportSheet = () => {
    const csv = sheetToCsv(sheetRef.current);
    downloadSheetCsv(csv, sheetFilename(displayBikeName(eventRef.current) || "session"));
  };

  const runLearn = (rows = readSheetRows(sheetRef.current, 8000), allowSignFlip = true) => {
    const nextLesson = learnFromRows(rows, {
      visualPitch: travelRef.current.visualPitch,
      leanSign: travelRef.current.leanSign,
      dtMs: 40,
    });
    lessonRef.current = nextLesson;
    setLesson(nextLesson);
    const patched = applyLesson(travelRef.current, nextLesson, { allowSignFlip, slew: 0.55 });
    if (allowSignFlip) lastSignFlipMs.current = performance.now();
    setTravel(patched);
    saveStoredTravel(patched);
    saveStoredDof(patched.dof);
  };

  const loadSheetFile = async (file: File) => {
    const text = await file.text();
    const rows = parseSheetCsv(text);
    if (!rows.length) {
      setLesson({ ...emptyLesson(), notes: ["That spreadsheet had no usable rows."] });
      return;
    }
    runLearn(rows, true);
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      const gp = readFirstGamepad();
      const padTrace = readPadTrace(gp);
      let pad = padActiveRef.current;
      if (!liveRef.current && !connectRef.current) {
        pad = Boolean(gp && gamepadActive(gp)) || pad;
      } else {
        pad = false;
        padActiveRef.current = false;
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
      if (nextDriving && now - lastSheetMs.current >= 40) {
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
        autoLearnRef.current &&
        nextDriving &&
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
  const dof = clampDof(travel.dof);
  const axes = dofAxes(dof);
  const step = dofStep(dof);

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
              clearSheetBuffer(sheetRef.current);
              setSheetCount(0);
              setSheetSeconds(0);
              setLesson(emptyLesson());
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
            connectRef={connectRef}
            padActiveRef={padActiveRef}
            sandboxRef={sandboxRef}
            eventRef={eventRef}
            forcesRef={forcesRef}
            hiddenRef={hiddenRef}
            driving={driving}
            showPadLabels={!graphOpen}
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
                <PoseReadout poseRef={poseRef} dof={dof} />
              </span>
            </div>
          </div>

          <div className="absolute top-11 right-2 z-20 flex gap-1">
            <Button
              size="xs"
              variant={graphOpen ? "default" : "secondary"}
              onClick={() => {
                const next = !graphOpen;
                setGraphOpen(next);
                saveTraceOpen(next);
              }}
            >
              <LineChart />
              {graphOpen ? "Hide graph" : "Graph"}
            </Button>
            <Button size="xs" variant="secondary" onClick={exportSheet} disabled={sheetCount < 2}>
              <Download />
              Sheet
            </Button>
            <Button size="xs" variant={hideForces ? "default" : "secondary"} onClick={() => setHideForces((v) => !v)}>
              {hideForces ? <Eye /> : <EyeOff />}
              {hideForces ? "Show arrows" : "Hide arrows"}
            </Button>
            <Button size="xs" variant="secondary" onClick={() => setInspect((v) => !v)}>
              {inspect ? "Orbit" : "Lock"}
            </Button>
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
                  <li>Press Connect. The pad stays with the game.</li>
                  <li>6DOF is on. Use the sliders if the deck feels small.</li>
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
                  sheetCount
                    ? `${sheetCount.toLocaleString()} rows · ${sheetSeconds.toFixed(1)}s · ${describeLesson(lesson)}`
                    : "Ride to fill the spreadsheet"
                }
                onDownload={exportSheet}
                onLearn={() => runLearn()}
              />
            </div>
          ) : (
            <InputsOverlay telemetry={telemetry} />
          )}
        </section>

        <aside className="flex min-h-0 flex-col bg-card">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-3">
              <DofPicker dof={dof} onChange={setDof} />

              {liveState === "idle" ? (
                <>
                  <p className="text-xs leading-4 text-muted-foreground">
                    {step.hint} Amber edge is the front of the deck. Start MX Bikes, go on track,
                    then Connect. Xbox: RT gas, LT front brake, LB rear, pull stick back to wheelie.
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
                      clearSheetBuffer(sheetRef.current);
                      setSheetCount(0);
                      setSheetSeconds(0);
                      setLesson(emptyLesson());
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

              {padOn && !usingLive ? (
                <p className="text-[11px] text-muted-foreground">
                  Xbox pad driving the frame — RT throttle, LT front brake, LB rear, left stick steer/lean
                </p>
              ) : null}

              <div className="grid gap-2">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Spreadsheet
                </p>
                <p className="text-xs leading-4 text-muted-foreground">
                  {sheetCount
                    ? `${sheetCount.toLocaleString()} rows · ${sheetSeconds.toFixed(1)} s logged`
                    : "Ride or use the pad — every channel is written to a CSV."}
                </p>
                <p className="text-[11px] leading-4 text-foreground/80">{describeLesson(lesson)}</p>
                <div className="grid grid-cols-2 gap-1">
                  <Button size="xs" variant="secondary" onClick={exportSheet} disabled={sheetCount < 2}>
                    <Download />
                    Download CSV
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => runLearn()} disabled={sheetCount < 16}>
                    <Sparkles />
                    Learn now
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => sheetFileRef.current?.click()}>
                    <Upload />
                    Load CSV
                  </Button>
                  <Button
                    size="xs"
                    variant={autoLearn ? "default" : "outline"}
                    onClick={() => {
                      const next = !autoLearn;
                      setAutoLearn(next);
                      saveAutoLearn(next);
                    }}
                  >
                    {autoLearn ? "Auto-learn on" : "Auto-learn off"}
                  </Button>
                </div>
                <input
                  ref={sheetFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void loadSheetFile(file);
                  }}
                />
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
                {axes.yaw ? (
                  <NumberSlider
                    label="Yaw · heading"
                    value={(travel.limitYaw * 180) / Math.PI}
                    min={0}
                    max={60}
                    step={1}
                    display={`${((travel.limitYaw * 180) / Math.PI).toFixed(0)}°`}
                    onChange={(deg) => patchTravel({ limitYaw: (deg * Math.PI) / 180 })}
                  />
                ) : null}
                {axes.y ? (
                  <NumberSlider
                    label="Heave · up / down"
                    value={travel.limitY}
                    min={0}
                    max={2}
                    step={0.05}
                    display={`${travel.limitY.toFixed(2)} m`}
                    onChange={(limitY) => patchTravel({ limitY })}
                  />
                ) : null}
                {axes.z ? (
                  <NumberSlider
                    label="Surge · fore / aft"
                    value={travel.limitZ}
                    min={0}
                    max={2}
                    step={0.05}
                    display={`${travel.limitZ.toFixed(2)} m`}
                    onChange={(limitZ) => patchTravel({ limitZ })}
                  />
                ) : null}
                {axes.x ? (
                  <NumberSlider
                    label="Sway · left / right"
                    value={travel.limitX}
                    min={0}
                    max={2}
                    step={0.05}
                    display={`${travel.limitX.toFixed(2)} m`}
                    onChange={(limitX) => patchTravel({ limitX })}
                  />
                ) : null}
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

function PoseReadout({ poseRef, dof }: { poseRef: MutableRefObject<Pose6>; dof: DofLevel }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const pose = poseRef.current;
      const axes = dofAxes(dof);
      if (el.current) {
        const parts = [`R ${fmtDeg(pose.roll)}`, `P ${fmtDeg(pose.pitch)}`];
        if (axes.y) parts.push(`Y ${fmtM(pose.y)}`);
        if (axes.z) parts.push(`Z ${fmtM(pose.z)}`);
        if (axes.x) parts.push(`X ${fmtM(pose.x)}`);
        if (axes.yaw) parts.push(`Yw ${fmtDeg(pose.yaw)}`);
        el.current.textContent = parts.join("  ");
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [poseRef, dof]);
  return <span ref={el}>R +0°  P +0°</span>;
}

function DofPicker({ dof, onChange }: { dof: DofLevel; onChange: (dof: DofLevel) => void }) {
  return (
    <div className="grid gap-2">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        Motion axes · 6DOF on
      </p>
      <div className="grid grid-cols-5 gap-1">
        {DOF_STEPS.map((item) => (
          <Button
            key={item.dof}
            size="xs"
            variant={item.dof === dof ? "default" : "outline"}
            onClick={() => onChange(item.dof)}
          >
            {item.dof}
          </Button>
        ))}
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">{dofStep(dof).hint}</p>
    </div>
  );
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
