# MX Bikes Force Studio output plugin

64-bit `.dlo` that MX Bikes loads from its `plugins` folder. Every physics tick (20 Hz) it UDP-sends the same JSON Force Studio already accepts on port `47387`.

## Install on the Windows gaming PC

1. Copy `mxb_force_studio.dlo` and `force_studio.ini` into:

   `C:\Program Files (x86)\Steam\steamapps\common\MX Bikes\plugins\`

   (or the `plugins` folder next to `mxbikes.exe` if you use the standalone build)

2. Edit `force_studio.ini` only if the visualizer is on another machine.

3. In the repo, with the Next app running:

   ```bash
   npm run bridge
   ```

4. Launch MX Bikes, go on track, switch Force Studio to **Live**.

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
