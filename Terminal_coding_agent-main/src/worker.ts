import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { runAgent } from "./agent.js";

const PORT = Number(process.env.WORKER_PORT ?? process.env.PORT ?? 3001);
const MAX_BODY_BYTES = 64 * 1024;
let isRunning = false;

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
    sendJson(response, 200, { status: "ok", service: "worker", busy: isRunning });
    return;
  }

  if (request.method !== "POST" || url.pathname !== "/run") {
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

  // The current agent uses one shared workspace. Reject overlapping tasks until
  // per-job workspaces are implemented, rather than allowing file collisions.
  if (isRunning) {
    sendJson(response, 409, { error: "Worker is busy. Retry this task shortly." });
    return;
  }

  isRunning = true;
  const startedAt = Date.now();
  console.log(`[Worker] Starting task: ${prompt.trim().slice(0, 160)}`);

  try {
    await runAgent(prompt.trim());
    sendJson(response, 200, {
      status: "completed",
      message: "Agent execution finished. See worker logs for the generated response and tool trace.",
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[Worker] Agent execution failed:", error);
    sendJson(response, 500, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });
  } finally {
    isRunning = false;
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Worker] Listening on port ${PORT}`);
  console.log("[Worker] Execution concurrency is limited to one task until workspace isolation is added.");
});

function shutdown(signal: string) {
  console.log(`[Worker] Received ${signal}; shutting down.`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
