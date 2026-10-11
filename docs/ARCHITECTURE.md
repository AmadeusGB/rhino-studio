# Architecture

The browser uses plain HTML, CSS and JavaScript. `web/server.py` implements an HTTP API with Python's standard library, persists job metadata and processes jobs through one worker queue. There is no database service or frontend build step.

For each job, Codex CLI receives the uploaded image and instructions and returns a plan constrained by `web/plan.schema.json`. A local JSON-RPC MCP client starts the Rhino plugin router. The worker opens a separate desktop work document, executes the C# stages, and collects viewport images. Execution failures can trigger a corrected plan.

`web/export.cs` preserves editable source objects in 3DM and handles STL geometry preparation, union checks, meshing, binary output and read-back validation. Manufacturing reports disclose unresolved connectivity and mesh limitations.

`web/data/<job-id>/` stores the input, plan, scripts, execution log, model files, views and metadata. `web/data/catalog.json` persists library management overrides. A service restart restores completed jobs and interrupts unfinished ones.

## Trust boundary

The server listens on loopback, validates Host and rejects cross-origin writes. Uploaded images are sent to the authenticated online agent service. Generated C# runs inside local Rhino with the capabilities of that process. Treat this as a trusted personal desktop application, not a multi-tenant execution sandbox.

## Source map

- `web/server.py`: API, queue, agent invocation and MCP orchestration.
- `web/export.cs`: geometry export and manufacturing report.
- `web/static/`: browser UI and library management.
- `web/launch.py`, `web/start.command`: macOS background launcher.
- `web/tests/test_*.py`: automated regression suite using mocked external dependencies.
- `web/tests/verify_manufacturing_rhino.py`: opt-in live export verification.
- `setup/check_mcp.py`: standalone default-router diagnostic.
