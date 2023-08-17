<p align="center">
  <h3 align="center">cf-bindings-proxy</h3>

  <p align="center">
    Experimental proxy for interfacing with bindings
    <br />
    in projects targeting Cloudflare Pages.
  </p>
</p>

---

<p align="center">
  <a href="https://npmjs.com/package/cf-bindings-proxy" target="_blank">
		<img alt="npm (tag)" src="https://img.shields.io/npm/v/cf-bindings-proxy/latest?color=3777FF&style=flat-square" />
	</a>
	<img alt="GitHub Workflow Status (with branch)" src="https://img.shields.io/github/actions/workflow/status/james-elicx/cf-bindings-proxy/release.yml?branch=main&color=95FF38&style=flat-square" />
</p>

---

This library was written to accompany [`@cloudflare/next-on-pages`](https://github.com/cloudflare/next-on-pages), so that you can use bindings when developing Next.js apps locally through `next dev`.

It is intended to be used for frameworks that do not support Cloudflare bindings in a fast HMR environment.

## Usage

Add the library to your project.

```sh
npm add cf-bindings-proxy
```

In a separate terminal window, run the following command to start the proxy, passing through your bindings are arguments.

```sh
npx cf-bindings-proxy --kv=MY_KV
```

In your project's code, import the `binding` function from `cf-bindings-proxy` and use it to interact with your bindings.

```ts
import { binding } from 'cf-bindings-proxy';

const value = await binding<KVNamespace>('MY_KV').get('key');
```

## How It Works

Starting the proxy spawns an instance of Wrangler using a template, passing through any commands and bindings that are supplied to the CLI. It uses port `8799` by default, but can be configured with the environment variable `BINDINGS_PROXY_PORT`.

In development mode, when interacting with a binding through the `binding('BINDING_NAME')` function, it sends HTTP requests to the proxy. These HTTP requests contain destructured function calls, which are then reconstructed and executed inside the proxy. The result is then returned to the client.

When building for production, `binding('BINDING_NAME')` simply calls `process.env.BINDING_NAME` to retrieve the binding instead.

### When It's Active

Calls to `binding('BINDING_NAME')` will try to use the proxy when either of the following two conditions are met:

- The `ENABLE_BINDINGS_PROXY` environment variable is set to `true`.
  OR
- The `DISABLE_BINDINGS_PROXY` environment variable is not set and `NODE_ENV` is set to `development`.

## Supported

Note: Functionality and bindings not listed below may still work but have not been tested.

#### KV

- [x] put
- [x] get
- [x] list
- [x] getWithMetadata
- [x] delete

#### D1

- [x] prepare
  - [x] bind
  - [x] run
  - [x] all
  - [x] first
  - [x] raw
- [x] batch
- [x] exec
- [x] dump

#### R2

- [x] put
  - [ ] writeHttpMetadata
- [x] get
  - [ ] writeHttpMetadata
  - [x] text
  - [x] json
  - [x] arrayBuffer
  - [x] blob
  - [ ] body
  - [ ] bodyUsed
- [x] head
  - [ ] writeHttpMetadata
- [x] list
  - [ ] writeHttpMetadata
- [x] delete
- [ ] createMultipartUpload
- [ ] resumeMultipartUpload
