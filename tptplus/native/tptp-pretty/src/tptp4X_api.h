#ifndef TPTP4X_API_H
#define TPTP4X_API_H

#ifdef __cplusplus
extern "C" {
#endif

// The input is an entire file, possibly with comments and multiple formulae.
// Return the pretty-printed string. NULL means local wrapper failure.
// Fatal JJParser errors use JJParser's normal exit path, so call this
// directly only from a disposable process when parsing untrusted input.
char * tptp4x_pretty_print_tptp(const char * input);
void tptp4x_free_string(char * value);

#ifdef __cplusplus
}
#endif

#endif
