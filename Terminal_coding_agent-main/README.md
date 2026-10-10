# Terminal Coding Agent

A TypeScript/Node.js terminal coding agent with a Docker sandbox. The project can run in CLI mode or as a small multi-service application.

## Services

- **agent** — the original interactive CLI.
- **api** — HTTP entry point on port `3000`.
- **worker** — runs the existing `runAgent(prompt)` implementation.
- **sandbox** — executes commands over authenticated HTTP inside the workspace.

The API and worker are separate containers but currently use direct HTTP communication. Redis/BullMQ will be introduced in the next phase. Until per-job workspaces are implemented, the worker accepts only one task at a time and responds with HTTP `409` if busy.

## Prerequisites

- Docker Desktop with Docker Compose
- A Groq API key
- A `.env` file containing at least:

```dotenv
GROQ_API_KEY=replace-with-your-key
SANDBOX_TOKEN=replace-with-a-long-random-token
DEBUG_LLM=false
```

Do not commit `.env` or real credentials.

## Build and start

```bash
docker compose build
docker compose up -d
```

Check service health:

```bash
curl http://localhost:3000/health
```

On PowerShell, use `Invoke-RestMethod` instead of `curl` if your shell aliases it:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

## Submit a coding task

PowerShell:

```powershell
$body = @{ prompt = "Create hello.js that prints Hello World, then run it." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/tasks -ContentType "application/json" -Body $body
```

The request waits for the worker's agent run to finish in this initial phase. Agent output and tool traces are visible in worker logs:

```bash
docker compose logs -f worker
```

## Stop

```bash
docker compose down
```

## Next phase

Add Redis + BullMQ so `POST /tasks` enqueues an asynchronous job and returns a job ID immediately, then expose job status and results. Per-job workspace isolation must be implemented and verified before enabling parallel worker execution.
