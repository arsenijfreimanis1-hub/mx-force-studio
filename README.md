# MX Bikes Force Studio

A garage visualizer for [MX Bikes](https://www.mx-bikes.com/). The skeleton stays. The frame origin (bottom-middle of the cradle) moves up to **±1 m** on each axis from live telemetry. The arrows and inputs update with the same packet.

Tuned for a **250 4-stroke** (YZ250F-class): 180 kg with rider (105 kg wet bike + 75 kg rider), 1.476 m wheelbase, 310 / 312 mm travel, 14,000 rpm. Livery can be swapped later.

## Start here (Windows)

Double-click **`MX Force Studio.bat`**. That is the whole app. You can save just that one file — it unpacks itself, downloads Node.js if needed (no admin), installs the MX Bikes plugin, puts **MX Force Studio** on your Desktop, and opens the garage.

A window titled **MX Bikes Force Studio** stays open. Keep it open while you ride. Close it to stop.

There is no `.exe`. If Windows SmartScreen says “Windows protected your PC”, click **More info** → **Run anyway**. If the file opens as text, rename it so it ends in `.bat` (not `.bat.txt`).

First run needs internet and can take a couple of minutes. When the window says **APP READY**, launch MX Bikes on **this same PC**, go on track, switch Force Studio to **Live**, and click **Connect to MX Bikes**. If the game was already open, restart it so the plugin loads.

Later launches use the Desktop icon (orange arrow). You do not need Git.

If you cloned with Origin/WSL, open the folder from Windows first, for example `\\wsl$\Ubuntu\home\<you>\mx-hub`, then double-click the file there.

## Run it on Windows (one icon, no terminal)

1. Double-click `MX Force Studio.bat` (Downloads is fine).
2. Wait until the window prints **APP READY** and the browser opens.
3. Launch MX Bikes, go on track, switch to **Live**, click **Connect**.

To stop it, close the **MX Bikes Force Studio** window.

> First launch takes about a minute (Node + install + build). Later launches are instant.

## Run it (macOS / Linux / WSL)

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43187](http://127.0.0.1:43187).

- **Demo** — holeshot, braking, ruts, whoops, jump, landing, wheelie on the 250.
- **Sandbox** — sliders for throttle, brakes, lean, pitch, speed, and suspension travel.
- **Live** — UDP from the custom MX Bikes plugin.

## Hook it up to MX Bikes (Windows)

You do not need Python. Node is enough because the visualizer already uses it.

The desktop icon copies these into the game `plugins` folder automatically (next to `mxbikes.exe`):

- `plugin/mxb_force_studio.dlo`
- `plugin/force_studio.ini`

Primary path:

`D:\New folder\steamapps\common\MX Bikes\plugins\`

If that folder is missing, the launcher looks through Steam's library folders for `MX Bikes`. MX Bikes loads plugins at startup, so **if the game is already open, restart it** after the icon runs.

Then: wait for **APP READY**, launch MX Bikes, go on track, switch Force Studio to **Live**, and click **Connect to MX Bikes**. The HUD at the bottom of the garage shows live throttle, brakes, clutch, steer, and gear from the game.

`force_studio.ini` defaults to `127.0.0.1:47387`. Change the host only if the browser is on another machine.

Rebuild the plugin with `npm run plugin:build` (needs MinGW-w64) or see `plugin/README.md` for MSVC.

Optional fallback if you would rather use the stock `proxy64.dlo` shared memory object:

```bash
npm run bridge:proxy
```

## What this is not

It does not replace the in-game camera. Tire force magnitudes are reconstructed from public plugin fields (G, wheel speed, shock length, throttle/brake). MX Bikes does not export raw contact-patch Newtons.

Mass and travel are class defaults, not your setup sheet. Drop real wet weight later and the arrows scale.

## Stack

Next.js, React Three Fiber, Tailwind, shadcn/ui. Plugin interface matches PiBoSo `mxb_example.c`.
