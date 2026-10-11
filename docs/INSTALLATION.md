# Installation and operation

## Requirements

| Dependency | Requirement |
| --- | --- |
| Desktop | macOS, Apple Silicon; other platforms are unverified |
| Rhino | Rhino 8; original validation used 8.34 |
| Plugin | Rhino-MCP-Platform; original validation used 0.1.5 |
| Python | 3.9 or newer |
| Codex | Authenticated CLI with image input, structured output and `--ignore-user-config` support |

The release environment has Codex CLI 0.162.1. Verify your CLI using `codex --version` and `codex exec --help`. The app invokes the CLI directly; it does not require adding a Rhino MCP entry to your personal Codex configuration.

1. Install Rhino 8 and activate it according to its vendor instructions.
2. Install Rhino-MCP-Platform using the [upstream RhinoAI project](https://github.com/mcneel/rhinoai) and its [Codex integration guide](https://mcneel.github.io/RhinoAI/docs/getting-started/codex/).
3. Install and authenticate Codex CLI using the [official Codex documentation](https://developers.openai.com/codex/cli/).
4. Start Rhino 8. Run `MCPConnect` if required by the installed plugin.
5. Start the server from `web/` using `python3 server.py`, then open http://localhost:8765.

## Configuration

| Environment variable | Purpose | Default |
| --- | --- | --- |
| `RHINO_ROUTER` | Absolute path to the plugin router | macOS ARM64 plugin 0.1.5 router under your home directory |
| `RHINO_MODEL` | Explicit Codex model override | CLI/service default |
| `PORT` | HTTP port | `8765` |

For a different plugin location:

```sh
export RHINO_ROUTER="$HOME/Library/Application Support/McNeel/Rhinoceros/packages/8.0/Rhino-MCP-Platform/0.1.5/router/osx-arm64/rhino-mcp-router"
cd web
python3 server.py
```

Adjust the version/path to the installed package. With a custom port, open the matching URL manually. The server binds only to `127.0.0.1`.

## Background launcher

On macOS, double-click `web/start.command`. If needed, make it executable with `chmod +x web/start.command`. An existing local service is reused. Closing the launcher terminal does not stop the server.

To stop a background service, read `web/server.pid`, inspect that PID with `ps -p <PID> -o command=`, confirm it is this checkout's `web/server.py`, then run `kill -TERM <PID>`. Do not terminate an unverified PID.

## Troubleshooting

- **Router unavailable:** confirm the plugin is installed and `RHINO_ROUTER` points to an executable. `python3 setup/check_mcp.py` lists connections using the default router path.
- **Agent unavailable or analysis fails:** confirm `codex` is on PATH, authenticated, has account usage available and supports the required flags. Inspect the job's local `agent.log`.
- **Rhino document creation fails:** ensure Rhino is running and the plugin is connected. macOS may request Automation/Accessibility access for the focus-recovery code; grant it only to the trusted local process you are running.
- **No preview:** wait for the serial queue or use the interface's four-view retry action.
- **Multiple volumes / union warning:** inspect the source geometry and repair the connection before manufacturing.

Job logs, `plan.json`, generated `script-*.cs` and `validation.json` live in `web/data/<job-id>/`. Redact private images, prompts and paths before sharing diagnostics.
