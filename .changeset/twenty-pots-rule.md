---
'cf-bindings-proxy': patch
---

Fixes returning a binding through an awaited function calling `.then` on `binding(...)` and throwing an error.
