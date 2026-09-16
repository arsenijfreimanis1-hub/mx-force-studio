# MX Bikes Force Studio

A garage visualizer for [MX Bikes](https://www.mx-bikes.com/). The bike stays put. The arrows move.

Tuned for a **250 4-stroke** (YZ250F-class): 180 kg with rider (105 kg wet bike + 75 kg rider), 1.476 m wheelbase, 310 / 312 mm travel, 14,000 rpm. Livery can be swapped later.

## Run it on Windows

`npm` comes from **Node.js**. Windows does not include it. Install it once, then always run commands from the `mx-hub` folder (not `C:\Users\user`).

1. In Command Prompt:

```bat
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
```

If `winget` is missing, download the LTS installer from [nodejs.org](https://nodejs.org/en/download), keep **Add to PATH** checked, and finish the wizard.

2. **Close Command Prompt and open a new one.** PATH only updates in a new window. Check:

```bat
node -v
npm -v
```

3. Get into the repo, install packages, start the garage:

```bat
cd C:\Users\user\mx-hub
npm install
npm run dev
```

Or double-click `setup-windows.cmd` inside the repo. It will say if Node is missing.

Open [http://127.0.0.1:43187](http://127.0.0.1:43187).

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

1. Copy these into the game `plugins` folder (next to `mxbikes.exe`):

   - `plugin/mxb_force_studio.dlo`
   - `plugin/force_studio.ini`

   Typical Steam path:

   `C:\Program Files (x86)\Steam\steamapps\common\MX Bikes\plugins\`

2. Start the visualizer (`npm run dev`), then in a second terminal:

   ```bash
   npm run bridge
   ```

3. Launch MX Bikes, go on track, switch Force Studio to **Live**.

`force_studio.ini` defaults to `127.0.0.1:47387`. Change the host if the browser is on another machine.

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
