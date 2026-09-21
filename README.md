# MX Bikes Force Studio

A garage 6DOF that follows live [MX Bikes](https://www.mx-bikes.com/). The bike sits still until you are on track (or you pick up an Xbox pad). Then the deck leans, wheelies, jumps, and snaps home between hits.

You do **not** need Node, Git, Visual Studio, or admin rights on the gaming PC.

---

## Install (Windows, the PC that runs MX Bikes)

**Riders:** double-click [`MX Force Studio.bat`](MX%20Force%20Studio.bat). Ignore every other file in this folder.

1. Copy this folder to the gaming PC (or download the GitHub zip and extract it).
2. Double-click **MX Force Studio.bat**.
3. If SmartScreen says *Windows protected your PC*, click **More info** → **Run anyway**.
4. Leave the black window open. The first run downloads portable Node.js, installs packages, builds the app, copies the telemetry plugin next to `mxbikes.exe` (any Steam library / drive), and puts **MX Force Studio** on your Desktop.
5. When it prints **APP READY**, a browser tab opens at [http://127.0.0.1:43187](http://127.0.0.1:43187).
6. Start **MX Bikes on this same PC** and go on track. If the game was already running, **restart it** so the plugin loads.
7. In Force Studio, click **Connect**. The frame follows the live bike.

Next sessions: use the Desktop icon, or the `.bat` again. Close the black window to stop.

There is also a one-line reminder in [`START HERE.txt`](START%20HERE.txt).

If you still see an old garage with wheels, close every Force Studio window and run the new `.bat` again. It deletes leftover copies under `%LOCALAPPDATA%\MXForceStudio\app` and rebuilds this revision.

To remove Force Studio later, double-click **Uninstall Force Studio.bat** in this folder. That deletes the Desktop / Start Menu icons, the portable app under `%LOCALAPPDATA%\MXForceStudio`, and the plugin copies. Spreadsheets in `force_studio_logs` stay.

### Controllers

Force Studio picks the rider pad and ignores a racing wheel when both are plugged in. Xbox (XInput / Standard Gamepad) wins unless another Standard pad is the one you are actually using. The header shows which pad it chose.

Same map MX Bikes uses on Xbox: **RT** throttle, **LT** front brake, **LB** rear brake, **A** clutch, left stick steer. Right stick is body weight for the dummy (the plugin has no rider skeleton). Live MX Bikes always uses **Connect**.

### Spreadsheets

Logging stays off until you press it. **Auto log** / **Start log** / **Stop log** / **Save**. Save writes a CSV next to the plugin:

`MX Bikes\plugins\force_studio_logs\`

### If Connect does nothing

- Force Studio and MX Bikes must be on **the same PC**.
- Click **Connect** only after you are **on track**.
- Restart MX Bikes after the first Force Studio launch (plugins load at game start).
- Keep the black window open. Closing it stops the app.
- The plugin talks to `127.0.0.1:47387`. Nothing leaves your machine.

---

## Developers (macOS / Linux / WSL)

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43187](http://127.0.0.1:43187). Click **Connect** after MX Bikes is on track, or drive with an Xbox pad.

```bash
npm test
```

The Windows `.bat` is rebuilt with:

```bash
python3 windows/pack-standalone.py
```

---

## What the deck follows

| In MX Bikes | On the garage |
| --- | --- |
| Roll (negative = left) | Frame + dummy lean |
| Pitch (negative = wheelie, positive = stoppie) | Nose up / nose down |
| Yaw rate + steer | Heading washout |
| Acceleration X / Y / Z | Sway / heave / surge |
| Shock length + velocity | Whoops vs sag |
| Wheels off the ground + world height | Jumps |
| Crash flag or a high-side | Bike stays down |
| Throttle / brakes | Dummy sit-back / sit-forward |

Support rods keep a fixed steel base. The **Rod stroke** slider is how far each actuator may grow or shrink. Chest-belt tension is in the sidebar (front / rear / hug). No extra mesh yet.

The garage will not invent a bike name. Live only follows a real MX Bikes session after **Connect**. The 3D bike is a **frame only** — no wheels.

---

## Plugin

First launch copies these next to every `mxbikes.exe` it finds on this PC:

- `plugin/mxb_force_studio.dlo`
- `plugin/force_studio.ini` (`127.0.0.1:47387`)

Steam libraries, Start Menu shortcuts, and a running `mxbikes.exe` are searched automatically. Rebuild with `npm run plugin:build` if you have MinGW-w64 — details in [`plugin/README.md`](plugin/README.md).

---

## Stack

Next.js, React Three Fiber, Tailwind, shadcn/ui. Plugin layout matches PiBoSo `mxb_example.c` / MaxTM-v2.7.
