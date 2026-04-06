import { NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8892";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const backendResponse = await fetch(`${BACKEND_URL}/api/fridge/scan`, {
    method: "POST",
    body: formData,
  });

  // Stream the SSE response back to the client
  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: {
      "Content-Type": backendResponse.headers.get("Content-Type") || "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
