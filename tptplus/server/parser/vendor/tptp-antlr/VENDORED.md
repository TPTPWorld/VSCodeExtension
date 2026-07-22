# TPTP ANTLR Parser

These files are vendored from:

- Repository: https://github.com/TPTPWorld/SyntaxBNF
- Path: `ANTLRParsers/JavaScriptParser`
- Upstream commit: `da4fbddc9da7b066f03a4fd47edb148fa6e17c91`
- Fetched on: 2026-07-10
- Generator: ANTLR 4.13.2, as recorded in the generated file headers

Vendored files:

- `TPTPLexer.js`
- `TPTPParser.js`
- `TPTPListener.js`

The local `package.json` marks this folder as ESM so the generated parser can be
loaded from the CommonJS language server through a dynamic import boundary.

## Updating the vendored parser

1. Choose and record a full commit SHA from
   [TPTPWorld/SyntaxBNF](https://github.com/TPTPWorld/SyntaxBNF). Do not vendor
   files from a moving branch name.
2. Download these files from `ANTLRParsers/JavaScriptParser` at that commit into
   a temporary directory:
   - `TPTPLexer.js`
   - `TPTPParser.js`
   - `TPTPListener.js`
3. Check that all three generated-file headers report the same ANTLR version.
4. Replace only the three generated files listed above. Keep the local
   `package.json`, which provides the required ESM boundary.
5. Update the upstream commit, fetch date, and generator version at the top of
   this file.
6. If the generator version changed, update the matching JavaScript runtime and
   lockfile from the repository root:

   ```sh
   npm install --prefix server --save-exact antlr4@<generator-version>
   ```

7. Review the generated-code diff, then compile and exercise the Syntax command
   with both a valid TPTP document and a document containing a known syntax
   error:

   ```sh
   npm run compile
   ```

The root `precompile` lifecycle installs the dependencies recorded by
`server/package-lock.json` before compiling. The generated files themselves are
vendored source; `npm install` updates only the separate `antlr4` runtime.
