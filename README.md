# MX Bikes Force Studio

A garage visualizer for [MX Bikes](https://www.mx-bikes.com/). The bike stays put. The arrows move.

Tuned for a **250 4-stroke** (YZ250F-class): 180 kg with rider (105 kg wet bike + 75 kg rider), 1.476 m wheelbase, 310 / 312 mm travel, 14,000 rpm. Livery can be swapped later.

## Run it on Windows (one icon, no terminal)

Force Studio runs as a clickable app. Set it up once, then it lives on your Desktop.

1. **Install Node.js once** (only if you have never installed it). In Command Prompt:

```bat
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
```

If `winget` is missing, download the LTS installer from [nodejs.org](https://nodejs.org/en/download), keep **Add to PATH** checked, and finish the wizard.

2. **Double-click `setup-windows.cmd`** inside the `mx-hub` folder. It installs packages, builds the app, and drops a **MX Force Studio** icon on your Desktop and in the Start Menu. (It will tell you if Node is missing.)

3. From now on, **double-click the MX Force Studio icon** before you start MX Bikes. It installs the telemetry plugin into the game folder, launches the garage, starts the live telemetry bridge, and opens your browser at [http://127.0.0.1:43187](http://127.0.0.1:43187). When the launcher prints **APP READY**, launch MX Bikes, go on track, switch Force Studio to **Live**, and click **Connect to MX Bikes**.

To stop it, close the small **MX Bikes Force Studio** window it opens.

> The icon is a shortcut to `Force Studio.cmd` in the repo. You can also double-click that file directly, or drag it to your taskbar. The first launch builds the app (about a minute); later launches are instant.

If you cloned with Origin in WSL, the Windows path is usually `\\wsl$\Ubuntu\home\<you>\mx-hub` or `/mnt/c/Users/user/mx-hub` if you cloned onto C:.

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
