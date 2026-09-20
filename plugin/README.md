# MX Bikes Force Studio output plugin

64-bit `.dlo` that MX Bikes loads from its `plugins` folder. Every physics tick (~100 Hz) it UDP-sends JSON Force Studio already accepts on port `47387`. The first packet (and each bike/session change) includes event + suspension travel so any selected bike works; later ticks are telemetry-only to cut latency.

## Install on the Windows gaming PC

Double-click the **MX Force Studio** desktop icon (or `setup-windows.cmd`). It copies `mxb_force_studio.dlo` and `force_studio.ini` into:

`D:\New folder\steamapps\common\MX Bikes\plugins\`

(or the `plugins` folder next to `mxbikes.exe` if Steam reports a different library). MX Bikes loads plugins at startup, so restart the game if it was already open.

`force_studio.ini` stays at `127.0.0.1:47387` when the visualizer runs on the same PC.

Then wait for **APP READY**, launch MX Bikes, go on track, switch Force Studio to **Live**, and click **Connect to MX Bikes**.

A license is not required for output plugins. The plugin is fire-and-forget UDP; it will not stall the sim if the bridge is down.

## Build

From this folder, with [MinGW-w64](https://www.mingw-w64.org/) or the bundled `plugin/build.sh`:

```bash
x86_64-w64-mingw32-gcc -shared -O2 -o mxb_force_studio.dlo mxb_force_studio.c -lws2_32
```

Or on Windows with MSVC x64:

```bat
cl /LD /O2 /Fe:mxb_force_studio.dlo mxb_force_studio.c ws2_32.lib
```

Then rename the `.dll` to `.dlo` if the compiler emitted a DLL.
