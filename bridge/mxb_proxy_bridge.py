"""Forward MX Bikes proxy shared memory (or a JSON UDP stream) into the visualizer.

Run this on the Windows PC that is playing MX Bikes:

    python mxb_proxy_bridge.py --url http://127.0.0.1:43187/api/telemetry

MX Bikes already ships proxy64.dlo. It writes SProxyData_t to
Local\\MXBProxyObject while you are on track.

If shared memory cannot be opened, the bridge also listens for UDP JSON on
--udp-port (default 47387) so a custom plugin can push the same payload.
"""

from __future__ import annotations

import argparse
import json
import mmap
import socket
import sys
import time
import urllib.error
import urllib.request
from ctypes import (
    Structure,
    c_char,
    c_float,
    c_int,
    sizeof,
)

PROXY_NAME = "Local\\MXBProxyObject"


class SPluginsBikeEvent_t(Structure):
    _fields_ = [
        ("m_szRiderName", c_char * 100),
        ("m_szBikeID", c_char * 100),
        ("m_szBikeName", c_char * 100),
        ("m_iNumberOfGears", c_int),
        ("m_iMaxRPM", c_int),
        ("m_iLimiter", c_int),
        ("m_iShiftRPM", c_int),
        ("m_fEngineOptTemperature", c_float),
        ("m_afEngineTemperatureAlarm", c_float * 2),
        ("m_fMaxFuel", c_float),
        ("m_afSuspMaxTravel", c_float * 2),
        ("m_fSteerLock", c_float),
        ("m_szCategory", c_char * 100),
        ("m_szTrackID", c_char * 100),
        ("m_szTrackName", c_char * 100),
        ("m_fTrackLength", c_float),
        ("m_iType", c_int),
    ]


class SPluginsBikeSession_t(Structure):
    _fields_ = [
        ("m_iSession", c_int),
        ("m_iConditions", c_int),
        ("m_fAirTemperature", c_float),
        ("m_szSetupFileName", c_char * 100),
    ]


class SPluginsBikeData_t(Structure):
    _fields_ = [
        ("m_iRPM", c_int),
        ("m_fEngineTemperature", c_float),
        ("m_fWaterTemperature", c_float),
        ("m_iGear", c_int),
        ("m_fFuel", c_float),
        ("m_fSpeedometer", c_float),
        ("m_fPosX", c_float),
        ("m_fPosY", c_float),
        ("m_fPosZ", c_float),
        ("m_fVelocityX", c_float),
        ("m_fVelocityY", c_float),
        ("m_fVelocityZ", c_float),
        ("m_fAccelerationX", c_float),
        ("m_fAccelerationY", c_float),
        ("m_fAccelerationZ", c_float),
        ("m_aafRot", c_float * 9),
        ("m_fYaw", c_float),
        ("m_fPitch", c_float),
        ("m_fRoll", c_float),
        ("m_fYawVelocity", c_float),
        ("m_fPitchVelocity", c_float),
        ("m_fRollVelocity", c_float),
        ("m_afSuspLength", c_float * 2),
        ("m_afSuspVelocity", c_float * 2),
        ("m_iCrashed", c_int),
        ("m_fSteer", c_float),
        ("m_fThrottle", c_float),
        ("m_fFrontBrake", c_float),
        ("m_fRearBrake", c_float),
        ("m_fClutch", c_float),
        ("m_afWheelSpeed", c_float * 2),
        ("m_aiWheelMaterial", c_int * 2),
        ("m_afBrakePressure", c_float * 2),
        ("m_fSteerTorque", c_float),
    ]


class SPluginsBikeLap_t(Structure):
    _fields_ = [
        ("m_iLapNum", c_int),
        ("m_iInvalid", c_int),
        ("m_iLapTime", c_int),
        ("m_iBest", c_int),
    ]


class SPluginsBikeSplit_t(Structure):
    _fields_ = [
        ("m_iSplit", c_int),
        ("m_iSplitTime", c_int),
        ("m_iBestDiff", c_int),
    ]


class SProxyData_t(Structure):
    _fields_ = [
        ("m_iVersion", c_int),
        ("m_iState", c_int),
        ("m_sEvent", SPluginsBikeEvent_t),
        ("m_sSession", SPluginsBikeSession_t),
        ("m_sLap", SPluginsBikeLap_t),
        ("m_iSplit", c_int),
        ("m_sSplit", SPluginsBikeSplit_t),
        ("m_sData", SPluginsBikeData_t),
        ("m_fTime", c_float),
        ("m_fPos", c_float),
        ("m_fCurLapTime", c_float),
    ]


def _c_str(value: bytes) -> str:
    return value.split(b"\x00", 1)[0].decode("utf-8", errors="ignore")


