---
'cf-bindings-proxy': patch
---

Fix accessing an instance of a binding multiple times interfacing on the same instance - create a new proxy instance for each time the binding is accessed.
