# TPTP ANTLR Parser

These files are generated from:

- Repository: https://github.com/TPTPWorld/SyntaxBNF
- Branch: `master`
- Grammar: `BNFMetaGrammar/ANTLRGrammar/converted_by_meta/TPTP.g4`
- Upstream commit: `22e70448b43609ed0a7b3f777d190407db2db2da`
- [Pinned grammar source](https://github.com/TPTPWorld/SyntaxBNF/blob/22e70448b43609ed0a7b3f777d190407db2db2da/BNFMetaGrammar/ANTLRGrammar/converted_by_meta/TPTP.g4)
- Grammar SHA-256: `dbcf5b0cd565e15a6ebb6f4aecbca0d9a120d6fb9c57d2e213ea36665f892bd1`
- Fetched on: 2026-11-16
- Generator: ANTLR 4.13.2, JavaScript target (default listener enabled)

The upstream grammar is used without modifications.

Vendored files:

- `TPTPLexer.js`
- `TPTPParser.js`
- `TPTPListener.js`

The local `package.json` marks this folder as ESM so the generated parser can be
loaded from the CommonJS language server through a dynamic import boundary.

## Updating the vendored parser

1. Choose and record a full commit SHA from the upstream branch above. Fetch
   the grammar at that commit rather than from the moving branch name.
2. Save the grammar as `TPTP.g4` in a temporary directory and generate the
   JavaScript parser there:

   ```sh
   java -jar /path/to/antlr-4.13.2-complete.jar -Dlanguage=JavaScript -o generated TPTP.g4
   ```

3. Check that all three generated-file headers report the same ANTLR version.
4. Replace only the three generated files listed above. Keep the local
   `package.json`, which provides the required ESM boundary.
5. Update the upstream commit, pinned source link, grammar checksum, fetch date,
   and generator version at the top of this file.
6. If the generator version changed, update the matching JavaScript runtime and
   lockfile from the extension root (`tptplus`):

   ```sh
   npm install --prefix server --save-exact antlr4@<generator-version>
   ```

7. Review the generated-code diff, then compile and run the parser regression
   tests from the extension root (`tptplus`). Also exercise the experimental
   ANTLR command with a valid document and a known syntax error:

   ```sh
   npm run compile
   npm run test:unit
   ```

The root `precompile` lifecycle installs the dependencies recorded by
`server/package-lock.json` before compiling. The generated files themselves are
vendored source; `npm install` updates only the separate `antlr4` runtime.
