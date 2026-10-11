# Security

Rhino Studio is intended for a trusted user's local workstation. It runs generated C# in desktop Rhino; this is not a hardened code-execution sandbox. Do not expose the HTTP server through a public tunnel, reverse proxy or shared untrusted network.

The server binds to loopback and checks Host and write origins. These measures do not make generated scripts safe for hostile users. Uploaded images and prompts are processed by the authenticated online agent service. Jobs and diagnostics are saved locally.

Only the current 1.1 release line is maintained. To report a security issue, use GitHub's private vulnerability reporting for this repository. Do not post exploit details, credentials or private design files in a public issue.
