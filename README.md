# MX Bikes Force Studio

A garage visualizer for [MX Bikes](https://www.mx-bikes.com/). The bike stays put. The arrows move.

While you ride — or while you drag the sandbox sliders — it draws the forces PiBoSo’s physics is solving: weight, tire normals, drive, brakes, measured G, fork and shock, drag, steer torque, and gyroscopic couple.

Demo and sandbox modes work with no game install. Live mode reads the official MX Bikes proxy shared memory on the Windows PC that is running the sim.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43187](http://127.0.0.1:43187).

- **Demo** — canned riding cases (holeshot, braking, ruts, whoops, jump, landing, wheelie).
- **Sandbox** — sliders for throttle, brakes, lean, pitch, speed, and suspension travel. Use this to see how each force is simulated in isolation.
- **Live** — feed from MX Bikes on your gaming PC.

## Hook it up to MX Bikes

The game is Windows-only. Force Studio can run in a browser on any machine.

1. Install MX Bikes. The stock `plugins/proxy64.dlo` plugin writes `SPluginsBikeData_t` to `Local\MXBProxyObject` while you are on track. A license is not required for plugins.
2. On that same Windows PC, run:

```bash
python bridge/mxb_proxy_bridge.py --url http://127.0.0.1:43187/api/telemetry
```

If the visualizer is on another computer, point `--url` at that host.

3. Start a session in MX Bikes, then switch Force Studio to **Live**.

The bridge also listens for JSON UDP on port `47387` if you already have a custom output plugin.

POST body shape is the `LivePacket` in `lib/mxb/types.ts`. Minimum fields:

```json
{
  "telemetry": {
    "speedMs": 12.4,
    "throttle": 0.6,
    "rpm": 8200,
    "gear": 3,
    "accelG": { "x": -0.4, "y": 1.1, "z": 0.3 },
    "suspLength": [0.18, 0.19],
    "suspVelocity": [0, 0],
    "steer": -6,
    "frontBrake": 0,
    "rearBrake": 0,
    "clutch": 0,
    "wheelSpeed": [12.4, 12.8],
    "wheelMaterial": [3, 3],
    "brakePressureKpa": [0, 0],
    "steerTorqueNm": 8,
    "yaw": 0,
    "pitch": 2,
    "roll": 18,
    "yawRate": 0,
    "pitchRate": 0,
    "rollRate": 12,
    "engineTemp": 80,
    "waterTemp": 75,
    "fuel": 4.2,
    "crashed": false,
    "position": { "x": 0, "y": 0, "z": 0 },
    "velocity": { "x": 0, "y": 0, "z": 12.4 },
    "time": 12.1,
    "trackPos": 0.2
  }
}
```

Coordinate frame matches PiBoSo’s plugin header: **X+ right, Y+ up, Z+ forward**. Accelerations are in G.

## What this is not

It does not replace the in-game camera. The chassis is locked in the garage so you can read load transfer, contact, and suspension without the world flying by. Tire force magnitudes are reconstructed from the public telemetry (inputs, G, wheel speed, shock length). MX Bikes does not export raw contact-patch Newtons.

## What I still need from you

Nothing is required to use Demo and Sandbox. For a tighter live match, send:

1. Confirm MX Bikes is on a **Windows** PC (Steam or the mx-bikes.com build) and that you can run Python there.
2. Your typical **bike** (450 / 250 / 125) if you want the garage model and default mass (currently 186 kg bike + rider) dialed in.
3. Optional: a screenshot or livery if you want the plastics to match your bike.
4. Optional: whether `plugins/proxy64.dlo` is already enabled, or if you would rather have a custom `.dlo` that streams UDP itself.
5. Optional: rider + bike **wet weight** and fork/shock max travel from your setup sheet, for more accurate arrow lengths.

## Stack

Next.js, React Three Fiber, Tailwind, shadcn/ui. Telemetry types follow `mxb_example.c` / `mxb_proxy.c` from PiBoSo.
