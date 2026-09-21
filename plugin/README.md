# MX Bikes Force Studio plugin

This is the 64-bit `.dlo` MX Bikes loads from its `plugins` folder. About 100 times a second it sends UDP JSON to Force Studio on port `47387`.

You normally never build this yourself. Double-click **MX Force Studio.bat** on the gaming PC. That copies `mxb_force_studio.dlo` and `force_studio.ini` next to `mxbikes.exe` and creates `plugins/force_studio_logs/` for spreadsheets.

Restart MX Bikes after the first copy. Plugins only load at game start.

`force_studio.ini` stays at `127.0.0.1:47387` when the garage runs on the same PC. Spreadsheets from **Save** land in `plugins/force_studio_logs/`. Logging is off until Auto log or Start log.

Output plugins do not need a PiBoSo license. If Force Studio is closed, the plugin still fires UDP and will not stall the sim.

## Build (only if you change the C)

From this folder, with [MinGW-w64](https://www.mingw-w64.org/) or `plugin/build.sh`:

```bash
x86_64-w64-mingw32-gcc -shared -O2 -o mxb_force_studio.dlo mxb_force_studio.c -lws2_32
```

Or MSVC x64:

```bat
cl /LD /O2 /Fe:mxb_force_studio.dlo mxb_force_studio.c ws2_32.lib
```

Rename the `.dll` to `.dlo` if the compiler emitted a DLL.
