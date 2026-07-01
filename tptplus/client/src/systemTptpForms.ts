type FormField = readonly [name: string, value: string];
type FormFields = readonly FormField[];

const SYSTEM_B4_TPTP_FORM_FIELDS: FormFields = [
  ['SubmitButton', 'ProcessProblem'],
  ['TimeLimit___AddTypes---1.2.4', '60'],
  ['Transform___AddTypes---1.2.4', 'none'],
  ['Format___AddTypes---1.2.4', 'tptp:raw'],
  ['Command___AddTypes---1.2.4', 'run_addtypes %s'],
  ['TimeLimit___ASk---0.2.3', '60'],
  ['Transform___ASk---0.2.3', 'none'],
  ['Format___ASk---0.2.3', 'tptp:raw'],
  ['Command___ASk---0.2.3', 'run_ASk %s'],
  ['TimeLimit___BNFParser---0.0', '60'],
  ['Transform___BNFParser---0.0', 'none'],
  ['Format___BNFParser---0.0', 'tptp:raw'],
  ['Command___BNFParser---0.0', 'BNFParser %s'],
  ['TimeLimit___BNFParserTree---0.0', '60'],
  ['Transform___BNFParserTree---0.0', 'none'],
  ['Format___BNFParserTree---0.0', 'tptp:raw'],
  ['Command___BNFParserTree---0.0', 'BNFParserTree %s'],
  ['TimeLimit___CheckTyping---0.0', '60'],
  ['Transform___CheckTyping---0.0', 'none'],
  ['Format___CheckTyping---0.0', 'tptp:raw'],
  ['Command___CheckTyping---0.0', 'CheckTyping -all %s'],
  ['TimeLimit___ECNF---3.2.5', '60'],
  ['Transform___ECNF---3.2.5', 'none'],
  ['Format___ECNF---3.2.5', 'tptp:raw'],
  ['Command___ECNF---3.2.5', 'run_ECNF %d %s'],
  ['TimeLimit___EGround---3.2.5', '60'],
  ['Transform___EGround---3.2.5', 'add_equality'],
  ['Format___EGround---3.2.5', 'tptp:raw'],
  ['Command___EGround---3.2.5', 'eground --tstp-in --tstp-out --silent --resources-info --split-tries=100 --memory-limit=200 --soft-cpu-limit=%d --add-one-instance --constraints %s'],
  ['TimeLimit___ESelect---3.2.5', '60'],
  ['Transform___ESelect---3.2.5', 'none'],
  ['Format___ESelect---3.2.5', 'tptp:raw'],
  ['Command___ESelect---3.2.5', 'eprover --sine=Auto --prune %s'],
  ['TimeLimit___GetSymbols---0.0', '60'],
  ['Transform___GetSymbols---0.0', 'none'],
  ['Format___GetSymbols---0.0', 'tptp:raw'],
  ['Command___GetSymbols---0.0', 'GetSymbols -all %s'],
  ['TimeLimit___Horn2UEQ---0.4.1', '60'],
  ['Transform___Horn2UEQ---0.4.1', 'none'],
  ['Format___Horn2UEQ---0.4.1', 'tptp:raw'],
  ['Command___Horn2UEQ---0.4.1', 'jukebox_horn2ueq %s'],
  ['TimeLimit___Isabelle---2FOF', '60'],
  ['Transform___Isabelle---2FOF', 'none'],
  ['Format___Isabelle---2FOF', 'tptp'],
  ['Command___Isabelle---2FOF', 'run_isabelle_2X FOF %s'],
  ['TimeLimit___Isabelle---2TF0', '60'],
  ['Transform___Isabelle---2TF0', 'none'],
  ['Format___Isabelle---2TF0', 'tptp'],
  ['Command___Isabelle---2TF0', 'run_isabelle_2X TF0 %s'],
  ['TimeLimit___Isabelle---2TH0', '60'],
  ['Transform___Isabelle---2TH0', 'none'],
  ['Format___Isabelle---2TH0', 'tptp'],
  ['Command___Isabelle---2TH0', 'run_isabelle_2X TH0 %s'],
  ['TimeLimit___Leo-III-STC---1.7.18', '60'],
  ['Transform___Leo-III-STC---1.7.18', 'none'],
  ['Format___Leo-III-STC---1.7.18', 'tptp:raw'],
  ['Command___Leo-III-STC---1.7.18', 'run_Leo-III %s %d STC'],
  ['TimeLimit___Monotonox---0.4.1', '60'],
  ['Transform___Monotonox---0.4.1', 'none'],
  ['Format___Monotonox---0.4.1', 'tptp:raw'],
  ['Command___Monotonox---0.4.1', 'jukebox monotonox %s'],
  ['TimeLimit___Monotonox-2CNF---0.4.1', '60'],
  ['Transform___Monotonox-2CNF---0.4.1', 'none'],
  ['Format___Monotonox-2CNF---0.4.1', 'tptp:raw'],
  ['Command___Monotonox-2CNF---0.4.1', 'jukebox_cnf %s'],
  ['TimeLimit___Monotonox-2FOF---0.4.1', '60'],
  ['Transform___Monotonox-2FOF---0.4.1', 'none'],
  ['Format___Monotonox-2FOF---0.4.1', 'tptp:raw'],
  ['Command___Monotonox-2FOF---0.4.1', 'jukebox_fof %s'],
  ['TimeLimit___NTFLET---1.8.5', '60'],
  ['Transform___NTFLET---1.8.5', 'none'],
  ['Format___NTFLET---1.8.5', 'tptp:raw'],
  ['Command___NTFLET---1.8.5', 'run_embed %s'],
  ['TimeLimit___ProblemStats---1.0', '60'],
  ['Transform___ProblemStats---1.0', 'none'],
  ['Format___ProblemStats---1.0', 'tptp:raw'],
  ['Command___ProblemStats---1.0', 'run_MakeListStats %s'],
  ['TimeLimit___Prophet---0.0', '60'],
  ['Transform___Prophet---0.0', 'none'],
  ['Format___Prophet---0.0', 'tptp'],
  ['Command___Prophet---0.0', 'prophet %s'],
  ['TimeLimit___Saffron---4.5', '60'],
  ['Transform___Saffron---4.5', 'none'],
  ['Format___Saffron---4.5', 'tptp:raw'],
  ['Command___Saffron---4.5', 'run_saffron %s %d'],
  ['TimeLimit___SPCForProblem---1.0', '60'],
  ['Transform___SPCForProblem---1.0', 'none'],
  ['Format___SPCForProblem---1.0', 'tptp:raw'],
  ['Command___SPCForProblem---1.0', 'run_SPCForProblem %s'],
  ['TimeLimit___TPII---0.0', '60'],
  ['Transform___TPII---0.0', 'none'],
  ['Format___TPII---0.0', 'tptp:raw'],
  ['Command___TPII---0.0', 'TPII %s'],
  ['TimeLimit___TPTP2JSON---0.1', '60'],
  ['Transform___TPTP2JSON---0.1', 'none'],
  ['Format___TPTP2JSON---0.1', 'tptp:raw'],
  ['Command___TPTP2JSON---0.1', 'run_tptp2json %s'],
  ['TimeLimit___TPTP2X---0.0', '60'],
  ['Transform___TPTP2X---0.0', 'none'],
  ['Format___TPTP2X---0.0', 'tptp:raw'],
  ['Command___TPTP2X---0.0', 'tptp2X -q2 -d- %s'],
  ['TimeLimit___TPTP4X---0.0', '60'],
  ['Transform___TPTP4X---0.0', 'none'],
  ['Format___TPTP4X---0.0', 'tptp:raw'],
  ['Command___TPTP4X---0.0', 'tptp4X %s'],
  ['TimeLimit___VCNF---4.8', '60'],
  ['Transform___VCNF---4.8', 'none'],
  ['Format___VCNF---4.8', 'tptp:raw'],
  ['Command___VCNF---4.8', 'run_vclausify_rel %s %d'],
  ['TimeLimit___VSelect---4.4', '60'],
  ['Transform___VSelect---4.4', 'none'],
  ['Format___VSelect---4.4', 'tptp:raw'],
  ['Command___VSelect---4.4', 'run_sine_select %s'],
  ['TimeLimit___Why3-FOF---0.85', '60'],
  ['Transform___Why3-FOF---0.85', 'none'],
  ['Format___Why3-FOF---0.85', 'tptp:raw'],
  ['Command___Why3-FOF---0.85', 'bin/why3 prove -F tptp -C /home/tptp/Systems/Why3---0.85/why3.conf -D /home/tptp/Systems/Why3---0.85/Source/drivers/tptp.gen %s'],
  ['TimeLimit___Why3-TF0---0.85', '60'],
  ['Transform___Why3-TF0---0.85', 'none'],
  ['Format___Why3-TF0---0.85', 'tptp:raw'],
  ['Command___Why3-TF0---0.85', 'bin/why3 prove -F tptp -C /home/tptp/Systems/Why3---0.85/why3.conf -D /home/tptp/Systems/Why3---0.85/Source/drivers/tptp-tff0.drv %s'],
];

function appendFormFields(form: FormData, fields: FormFields): void {
  for (const [name, value] of fields) {
    form.append(name, value);
  }
}

export function createSystemB4TptpForm(sourceText: string, prover: string | null): FormData {
  const form = new FormData();
  appendFormFields(form, [
    ['TPTPProblem', ''],
    ['ProblemSource', 'FORMULAE'],
    ['FORMULAEProblem', sourceText],
    ['UPLOADProblem', ''],
    ['FormulaURL', ''],
    ['InputFormat', 'TPTP'],
    ['QuietFlag', '-q01'],
  ]);
  if (prover) {
    form.append(`System___${prover}`, prover);
  }
  appendFormFields(form, SYSTEM_B4_TPTP_FORM_FIELDS);
  return form;
}

// export function createSystemB4TptpPrepareForm(sourceText: string, prover: string | null): FormData {
//   return createSystemB4TptpForm(sourceText, prover);
// }
// export function createSystemB4TptpFormatForm(sourceText: string): FormData {
//   return createSystemB4TptpForm(sourceText, null);
// }

// TODO: refactor other hard-coded forms in `extension.ts`.
