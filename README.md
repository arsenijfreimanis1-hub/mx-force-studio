# MX Bikes Force Studio

Garage 6DOF for [MX Bikes](https://www.mx-bikes.com/). The frame stays **upright on startup** and only moves when live UDP packets arrive or an Xbox pad is actually in use.

Every public chassis channel from the PiBoSo plugin is mapped onto the deck and the rider dummy:

| In-game field | Garage |
| --- | --- |
| `m_fRoll` / `m_aafRot` (negative = left) | Frame + rider lean |
| `m_fPitch` | Wheelie / brake pitch |
| `m_fYawVelocity`, `m_fSteer` | Yaw washout |
| `m_fAcceleration` X/Y/Z | Sway / heave / surge |
| `m_afSuspLength` + `m_afSuspVelocity` | Whoops / bumps vs rolling sag |
| `m_aiWheelMaterial` + `velocity.y` | Jumps and landings |
| throttle / brakes | Rider sit-back / sit-forward |
| airborne / whoops | Rider stand |

A box under the frame holds a rod to the cradle. The dummy sits, stands, leans, and slides fore/aft with the same packet.

## Start here (any Windows PC)

1. Copy this folder to the gaming PC (or clone it). You only need **`MX Force Studio.bat`** if you grabbed the packed launcher.
2. Double-click **`MX Force Studio.bat`**. First run downloads portable Node (no admin), installs the plugin next to `mxbikes.exe`, and puts **MX Force Studio** on the Desktop.
3. Leave the **MX Bikes Force Studio** window open. The garage opens with the bike **parked upright**.
4. Launch MX Bikes **on the same PC**, go on track (plugin loads at game start — restart MX Bikes if it was already open).
5. Click **Connect**. The frame follows the live bike.

Stock Xbox / XInput map (MX Bikes Controls + `Documents\PiBoSo\MX Bikes`): **RT** throttle, **LT** front brake, **LB** rear brake, **A** clutch, **left stick** steer + lean. The live HUD also shows the session setup file (`.ssx`).

If Windows SmartScreen says “Windows protected your PC”, click **More info** → **Run anyway**. If the file opens as text, rename it so it ends in `.bat`.

To stop, close the **MX Bikes Force Studio** window.

## Run it (macOS / Linux / WSL)

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43187](http://127.0.0.1:43187). Click **Connect** after MX Bikes is on track, or drive the frame with an Xbox pad.

```bash
npm test
```

## Plugin

The desktop icon copies these next to `mxbikes.exe`:

- `plugin/mxb_force_studio.dlo`
- `plugin/force_studio.ini` (`127.0.0.1:47387`)

Primary path: `D:\New folder\steamapps\common\MX Bikes\plugins\`. Otherwise Steam library folders are searched. Rebuild with `npm run plugin:build` (MinGW-w64) or see `plugin/README.md`.

Optional proxy fallback:

```bash
npm run bridge:proxy
```

## What this is not

It does not replace the in-game camera. Tire Newtons are reconstructed from public plugin fields. Mass and travel are class defaults until a real bike packet arrives — the garage will not invent a YZF250 name.

## Stack

Next.js, React Three Fiber, Tailwind, shadcn/ui. Plugin interface matches PiBoSo `mxb_example.c` / MaxTM-v2.7.
