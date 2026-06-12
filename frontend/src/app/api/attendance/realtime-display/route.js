const BACKEND_INTERNAL = process.env.BACKEND_INTERNAL_URL || "http://backend:3041";

export async function GET(request) {
  let backendRes;
  try {
    backendRes = await fetch(`${BACKEND_INTERNAL}/api/attendance/realtime-display`, {
      signal: request.signal,
      headers: { Accept: "text/event-stream" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }

  if (!backendRes.ok) return new Response(null, { status: backendRes.status });

  return new Response(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
