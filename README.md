# MX Bikes Force Studio

Garage 6DOF that follows live [MX Bikes](https://www.mx-bikes.com/) on the same PC.

## Riders (Windows)

Download the GitHub zip, extract it, then use only these three files:

1. **Installer.bat** — first install and run
2. **Updater.bat** — clean rebuild after a new download
3. **Uninstaller.bat** — remove icons, cache, and the plugin

Read [`FEATURES.txt`](FEATURES.txt) for the short feature list and how it works.

SmartScreen: **More info** → **Run anyway**. Leave the black window open. Start MX Bikes on this PC, go on track, click **Connect**.

There is no Select folder, no `MX Force Studio.bat`, and no manual path picker. Installer finds `mxbikes.exe` automatically.

## Developers

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43187

```bash
python windows/pack-standalone.py
```

That refreshes the three rider `.bat` files (CRLF) and does not recreate the old packed `MX Force Studio.bat`.
