# Contributing

Bug reports and focused pull requests are welcome. Include your macOS, Rhino, plugin, Python and Codex CLI versions, reproduction steps and expected behavior. Redact private prompts, images, paths and credentials from logs.

Run the regression suite from `web/`:

```sh
python3 -m unittest discover -s tests -v
```

Check browser scripts with `node --check web/static/app.js` and `node --check web/static/library.js` from the repository root. Node is a development check tool, not a runtime dependency.

For changes to geometry export or Rhino orchestration, describe the live Rhino checks performed and their limitations. Keep the source geometry and the user's existing documents safe; failed jobs must not present fabricated downloads.

The optional integration command is `python3 tests/verify_manufacturing_rhino.py` from `web/` with a connected Rhino instance. Never add generated `web/data/` jobs, credentials or personal diagnostics to a pull request.

Contributions are licensed under the project's MIT license.
