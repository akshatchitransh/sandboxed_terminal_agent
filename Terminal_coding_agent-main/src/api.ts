import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
const WORKER_URL = process.env.WORKER_URL ?? "http://worker:3001";
const MAX_BODY_BYTES = 64 * 1024;

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error("Request body exceeds the 64 KB limit.");
    }

    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok", service: "api" });
    return;
  }

  if (request.method !== "POST" || url.pathname !== "/tasks") {
    sendJson(response, 404, { error: "Route not found." });
    return;
  }

  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Invalid request body.",
    });
    return;
  }

  const prompt =
    typeof body === "object" && body !== null && "prompt" in body
      ? (body as { prompt?: unknown }).prompt
      : undefined;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    sendJson(response, 400, { error: 'A non-empty string "prompt" is required.' });
    return;
  }

  if (prompt.length > 10_000) {
    sendJson(response, 400, { error: "Prompt must be 10,000 characters or fewer." });
    return;
  }

  try {
    const workerResponse = await fetch(`${WORKER_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim() }),
      // Agent runs can take a while; don't apply a short proxy timeout here.
    });

    const result = await workerResponse.text();
    response.writeHead(workerResponse.status, {
      "Content-Type": workerResponse.headers.get("content-type") ?? "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(result);
  } catch (error) {
    console.error("Worker request failed:", error);
    sendJson(response, 502, { error: "Worker service is unavailable. Please try again." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[API] Listening on port ${PORT}`);
  console.log(`[API] Worker endpoint: ${WORKER_URL}`);
});

function shutdown(signal: string) {
  console.log(`[API] Received ${signal}; shutting down.`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
