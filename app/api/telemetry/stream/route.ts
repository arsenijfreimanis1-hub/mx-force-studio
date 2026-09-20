import {
  getLivePacket,
  isLive,
  packetAgeMs,
  STALE_MS,
  subscribeLive,
} from "@/lib/mxb/live-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (packet: ReturnType<typeof getLivePacket>) => {
        const payload = JSON.stringify({
          live: isLive(packet),
          packet,
          staleMs: packetAgeMs(packet),
          staleLimitMs: STALE_MS,
        });
        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          cleanup();
        }
      };

      const unsubscribe = subscribeLive(send);
      send(getLivePacket());

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 8000);

      cleanup = () => {
        unsubscribe();
        clearInterval(ping);
      };
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
