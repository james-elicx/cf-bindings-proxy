<p align="center">
  <h3 align="center">cf-bindings-proxy</h3>

  <p align="center">
    Experimental proxy for interfacing with bindings
    <br />
    in frameworks targeting Cloudflare Pages.
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

## When To Use

This library was written to accompany [`@cloudflare/next-on-pages`](https://github.com/cloudflare/next-on-pages), so that you can use bindings when developing Next.js apps locally through `next dev`. It is intended to be used for frameworks that do not support Cloudflare bindings in a fast HMR environment.

## How It Works

Starting the proxy spawns an instance of Wrangler using a template, passing through any commands and bindings that are supplied to the CLI.

In development mode, when interacting with a binding through the `binding('BINDING_NAME')` function, it sends HTTP requests to the proxy. These HTTP requests contain destructured function calls, which are then reconstructed and executed inside the proxy. The result is then returned to the client.

When building for production, `binding('BINDING_NAME')` simply calls `process.env.BINDING_NAME` to retrieve the binding instead.

## Supported

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
