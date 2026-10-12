"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Gamepad2, Loader2, Maximize2, Minimize2, PanelLeft, PanelRight, Radio, Square, Unplug, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  applyProfileToTelemetry,
  defaultProfile,
  loadProfile,
  lockParkedUnits,
  type BikeProfile,
} from "@/lib/mxb/adapt";
import { DEFAULT_EVENT, DEFAULT_SANDBOX, restTelemetry } from "@/lib/mxb/defaults";
import { speedKph } from "@/lib/mxb/forces";
import {
  describePad,
  isRiderPad,
  padTraceActive,
  readFirstGamepad,
  readPadTrace,
  setActivePadMap,
  type PadTrace,
} from "@/lib/mxb/gamepad";
import { DEFAULT_PAD_MAP, type PadMap } from "@/lib/mxb/mxb-binds";
import { newRecordingId, type RecordingFile, type RecordingMeta } from "@/lib/mxb/recording";
import {
  clockFromRecording,
  createReplaySync,
  stepReplaySync,
  type RecordingClock,
} from "@/lib/mxb/replay-sync";
import { DEFAULT_HIDDEN_PARTS, loadHiddenParts, saveHiddenParts } from "@/lib/mxb/exc-parts";
import { BikePartsPanel } from "@/components/visualizer/bike-parts-panel";
import type { ExcPartInfo } from "@/components/visualizer/exc-bike";
import { createRidePhaseFilter, describeRidePhase, detectCrash, type RidePhase } from "@/lib/mxb/crash";
import { setupLabel } from "@/lib/mxb/inputs";
import { saveStoredDof } from "@/lib/mxb/dof";
import { displayBikeName, holdLive, isPlaceholderBikeName, LIVE_HOLD_MS, stabilizeBikeEvent } from "@/lib/mxb/live-store";
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
import { applyLesson, emptyLesson, learnFromRows, type SheetLesson } from "@/lib/mxb/lesson";
import { idleHarness, type HarnessState } from "@/lib/mxb/harness";
import {
  createSheetBuffer,
  parseSheetCsv,
  pushSheetRow,
  readSheetRows,
  sheetDurationS,
  sheetFilename,
  sheetToCsv,
} from "@/lib/mxb/sheet";

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