def packet_from_proxy(proxy: SProxyData_t) -> dict:
    event = proxy.m_sEvent
    session = proxy.m_sSession
    data = proxy.m_sData
    return {
        "state": int(proxy.m_iState),
        "event": {
            "riderName": _c_str(event.m_szRiderName),
            "bikeId": _c_str(event.m_szBikeID),
            "bikeName": _c_str(event.m_szBikeName) or "MX Bikes",
            "gears": int(event.m_iNumberOfGears),
            "maxRpm": int(event.m_iMaxRPM),
            "limiter": int(event.m_iLimiter),
            "shiftRpm": int(event.m_iShiftRPM),
            "maxFuel": float(event.m_fMaxFuel),
            "suspMaxTravel": [float(event.m_afSuspMaxTravel[0]), float(event.m_afSuspMaxTravel[1])],
            "steerLock": float(event.m_fSteerLock),
            "category": _c_str(event.m_szCategory),
            "trackId": _c_str(event.m_szTrackID),
            "trackName": _c_str(event.m_szTrackName),
            "trackLength": float(event.m_fTrackLength),
        },
        "session": {
            "session": int(session.m_iSession),
            "conditions": int(session.m_iConditions),
            "airTemperature": float(session.m_fAirTemperature),
            "setupFileName": _c_str(session.m_szSetupFileName),
        },
        "telemetry": {
            "rpm": int(data.m_iRPM),
            "engineTemp": float(data.m_fEngineTemperature),
            "waterTemp": float(data.m_fWaterTemperature),
            "gear": int(data.m_iGear),
            "fuel": float(data.m_fFuel),
            "speedMs": float(data.m_fSpeedometer),
            "position": {
                "x": float(data.m_fPosX),
                "y": float(data.m_fPosY),
                "z": float(data.m_fPosZ),
            },
            "velocity": {
                "x": float(data.m_fVelocityX),
                "y": float(data.m_fVelocityY),
                "z": float(data.m_fVelocityZ),
            },
            "accelG": {
                "x": float(data.m_fAccelerationX),
                "y": float(data.m_fAccelerationY),
                "z": float(data.m_fAccelerationZ),
            },
            "yaw": float(data.m_fYaw),
            "pitch": float(data.m_fPitch),
            "roll": float(data.m_fRoll),
            "yawRate": float(data.m_fYawVelocity),
            "pitchRate": float(data.m_fPitchVelocity),
            "rollRate": float(data.m_fRollVelocity),
            "suspLength": [float(data.m_afSuspLength[0]), float(data.m_afSuspLength[1])],
            "suspVelocity": [float(data.m_afSuspVelocity[0]), float(data.m_afSuspVelocity[1])],
            "crashed": bool(data.m_iCrashed),
            "steer": float(data.m_fSteer),
            "throttle": float(data.m_fThrottle),
            "frontBrake": float(data.m_fFrontBrake),
            "rearBrake": float(data.m_fRearBrake),
            "clutch": float(data.m_fClutch),
            "wheelSpeed": [float(data.m_afWheelSpeed[0]), float(data.m_afWheelSpeed[1])],
            "wheelMaterial": [int(data.m_aiWheelMaterial[0]), int(data.m_aiWheelMaterial[1])],
            "brakePressureKpa": [
                float(data.m_afBrakePressure[0]),
                float(data.m_afBrakePressure[1]),
            ],
            "steerTorqueNm": float(data.m_fSteerTorque),
            "time": float(proxy.m_fTime),
            "trackPos": float(proxy.m_fPos),
        },
    }


def post_packet(url: str, payload: dict) -> None:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=1.5) as response:
        response.read()


def open_proxy_map():
    size = sizeof(SProxyData_t)
    try:
        return mmap.mmap(-1, size, tagname=PROXY_NAME, access=mmap.ACCESS_READ)
    except (OSError, ValueError, AttributeError):
        return None


def read_proxy(mapping) -> SProxyData_t | None:
    mapping.seek(0)
    blob = mapping.read(sizeof(SProxyData_t))
    if len(blob) < sizeof(SProxyData_t):
        return None
    proxy = SProxyData_t.from_buffer_copy(blob)
    return proxy


def bind_udp(port: int) -> socket.socket:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", port))
    sock.settimeout(0.05)
    return sock


def main() -> int:
    parser = argparse.ArgumentParser(description="MX Bikes → Force Studio bridge")
    parser.add_argument("--url", default="http://127.0.0.1:43187/api/telemetry")
    parser.add_argument("--hz", type=float, default=20.0)
    parser.add_argument("--udp-port", type=int, default=47387)
    args = parser.parse_args()

    print(f"SProxyData_t size = {sizeof(SProxyData_t)} bytes")
    mapping = open_proxy_map()
    if mapping:
        print(f"Opened {PROXY_NAME}")
    else:
        print(
            "Could not open Local\\MXBProxyObject. "
            "Start MX Bikes on this Windows PC, or send JSON UDP to "
            f"port {args.udp_port}.",
            file=sys.stderr,
        )

    udp = bind_udp(args.udp_port)
    print(f"UDP JSON listener on 0.0.0.0:{args.udp_port}")
    print(f"Posting to {args.url} at {args.hz} Hz")

    interval = 1.0 / max(args.hz, 1.0)
    last_send = 0.0

    while True:
        payload = None
        try:
            raw, _addr = udp.recvfrom(65535)
            payload = json.loads(raw.decode("utf-8"))
        except TimeoutError:
            payload = None
        except json.JSONDecodeError:
            payload = None

        if payload is None and mapping is not None:
            proxy = read_proxy(mapping)
            if proxy is not None and proxy.m_iState >= 1:
                payload = packet_from_proxy(proxy)

        now = time.time()
        if payload and now - last_send >= interval:
            try:
                post_packet(args.url, payload)
                last_send = now
            except urllib.error.URLError as exc:
                print(f"POST failed: {exc}", file=sys.stderr)
                time.sleep(0.4)
        else:
            time.sleep(0.01)


if __name__ == "__main__":
    raise SystemExit(main())
