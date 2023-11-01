# cf-bindings-proxy

## 0.7.1

### Patch Changes

- d2cc335: Check process is not undefined when checking whether to use the binding or not.

## 0.7.0

### Minor Changes

- 906b21f: Support for the Cache API, as well as support for transforming Request / Response / URL objects.

## 0.5.0

### Minor Changes

- d87efba: Support for ReadableStream with R2 `.put(...)`, and `.get(...).body`.
- d87efba: Transforms functions from responses when making calls in the proxy, instead of needing further HTTP calls to read their value. Support for handling binding calls that return accessors for `arrayBuffer()`, `blob()`, `text()`, `json()`, `body` + `bodyUsed`.

### Patch Changes

- 7b0d1ae: Return array responses instead of creating a new proxy for the response.

## 0.4.1

### Patch Changes

- ab73898: Fixes returning a binding through an awaited function calling `.then` on `binding(...)` and throwing an error.

## 0.4.0

### Minor Changes

- 61d928a: Support for `writeHttpMetadata` for R2.

## 0.3.3

### Patch Changes

- 8527c95: Fix using `JSON.stringify(...)` throwing an error.

## 0.3.2

### Patch Changes

- fc01172: Fix a maximum stack call exception from buffer -> base64 conversion
- fc01172: Fix blob -> base64 call for the arraybuffer not being awaited.

## 0.3.1

### Patch Changes

- 803dd41: Fix the incorrect process of converting ArrayBuffer to base64

## 0.3.0

### Minor Changes

- 918bb55: Support for providing a custom fallback to use instead of `process.env`.

## 0.2.8

### Patch Changes

- 705a99e: Make it possible to send an ArrayBuffer or a Blob

## 0.2.7

### Patch Changes

- 84b0638: Symbol call throwing error due to prop check assuming string.

## 0.2.6

### Patch Changes

- 38c1ac9: Make the cache option always be no-store

## 0.2.5

### Patch Changes

- c55671b: [Fix] Use UTC for fallback compatibility_date

## 0.2.4

### Patch Changes

- 000367c: Fix retrieving undefined array value at index returning proxy func instead of undefined.

## 0.2.3

### Patch Changes

- ab8484a: Fix D1Result undefined properties returning truthy value.

## 0.2.2

### Patch Changes

- 5289f47: Fix accessing an instance of a binding through a variable multiple times interfacing on the same instance - create a new proxy instance for each time the binding is accessed.

  The below code is a good example of this fix. Previously, each time an action was performed using the `d1` variable, it was always interfacing with the same instance. This change fixes that, so that each time the `d1` variable is accessed below, it is interfacing with an entirely new instance of the binding. This prevents different actions on a binding via a variable from breaking each other.

  ```ts
  const insertQuery = [
  	`INSERT INTO comments (author, body, post_slug) VALUES ('Markus', 'Hello there!', ?);`,
  	`INSERT INTO comments (author, body, post_slug) VALUES ('Kristian', 'Great post!', ?);`,
  ];

  const d1 = binding<D1Database>('D1');

  const statements = insertQuery.map((query) => d1.prepare(query).bind('hello-world'));
  await d1.batch(statements);
  ```

## 0.2.1

### Patch Changes

- 0c387c0: Pass a compatibility date by default.
- 0c387c0: Log information about the tool to the console on startup.

## 0.2.0

### Minor Changes

- 0f37886: Initial support for running a proxy for bindings with D1/KV/R2.
