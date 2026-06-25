# TPTP Pretty-Printer WASM Runtime

This directory is for maintainers who need to refresh the packaged local
pretty-printer runtime. The extension ships the generated files from
`client/resources/wasm`, so users do not need CMake, Emscripten, JJParser, or
network access.

The build fetches only JJParser from the fork configured in `CMakeLists.txt`,
pinned by `JJPARSER_GIT_TAG`. It does not fetch or build TPTP4X; the small
string-to-string pretty-print API in `src/tptp4X_api.c` is copied into this
repository. JJParser is compiled with `JJPARSER_DISABLE_CURL` so the WASM
runtime does not link curl.

From `tptplus`, run:

```sh
npm run build:wasm
```

The build copies `tptp4X_wasm.js` and `tptp4X_wasm.wasm` into
`client/resources/wasm`.
