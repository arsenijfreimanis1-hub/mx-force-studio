# MX Bikes Force Studio

Garage 6DOF that follows live [MX Bikes](https://www.mx-bikes.com/) on the same PC, in its own window.

## Riders (Windows)

Download the GitHub zip, extract it, then use only these three files:

1. **Installer.bat** — first install and run
2. **Updater.bat** — clean rebuild after a new download
3. **Uninstaller.bat** — remove icons, cache, and the plugin

Read [`FEATURES.txt`](FEATURES.txt) for the short feature list and how it works.

SmartScreen: **More info** → **Run anyway**. A Force Studio window opens on this PC only — not a website, not other computers. Start MX Bikes on this PC and go on track (Live is already on). Close the Force Studio window to stop.

**Updater.bat** rebuilds and shows `UPDATE READY` with the revision. It does **not** start the app — use Installer.bat for that.

There is no Select folder, no `MX Force Studio.bat`, and no manual path picker. Installer finds `mxbikes.exe` automatically.

## Developers

```bash
npm install
npm run dev
```

The app listens on `127.0.0.1` only. Riders never need that address; `npm start` plus `windows/app-window.ps1` opens the desktop window.

```bash
python windows/pack-standalone.py
```
