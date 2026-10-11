# Changelog

## 1.1.0 — 2026-10-11

First curated public release of Rhino Studio, based on the local 1.1 implementation.

### Included

- Image-to-Rhino workflow using structured C# RhinoCommon plans.
- Standard and debug generation, recorded steps and four model views.
- Persistent work library with search, rename, batch deletion and recovery.
- Jewelry manufacturing scope, thickness and surface mesh settings.
- Verified macOS Rhino process activation before document creation.
- Small closed faceted mesh conversion for connectivity checks.
- Binary STL output, seam repair limits and closed-geometry read-back checks.
- Installation, architecture, contribution and security documentation.
- Automated CI for regression tests and Python/JavaScript syntax checks.

### Validation

29 local regression tests passed during release preparation. Historical development included real Rhino generation and export checks. A new real-Rhino end-to-end run was not performed for this publication.

### Known limitations

Single-view reconstruction uses inferred geometry. Closed geometry is not production certification. Dense native mesh precision is not governed by surface meshing settings. Desktop execution may switch focus. The UI is currently Chinese; platform validation is limited to Apple Silicon macOS.