export function MxForceStudio() {
  const [hideForces, setHideForces] = useState(true);
  const [livePacket, setLivePacket] = useState<LivePacket | null>(null);
  const [liveOk, setLiveOk] = useState(false);
  const [connectRequested, setConnectRequested] = useState(true);
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
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [widget, setWidget] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordings, setRecordings] = useState<RecordingMeta[]>([]);
  const [replayId, setReplayId] = useState("");
  const [syncName, setSyncName] = useState("");
  const [bikeParts, setBikeParts] = useState<ExcPartInfo[]>([]);
  const [hiddenParts, setHiddenParts] = useState<string[]>([]);
  const [padHud, setPadHud] = useState(() => readPadTrace(null));
  const [bindSource, setBindSource] = useState(DEFAULT_PAD_MAP.source);

  const pollRef = useRef<() => Promise<void>>(async () => {});
  const motionRef = useRef(createMotionFilter());
  const poseRef = useRef(identityPose());
  const travelRef = useRef(STUDIO_TRAVEL);
  const connectRef = useRef(connectRequested);
  const lastHudRef = useRef(0);
  const lastHarnessHud = useRef(0);
  const bikeLatchRef = useRef({ id: "", name: "" });
  const liveRef = useRef(false);
  const lastPublishedLiveRef = useRef(false);
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
  const lastLiveAt = useRef(0);
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
  const recBuf = useRef<RecordingFile["samples"]>([]);
  const recStarted = useRef(0);
  const replayRef = useRef<RecordingFile | null>(null);
  const replayIndex = useRef(0);
  const syncRef = useRef(createReplaySync());
  const replayIdRef = useRef("");
  const syncNameRef = useRef("");
  const recordingCache = useRef(new Map<string, RecordingFile>());
  const clocksReady = useRef(false);
  const clocksRef = useRef<RecordingClock[]>([]);
  const loadingClocks = useRef(false);
  const lastRecMs = useRef(0);
  const recordingRef = useRef(false);
  const replayClock = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const winGeom = useRef({ w: 0, h: 0, x: 0, y: 0 });
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
    fetch("/api/binds")
      .then((res) => res.json())
      .then((data: { map?: PadMap }) => {
        if (!data.map) return;
        setActivePadMap(data.map);
        setBindSource(data.map.source || DEFAULT_PAD_MAP.source);
      })
      .catch(() => {});
    fetch("/api/recordings")
      .then((res) => res.json())
      .then((data: { recordings?: RecordingMeta[] }) => {
        if (data.recordings) setRecordings(data.recordings);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const poke = () => {
      const gp = readFirstGamepad();
      setPadOn(Boolean(gp?.connected));
      if (gp) setPadName(describePad(gp));
    };
    window.addEventListener("gamepadconnected", poke);
    window.addEventListener("gamepaddisconnected", poke);
    poke();
    return () => {
      window.removeEventListener("gamepadconnected", poke);
      window.removeEventListener("gamepaddisconnected", poke);
    };
  }, []);

  useEffect(() => {
    connectRef.current = connectRequested;
    userTravelRef.current = travel;
    travelRef.current = travel;
    graphOpenRef.current = graphOpen;
    logModeRef.current = logMode;
    recordingRef.current = recording;
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
    setHiddenParts(loadHiddenParts());
  }, []);

  const onBikeParts = useCallback((parts: ExcPartInfo[]) => {
    setBikeParts(parts);
  }, []);

  const togglePart = (id: string) => {
    setHiddenParts((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      saveHiddenParts(next);
      return next;
    });
  };

  const toggleAssembly = (assembly: string) => {
    setHiddenParts((current) => {
      const ids = bikeParts.filter((part) => part.assembly === assembly).map((part) => part.id);
      const allHidden = ids.length > 0 && ids.every((id) => current.includes(id));
      const next = allHidden
        ? current.filter((id) => !ids.includes(id))
        : Array.from(new Set([...current, ...ids]));
      saveHiddenParts(next);
      return next;
    });
  };

  const showAllParts = () => {
    saveHiddenParts([]);
    setHiddenParts([]);
  };

  const stripParts = () => {
    const next = [...DEFAULT_HIDDEN_PARTS];
    saveHiddenParts(next);
    setHiddenParts(next);
  };

  const rememberRecording = (rec: RecordingFile) => {
    recordingCache.current.set(rec.id, rec);
    const clock = clockFromRecording(rec);
    clocksRef.current = clocksRef.current.filter((item) => item.id !== rec.id);
    if (clock) clocksRef.current.push(clock);
    clocksReady.current = true;
  };

  const ensureClocks = async () => {
    if (loadingClocks.current) return;
    loadingClocks.current = true;
    try {
      const res = await fetch("/api/recordings");
      const data = (await res.json()) as { recordings?: RecordingMeta[] };
      const metas = data.recordings ?? [];
      const files = await Promise.all(
        metas.map(async (meta) => {
          const cached = recordingCache.current.get(meta.id);
          if (cached) return cached;
          const fileRes = await fetch(`/api/recordings?id=${encodeURIComponent(meta.id)}`);
          const body = (await fileRes.json()) as { recording?: RecordingFile };
          if (body.recording) recordingCache.current.set(meta.id, body.recording);
          return body.recording;
        }),
      );
      const clocks: RecordingClock[] = [];
      for (const file of files) {
        if (!file) continue;
        const clock = clockFromRecording(file);
        if (clock) clocks.push(clock);
      }
      clocksRef.current = clocks;
      clocksReady.current = true;
    } catch {
      clocksReady.current = true;
    } finally {
      loadingClocks.current = false;
    }
  };

  useEffect(() => {
    void ensureClocks();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const gp = readFirstGamepad();
      const riderGp = isRiderPad(gp) ? gp : null;
      const padTrace = readPadTrace(riderGp);
      const padConnected = Boolean(riderGp?.connected);
      padActiveRef.current = padConnected;
      if (padConnected !== padOnRef.current) {
        padOnRef.current = padConnected;
        setPadOn(padConnected);
        if (padConnected) setLeftOpen(true);
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
      const rec = replayRef.current;
      if (rec && rec.samples.length > 0) {
        if (!replayClock.current) replayClock.current = now;
        const elapsed = now - replayClock.current;
        while (
          replayIndex.current < rec.samples.length - 1 &&
          rec.samples[replayIndex.current + 1].t <= elapsed
        ) {
          replayIndex.current += 1;
        }
        const sample = rec.samples[replayIndex.current];
        telemetryRef.current = sample.telemetry;
        liveRef.current = true;
        if (elapsed > rec.durationMs + 80) {
          replayClock.current = now;
          replayIndex.current = 0;
        }
      }
      if (recordingRef.current && now - lastRecMs.current >= 33) {
        lastRecMs.current = now;
        if (!recStarted.current) recStarted.current = now;
        recBuf.current.push({
          t: now - recStarted.current,
          telemetry: telemetryRef.current,
          pad: padTrace,
        });
      }
      const logPad = graphOpenRef.current || liveRef.current || padTraceActive(padTrace) || padConnected;
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
        setPadHud(padTrace);
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
      const incoming = body.packet?.telemetry;
      if (incoming && connectRef.current) {
        const wasFollowing = syncRef.current.following;
        const step = stepReplaySync(
          syncRef.current,
          incoming.time,
          incoming.position,
          clocksRef.current,
          clocksReady.current,
        );
        syncRef.current = step.sync;
        if (step.needsClocks) void ensureClocks();
        if (step.follow && step.recordingId) {
          const file = recordingCache.current.get(step.recordingId);
          const sample = file?.samples[step.index];
          if (sample) {
            replayRef.current = null;
            replayClock.current = 0;
            telemetryRef.current = sample.telemetry;
            liveRef.current = true;
            lastLiveAt.current = performance.now();
            if (replayIdRef.current !== step.recordingId) {
              replayIdRef.current = step.recordingId;
              setReplayId(step.recordingId);
            }
            if (syncNameRef.current !== (file?.name ?? "Replay")) {
              syncNameRef.current = file?.name ?? "Replay";
              setSyncName(file?.name ?? "Replay");
            }
            return;
          }
        } else if (wasFollowing) {
          syncNameRef.current = "";
          setSyncName("");
          replayIdRef.current = "";
          setReplayId("");
        }
      }
      if (replayRef.current) return;
      const wantLive = connectRef.current;
      const streamLive = wantLive && holdLive(body.staleMs, body.live, Boolean(body.packet?.telemetry));
      if (streamLive && body.packet?.telemetry) {
        liveRef.current = true;
        lastLiveAt.current = performance.now();
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
        if (!wantLive) liveRef.current = false;
        else if (lastLiveAt.current && performance.now() - lastLiveAt.current > LIVE_HOLD_MS) {
          liveRef.current = false;
        }
        const reallyGone = !wantLive || (body.staleMs != null && body.staleMs > LIVE_HOLD_MS);
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
  const replaying = Boolean(replayId);

  const refreshRecordings = async () => {
    try {
      const res = await fetch("/api/recordings");
      const data = (await res.json()) as { recordings?: RecordingMeta[] };
      if (data.recordings) setRecordings(data.recordings);
    } catch {
      /* ignore */
    }
  };

  const toggleRecord = async () => {
    if (recording) {
      recordingRef.current = false;
      setRecording(false);
      const samples = recBuf.current;
      recBuf.current = [];
      recStarted.current = 0;
      if (samples.length < 2) return;
      const rec: RecordingFile = {
        id: newRecordingId(),
        name: displayBikeName(eventRef.current) || "Ride",
        startedAt: Date.now(),
        durationMs: samples[samples.length - 1]?.t ?? 0,
        samples,
      };
      try {
        await fetch("/api/recordings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rec),
        });
        rememberRecording(rec);
        await refreshRecordings();
      } catch {
        /* ignore */
      }
      return;
    }
    recBuf.current = [];
    recStarted.current = 0;
    lastRecMs.current = 0;
    recordingRef.current = true;
    setReplayId("");
    replayRef.current = null;
    replayClock.current = 0;
    setRecording(true);
  };

  const playRecording = async (id: string) => {
    if (replayId === id && !syncName) {
      setReplayId("");
      replayIdRef.current = "";
      replayRef.current = null;
      replayClock.current = 0;
      replayIndex.current = 0;
      return;
    }
    try {
      const res = await fetch(`/api/recordings?id=${encodeURIComponent(id)}`);
      const data = (await res.json()) as { recording?: RecordingFile };
      if (!data.recording) return;
      replayRef.current = data.recording;
      rememberRecording(data.recording);
      replayIndex.current = 0;
      replayClock.current = 0;
      syncRef.current = { ...syncRef.current, following: false, recordingId: null };
      syncNameRef.current = "";
      setSyncName("");
      replayIdRef.current = id;
      setReplayId(id);
      setRecording(false);
      recordingRef.current = false;
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (widget) {
      winGeom.current = { w: window.outerWidth, h: window.outerHeight, x: window.screenX, y: window.screenY };
      try {
        window.resizeTo(460, 300);
        window.moveTo(
          Math.max(16, window.screen.availWidth - 480),
          Math.max(16, window.screen.availHeight - 340),
        );
      } catch {
        /* some app windows ignore resizeTo */
      }
    } else if (winGeom.current.w > 0) {
      try {
        window.resizeTo(winGeom.current.w, winGeom.current.h);
        window.moveTo(winGeom.current.x, winGeom.current.y);
      } catch {
        /* ignore */
      }
    }
  }, [widget]);

  const toggleFullscreen = async () => {
    const node = stageRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      {widget ? null : (
      <header className="flex items-center gap-2 border-b border-border px-2 py-1.5">
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
              clearTraceBuffer(traceRef.current);
            } else {
              setConnectRequested(true);
              telemetryRef.current = restTelemetry({ rpm: 0 });
              sandboxRef.current = { ...DEFAULT_SANDBOX };
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
      )}

      <div
        ref={stageRef}
        className="relative min-h-0 flex-1"
      >
      <section className="relative h-full min-h-0">
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
            showPadLabels={false}
            harnessRef={harnessRef}
            ridePhaseRef={ridePhaseRef}
            pov={pov}
            hiddenParts={hiddenParts}
            onParts={onBikeParts}
          />

          <div className="absolute top-2 left-2 z-30 flex items-center gap-1">
            <Button
              size="xs"
              variant={recording ? "destructive" : "secondary"}
              onClick={() => void toggleRecord()}
            >
              {recording ? <Square className="size-3 fill-current" /> : <Circle className="size-3 fill-red-500 text-red-500" />}
              {recording ? "Stop" : "Rec"}
            </Button>
            <Button size="xs" variant="secondary" onClick={() => void toggleFullscreen()} aria-label="Fullscreen">
              <Maximize2 />
            </Button>
            <Button size="xs" variant={widget ? "default" : "secondary"} onClick={() => setWidget((v) => !v)} aria-label="Widget">
              <Minimize2 />
            </Button>
          </div>

          {widget ? null : (
          <div className="pointer-events-none absolute inset-x-28 top-2 z-10">
            <div className="mx-auto flex max-w-fit items-center gap-x-2 overflow-x-auto rounded-md border border-white/10 bg-black/45 px-2 py-1 font-mono text-[10px] text-white/90 backdrop-blur-sm">
              <span className="max-w-[8rem] truncate text-amber-200">{bikeLabel}</span>
              <span>{speedKph(telemetry.speedMs).toFixed(0)}</span>
              <span>{gearLabel(telemetry.gear)}</span>
              {syncName ? <span className="text-amber-300">Sync {syncName}</span> : replaying ? <span className="text-sky-300">Replay</span> : null}
            </div>
          </div>
          )}

          {widget ? null : (
          <div className="absolute top-2 right-2 z-20 flex gap-1">
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
          )}

          {widget ? null : (
          <>
          <button
            type="button"
            className={`absolute top-1/2 z-40 -translate-y-1/2 rounded-r-md border border-white/15 bg-black/70 p-1.5 text-white ${leftOpen ? "left-40" : "left-0"}`}
            onClick={() => setLeftOpen((v) => !v)}
            aria-label="Inputs panel"
          >
            <PanelLeft className="size-4" />
          </button>
          <button
            type="button"
            className={`absolute top-1/2 z-40 -translate-y-1/2 rounded-l-md border border-white/15 bg-black/70 p-1.5 text-white ${rightOpen ? "right-64" : "right-0"}`}
            onClick={() => setRightOpen((v) => !v)}
            aria-label="Session panel"
          >
            <PanelRight className="size-4" />
          </button>

          <div
            className={`absolute inset-y-0 left-0 z-30 w-40 border-r border-white/10 bg-card/95 shadow-xl backdrop-blur-sm transition-transform ${
              leftOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <InputsColumn telemetry={telemetry} padName={padName} pad={padHud} />
          </div>
          </>
          )}
        </section>

        {widget ? null : (
        <aside
          className={`absolute inset-y-0 right-0 z-30 flex w-64 min-h-0 flex-col border-l border-white/10 bg-card/95 shadow-xl backdrop-blur-sm transition-transform ${
            rightOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-3">
              {liveState === "idle" ? (
                <>
                  <p className="text-xs leading-4 text-muted-foreground">
                    Start MX Bikes on this PC and go on track. Live is already on.
                  </p>
                  <Button
                    size="sm"
                    className="w-full bg-sky-500 text-white hover:bg-sky-400"
                    onClick={() => {
                      setConnectRequested(true);
                      telemetryRef.current = restTelemetry({ rpm: 0 });
                      sandboxRef.current = { ...DEFAULT_SANDBOX };
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
                    {staleMs != null && staleMs <= 5000 ? ` · ${fmtAge(staleMs)} ago` : ""}
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

              {bindSource ? (
                <p className="text-[10px] leading-4 text-muted-foreground">Binds: {bindSource}</p>
              ) : null}

              <BikePartsPanel
                parts={bikeParts}
                hidden={new Set(hiddenParts)}
                onToggle={togglePart}
                onToggleAssembly={toggleAssembly}
                onShowAll={showAllParts}
                onStrip={stripParts}
              />

              {syncName ? (
                <p className="text-[11px] leading-4 text-amber-200">
                  MX Bikes replay is driving “{syncName}”. Session time keeps the take on the same moment.
                </p>
              ) : null}

              <div className="grid gap-1.5">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Recordings
                </p>
                {recordings.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Hit Rec (top left) while you ride.</p>
                ) : (
                  recordings.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-md border px-2 py-1 text-left text-[11px] ${
                        replayId === item.id ? "border-sky-400 bg-sky-500/15" : "border-border"
                      }`}
                      onClick={() => void playRecording(item.id)}
                    >
                      <span className="truncate">{item.name}</span>
                      <span className="font-mono text-muted-foreground">
                        {(item.durationMs / 1000).toFixed(1)}s
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </ScrollArea>
        </aside>
        )}
      </div>
    </div>
  );
}

function InputsColumn({
  telemetry,
  padName,
  pad,
}: {
  telemetry: Telemetry;
  padName: string;
  pad: PadTrace;
}) {
  const usePad = pad.connected;
  const throttle = usePad ? pad.throttle : telemetry.throttle;
  const frontBrake = usePad ? pad.frontBrake : telemetry.frontBrake;
  const rearBrake = usePad ? pad.rearBrake : telemetry.rearBrake;
  const clutch = usePad ? pad.clutch : telemetry.clutch;
  const steerT = usePad ? pad.lx : Math.min(1, Math.max(-1, telemetry.steer / 40));
  const steerDisplay = usePad ? pad.lx.toFixed(2) : `${telemetry.steer.toFixed(0)}°`;
  const leanT = usePad ? pad.rx : Math.min(1, Math.max(-1, telemetry.roll / 45));
  const sitT = usePad ? pad.sit : 0;
  return (
    <aside className="flex h-full min-h-0 flex-col gap-1.5 px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-1">
        <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Inputs</p>
        <p className="truncate text-[9px] text-muted-foreground">{pad.connected ? padName || "Pad" : "Off"}</p>
      </div>
      <InputBar label="Thr" value={throttle} fillClass="bg-emerald-400" />
      <InputBar label="F brk" value={frontBrake} fillClass="bg-rose-500" />
      <InputBar label="R brk" value={rearBrake} fillClass="bg-pink-400" />
      <InputBar label="Clh" value={clutch} fillClass="bg-slate-300" />
      <SignedBar label="Str" value={steerT} display={steerDisplay} fillClass="bg-violet-400" />
      <SignedBar
        label="Sit"
        value={sitT}
        display={sitT >= 0 ? `Aft ${sitT.toFixed(2)}` : `Fwd ${(-sitT).toFixed(2)}`}
        fillClass="bg-amber-300"
      />
      <SitStandBar stand={usePad ? pad.stand : 0} />
      <SignedBar
        label="Lean"
        value={leanT}
        display={usePad ? pad.rx.toFixed(2) : `${telemetry.roll.toFixed(0)}°`}
        fillClass="bg-sky-400"
      />
    </aside>
  );
}

function SitStandBar({ stand }: { stand: number }) {
  const t = Math.min(1, Math.max(0, stand));
  const pct = Math.round(t * 100);
  return (
    <div className="grid gap-0.5">
      <div className="flex items-center justify-between text-[10px] tracking-wide text-muted-foreground uppercase">
        <span>Sit</span>
        <span className="font-mono text-foreground">{pct >= 50 ? `Stand ${pct}` : `Sit ${100 - pct}`}</span>
        <span>Stand</span>
      </div>
      <div className="relative h-7 overflow-hidden rounded-sm bg-muted">
        <div className="absolute inset-y-1 left-1 rounded-sm bg-amber-300" style={{ width: `${Math.max(3, t * 92)}%` }} />
      </div>
    </div>
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
