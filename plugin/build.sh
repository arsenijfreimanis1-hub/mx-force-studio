#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
CC="${CC:-x86_64-w64-mingw32-gcc}"
"$CC" -shared -O2 -o mxb_force_studio.dlo mxb_force_studio.c -lws2_32
echo "built $(pwd)/mxb_force_studio.dlo"
