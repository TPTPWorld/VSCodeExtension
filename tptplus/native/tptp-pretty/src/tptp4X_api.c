#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include "tptp4X_api.h"

#include <stdio.h>
#include <stdlib.h>

#include "DataTypes.h"
#include "Utilities.h"
#include "FileUtilities.h"
#include "Tokenizer.h"
#include "Parsing.h"
#include "Signature.h"
#include "Examine.h"
#include "PrintTSTP.h"

typedef struct {
    READFILE InputStream;
    SIGNATURE Signature;
    ANNOTATEDFORMULA AnnotatedFormula;
    FILE * OutputStream;
    char * OutputBuffer;
    size_t OutputLength;
} TPTP4XPrettyState;

// Mirror the output spacing used by ./tptp4X -ftptp for formula streams.
static int PrintAnnotatedFormulaLikeFtptp(TPTP4XPrettyState * State, SyntaxType * LastNodeType) {

    SyntaxType ThisNodeType;

    ThisNodeType = GetSyntax(State->AnnotatedFormula);

    if ((*LastNodeType == tptp_thf ||
 *LastNodeType == tptp_tff || *LastNodeType == tptp_tcf ||
 *LastNodeType == tptp_fof || *LastNodeType == tptp_cnf ||
(*LastNodeType == tptp_tpi && ThisNodeType != tptp_tpi)) &&
ThisNodeType != blank_line) {
        if (fputc('\n', State->OutputStream) == EOF) {
            return(0);
        }
    }

    // Skip double blank lines
    if (*LastNodeType != blank_line || ThisNodeType != blank_line) {
        PrintAnnotatedTSTPNode(State->OutputStream, State->AnnotatedFormula, tptp, 1);
    }

    *LastNodeType = ThisNodeType;
    return(1);
}

// This runs on normal returns only. Fatal JJParser errors exit the disposable
// child process before control reaches this cleanup path.
static void CleanupPrettyState(TPTP4XPrettyState * State) {

    if (State == NULL) {
        return;
    }
    if (State->AnnotatedFormula != NULL && State->Signature != NULL) {
        FreeAnnotatedFormula(&(State->AnnotatedFormula), State->Signature);
    }
    if (State->InputStream != NULL) {
        CloseReadFile(State->InputStream);
    }
    if (State->Signature != NULL) {
        FreeSignature(&(State->Signature));
    }
    if (State->OutputStream != NULL) {
        fclose(State->OutputStream);
    }
    free(State->OutputBuffer);
    free(State);
}

// Pretty-print a complete TPTP input string using the same parser/printer
// settings as the command-line -ftptp mode, with output captured in memory.
char * tptp4x_pretty_print_tptp(const char * Input) {

    TPTP4XPrettyState * State;
    SyntaxType LastNodeType;
    int OldNeedNonLogicTokens;
    int OldWarnings;
    int OldSZSStatusReporting;
    char * Result;

    if (Input == NULL) {
        return(NULL);
    }

    State = (TPTP4XPrettyState *)calloc(1, sizeof(TPTP4XPrettyState));
    if (State == NULL) {
        return(NULL);
    }

    Result = NULL;
    OldNeedNonLogicTokens = GetNeedForNonLogicTokens();
    OldWarnings = GetWarnings();
    OldSZSStatusReporting = GetSZSStatusReporting();

    SetNeedForNonLogicTokens(1);
    SetAllowFreeVariables(0);
    SetWarnings(0);
    SetSZSStatusReporting(0);

    State->OutputStream = open_memstream(&(State->OutputBuffer), &(State->OutputLength));
    if (State->OutputStream == NULL) {
        goto finish;
    }

    State->InputStream = OpenStringReadFile((char *)Input);
    if (State->InputStream == NULL) {
        goto finish;
    }
    NextToken(State->InputStream);
    State->Signature = NewSignature();
    LastNodeType = nontype;

    while (!CheckTokenType(State->InputStream, endeof)) {
        State->AnnotatedFormula = ParseAndUseAnnotatedFormula(State->InputStream, State->Signature);
        if (State->AnnotatedFormula == NULL) {
            goto finish;
        }
        if (!PrintAnnotatedFormulaLikeFtptp(State, &LastNodeType)) {
            goto finish;
        }
        FreeAnnotatedFormula(&(State->AnnotatedFormula), State->Signature);
    }

    if (fclose(State->OutputStream) != 0) {
        State->OutputStream = NULL;
        goto finish;
    }
    State->OutputStream = NULL;
    Result = State->OutputBuffer;
    State->OutputBuffer = NULL;

finish:
    SetNeedForNonLogicTokens(OldNeedNonLogicTokens);
    SetAllowFreeVariables(0);
    SetWarnings(OldWarnings);
    SetSZSStatusReporting(OldSZSStatusReporting);
    CleanupPrettyState((TPTP4XPrettyState *)State);
    return(Result);
}

void tptp4x_free_string(char * Value) {

    free(Value);
}
