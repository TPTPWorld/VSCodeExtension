import { errorMessage } from '../errorMessage';
import {
  extractSystemB4TptpOutput,
  lastNonemptyLine
} from '../systemB4TptpOutput';
import { createSystemB4TptpForm } from '../systemTptpForms';
import type { PrettyPrintFormatterResult } from './types';

const SYSTEM_ON_TPTP_URL = 'https://tptp.org/cgi-bin/SystemOnTPTPFormReply';

/** Formats TPTP source using the SystemB4TPTP remote pretty-printer. */
export async function formatTptpRemotely(
  sourceText: string
): Promise<PrettyPrintFormatterResult> {
  try {
    const response = await fetch(SYSTEM_ON_TPTP_URL, {
      method: 'POST',
      body: createSystemB4TptpForm(sourceText, null)
    });

    if (!response.ok) {
      return {
        kind: 'failure',
        message: `HTTP ${response.status}: ${response.statusText || 'request failed'}`,
      };
    }

    const output = extractSystemB4TptpOutput(await response.text());
    if (output === undefined) {
      return { kind: 'failure', message: 'unrecognized response' };
    }

    const lastLine = lastNonemptyLine(output);
    if (lastLine?.startsWith('ERROR: ')) {
      return { kind: 'source-error', message: lastLine };
    }

    return { kind: 'success', output };
  } catch (error: unknown) {
    return { kind: 'failure', message: errorMessage(error) };
  }
}
