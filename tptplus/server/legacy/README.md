# Legacy server formatter

`prettyPrintTPTP.ts` preserves the original heuristic formatter for historical
reference. It is intentionally outside `src`, so the TypeScript server build
does not compile or advertise it.

The active formatter was retired because reliably identifying TPTP syntax
boundaries requires parser support. A future ANTLR-based implementation can
replace it without losing the work or context captured here.
