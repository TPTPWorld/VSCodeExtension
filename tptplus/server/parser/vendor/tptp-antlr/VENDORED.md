# TPTP ANTLR Parser

Both grammar variants and their generated JavaScript parsers are kept here:

- `original/`: unmodified output of the metagrammar-based converter.
- `optimized/`: that output after applying the guarded Trash TFF postprocessor.

Set `USE_OPTIMIZED_ANTLR_GRAMMAR` at the beginning of
[`client/src/antlrParser/command.ts`](../../../../client/src/antlrParser/command.ts)
to `true` for the optimized grammar or `false` for the original grammar.
Run `npm run compile` from `tptplus`, then reload the extension. The command passes
the choice to the server and parser worker; its output log names the selected
grammar. The server caches each variant separately.

Both variants come from:

- Repository: https://github.com/TPTPWorld/SyntaxBNF
- Branch: `master`
- Upstream commit: `22e70448b43609ed0a7b3f777d190407db2db2da`
- [Pinned BNF input](https://github.com/TPTPWorld/SyntaxBNF/blob/22e70448b43609ed0a7b3f777d190407db2db2da/SyntaxBNF-v10.0.0.1)
- [Pinned converter](https://github.com/TPTPWorld/SyntaxBNF/blob/22e70448b43609ed0a7b3f777d190407db2db2da/BNFMetaGrammar/BNF2ANTLR/bnf2antlr_meta.py)
- Raw grammar SHA-256: `1522eccb8b05167e45eede09a3718ba814496c87fa5cb330ba217fc78214abcd`
- Optimized grammar SHA-256: `ff867ebc49d564191381827273410092a92982ab239d5dccb07300a4dd144ece`
- Regenerated on: 2026-11-19
- Generator: ANTLR 4.13.2, JavaScript target (default listener enabled)

The postprocessor is the local experiment in the SyntaxBNF checkout at
`BNFMetaGrammar/BNF2ANTLR/experiments/trash412/`, described in its `README.md`.
These files are not part of the pinned upstream commit:

- `factor.py` SHA-256: `6752c0c127cc884a77a207b56b752cda702e53b50cb99c5afb59f80710419f6c`
- `factor_tff.xq` SHA-256: `e376d64077859a1c3de5661ef8ee90366df10dd1a327c9fbf1f9bd580e9809f8`
- Postprocessor tools: Trash 4.12.0, local .NET 10.0.15 runtime

The rewrite factors `tff_logic_formula` and `tff_unit_formula` and adds
`bnf2antlr_tff_formula_term` and `bnf2antlr_tff_infix_tail`. Its guards check the
dependent productions, helper-name collisions, and repeat application. The
wrapper verifies a byte-identical no-op roundtrip, reparses the optimized grammar,
preserves the lexer section, and validates the result with stock ANTLR.

Only grammar generation needs Python, Java, Trash, and .NET. The extension
command loads the generated JavaScript below using `antlr4` 4.13.2;
postprocessing is not run during extension builds or document parsing. Parse
trees are disabled by the command. Factoring changes parse-tree structure and
may change syntax-error wording.

Each variant directory contains:

- `TPTP.g4`
- `TPTPLexer.js`
- `TPTPParser.js`
- `TPTPListener.js`

The local `package.json` marks this folder and both variant directories as ESM so
the generated parsers can be loaded from the CommonJS language server through a
dynamic import boundary.

## Updating the vendored parser

1. Choose and record a full commit SHA from the upstream branch above. Check out
   that revision, retaining the local experiment and its tools. Use the Python
   environment with the converter's requirements installed (locally,
   `/home/xiaji/miniconda3/envs/202610_SyntaxBNF/bin/python`).
2. Generate the raw grammar, run the postprocessor into a separate directory,
   then generate JavaScript from both grammars. For example, in Bash:

   ```bash
   syntax_bnf=/path/to/SyntaxBNF
   bnf_python=/path/to/converter-environment/bin/python
   antlr_jar="$syntax_bnf/ANTLRParsers/antlr-4.13.2-complete.jar"
   antlr_build=$(mktemp -d)

   "$bnf_python" "$syntax_bnf/BNFMetaGrammar/BNF2ANTLR/bnf2antlr_meta.py" \
     "$syntax_bnf/SyntaxBNF-v10.0.0.1" -o "$antlr_build/raw/TPTP.g4"
   "$bnf_python" "$syntax_bnf/BNFMetaGrammar/BNF2ANTLR/experiments/trash412/factor.py" \
     "$antlr_build/raw/TPTP.g4" -o "$antlr_build/factored/TPTP.g4" \
     --tools-dir "$syntax_bnf/BNFMetaGrammar/.tools/factoring" \
     --antlr-jar "$antlr_jar" --report "$antlr_build/factoring.json"
   (
     cd "$antlr_build/raw"
     java -jar "$antlr_jar" -Dlanguage=JavaScript -o generated TPTP.g4
   )
   (
     cd "$antlr_build/factored"
     java -jar "$antlr_jar" -Dlanguage=JavaScript -o generated TPTP.g4
   )
   ```

3. Check the transformation report, grammar checksums, and generated-file headers.
   Do not skip a failing transformation guard; review changes to the upstream
   grammar and query together. Verify that the raw lexer is byte-identical to the
   optimized lexer.
4. Copy the raw `TPTP.g4` and its three generated JavaScript files to `original/`.
   Copy the factored `TPTP.g4` and its three generated JavaScript files to
   `optimized/`. Keep the local `package.json`, which provides the required ESM
   boundary for both directories. The root `.gitignore` has exceptions for the
   two grammar paths so both grammars are versioned alongside their parsers.
5. Update the upstream commit, pinned source links, grammar and postprocessor
   checksums, regeneration date, and tool versions at the top of this file.
6. If the generator version changed, update the matching JavaScript runtime and
   lockfile from the extension root (`tptplus`):

   ```sh
   npm install --prefix server --save-exact antlr4@<generator-version>
   ```

7. Review the generated-code diff, then compile and run the parser regression
   tests from the extension root (`tptplus`). Also exercise the
   ANTLR command with a valid document and a known syntax error for both values
   of `USE_OPTIMIZED_ANTLR_GRAMMAR`:

   ```sh
   npm run compile
   npm run test:unit
   ```

The root `precompile` lifecycle installs the dependencies recorded by
`server/package-lock.json` before compiling. The generated files themselves are
vendored source; `npm install` updates only the separate `antlr4` runtime.

## Validation of this update

The experiment's `run.py` was rerun against fresh converter output. All 371 TPTP
checks passed: 355 differential cases, 12 corpus files with independently counted
statements, and four malformed corpus edits. Three prefix examples and all three
negative transformation guards also passed. The raw generated JavaScript was
byte-identical to the previously vendored files, and the optimized lexer remains
byte-identical.

Fresh-process measurements with Node v24.12.0, ANTLR 4.13.2, and parse trees
disabled (lexing and parsing included; module imports excluded):

| Input | Raw parser | Optimized parser |
| --- | ---: | ---: |
| 16 nested implications | 478 ms | 24 ms |
| 32 nested implications | 894 ms | 25 ms |
| 64 nested implications | 1,829 ms | 26 ms |
| 107 nested implications | 3,988 ms | 27 ms |
| `ITP006_7.p` | Stopped at 10 s | 181 ms, 213 statements, no errors |

These are single observations, not complexity guarantees. The corpus baseline
did not complete before its process deadline. Recursion-depth limits still apply.
