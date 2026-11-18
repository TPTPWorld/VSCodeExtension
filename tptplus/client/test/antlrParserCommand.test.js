const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function cancellationSource() {
  const listeners = new Set();
  const token = {
    isCancellationRequested: false,
    onCancellationRequested(listener) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    }
  };
  return {
    token,
    cancel() {
      token.isCancellationRequested = true;
      for (const listener of [...listeners]) listener();
    }
  };
}

const success = {
  ok: true,
  diagnostics: [],
  summary: { elapsedMs: 25, syntaxErrorCount: 0 }
};
const syntaxError = {
  ok: false,
  diagnostics: [{
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    message: 'Unexpected token',
    severity: 1
  }],
  summary: { elapsedMs: 30, syntaxErrorCount: 1 }
};

function setup(sendRequest, clientReady = Promise.resolve()) {
  const requestStarted = deferred();
  const progressStarted = deferred();
  const state = {
    requests: [], contexts: [], messages: [], diagnostics: [], log: [],
    progressOptions: [], progressSources: [], progressActive: false,
    shownDocuments: [], revealedRanges: [], outputShows: 0,
  };
  const document = {
    languageId: 'tptp', version: 1, isClosed: false, fileName: '/tmp/command-test.p',
    uri: { scheme: 'file', fsPath: '/tmp/command-test.p', toString: () => 'file:///tmp/command-test.p' }
  };
  const disposable = { dispose() {} };
  const notify = kind => message => state.messages.push({ kind, message, progressActive: state.progressActive });
  const vscode = {
    ProgressLocation: { Notification: 15 },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    TextEditorRevealType: { InCenterIfOutsideViewport: 2 },
    Range: class {
      constructor(startLine, startCharacter, endLine, endCharacter) {
        this.start = { line: startLine, character: startCharacter };
        this.end = { line: endLine, character: endCharacter };
      }
    },
    Diagnostic: class {
      constructor(range, message, severity) {
        Object.assign(this, { range, message, severity });
      }
    },
    Selection: class {
      constructor(anchor, active) { Object.assign(this, { anchor, active }); }
    },
    Disposable: { from: (...items) => ({ dispose: () => items.forEach(item => item.dispose()) }) },
    window: {
      activeTextEditor: { document },
      createOutputChannel: () => ({
        ...disposable,
        appendLine: line => state.log.push(line),
        show: () => state.outputShows++
      }),
      async showTextDocument(document, options) {
        state.shownDocuments.push({ document, options });
        const editor = {
          revealRange: (range, revealType) => state.revealedRanges.push({ range, revealType })
        };
        state.revealedEditor = editor;
        return editor;
      },
      showInformationMessage: notify('info'),
      showWarningMessage: notify('warning'),
      showErrorMessage: notify('error'),
      async withProgress(options, task) {
        const source = cancellationSource();
        state.progressOptions.push(options);
        state.progressSources.push(source);
        state.progressActive = true;
        progressStarted.resolve(source);
        try {
          return await task({ report() {} }, source.token);
        } finally {
          state.progressActive = false;
        }
      }
    },
    languages: {
      createDiagnosticCollection: () => ({
        ...disposable,
        set: (uri, diagnostics) => state.diagnostics.push({ uri, diagnostics }),
        delete() {}
      })
    },
    commands: {
      registerCommand(_id, handler) { state.command = handler; return disposable; },
      async executeCommand(...args) { state.contexts.push(args); }
    },
    workspace: {
      onDidChangeTextDocument(handler) { state.changed = handler; return disposable; }
    }
  };
  state.switchEditor = document => { vscode.window.activeTextEditor = { document }; };

  // Load the compiled command with an isolated VS Code mock; other tests keep
  // their normal require cache and modules.
  function loadModule(filename) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      exports: module.exports,
      module,
      require(id) {
        if (id === 'vscode') return vscode;
        if (id === './diagnostics') return loadModule(require.resolve('../out/antlrParser/diagnostics'));
        return require(id);
      },
      __dirname: path.dirname(filename),
      __filename: filename
    }, { filename });
    return module.exports;
  }
  const command = loadModule(require.resolve('../out/antlrParser/command'));
  state.registration = command.registerAntlrParserCommand({
    sendRequest(...args) {
      state.requests.push(args);
      requestStarted.resolve(args);
      return sendRequest(...args);
    }
  }, clientReady);

  return { state, document, requestStarted: requestStarted.promise, progressStarted: progressStarted.promise };
}

test('shows cancellable progress followed by a completion notification', async () => {
  const response = deferred();
  const { state, requestStarted } = setup(() => response.promise);
  const pending = state.command();
  const [method, params, token] = await requestStarted;

  assert.equal(method, 'tptp/experimentalParseWithAntlr');
  assert.equal(params.uri, 'file:///tmp/command-test.p');
  assert.equal(token, state.progressSources[0].token);
  assert.equal(state.progressOptions[0].cancellable, true);
  assert.equal(state.progressOptions[0].location, 15);
  assert.equal(state.messages.length, 0);
  await state.command();
  assert.equal(state.requests.length, 1, 'duplicate invocations must not start another worker');

  response.resolve(success);
  await pending;
  assert.deepEqual(state.messages.at(-1), {
    kind: 'info', message: 'ANTLR parse succeeded in 25ms.', progressActive: false
  });
  assert.equal(state.diagnostics.length, 1);
  assert.equal(state.outputShows, 0);
  assert.equal(state.shownDocuments.length, 0);
  assert.deepEqual(state.contexts.map(args => args[2]), [true, false]);
});

test('opens Problems and highlights the first ANTLR error in the requested file', async () => {
  const response = deferred();
  const { state, document, requestStarted } = setup(() => response.promise);
  const pending = state.command();
  await requestStarted;
  // Completion must navigate back to the parsed file after the user switches tabs.
  const otherDocument = {
    ...document,
    fileName: '/tmp/other.p',
    uri: { scheme: 'file', fsPath: '/tmp/other.p', toString: () => 'file:///tmp/other.p' }
  };
  state.switchEditor(otherDocument);
  const firstError = {
    ...syntaxError.diagnostics[0],
    range: { start: { line: 4, character: 7 }, end: { line: 4, character: 10 } }
  };
  response.resolve({
    ...syntaxError,
    diagnostics: [firstError, {
      ...syntaxError.diagnostics[0],
      range: { start: { line: 8, character: 0 }, end: { line: 8, character: 1 } }
    }],
    summary: { elapsedMs: 30, syntaxErrorCount: 2 }
  });
  await pending;

  assert.equal(state.diagnostics[0].uri, document.uri);
  assert.equal(state.diagnostics[0].diagnostics.length, 2);
  assert.equal(state.outputShows, 0);
  assert.equal(state.contexts.filter(args => args[0] === 'workbench.action.showErrorsWarnings').length, 1);
  assert.equal(state.shownDocuments.length, 1);
  assert.equal(state.shownDocuments[0].document, document);
  assert.equal(state.shownDocuments[0].options.preview, false);
  assert.deepEqual(state.shownDocuments[0].options.selection.start, firstError.range.start);
  assert.deepEqual(state.shownDocuments[0].options.selection.end, firstError.range.end);
  assert.deepEqual(state.revealedEditor.selection.anchor, firstError.range.start);
  assert.deepEqual(state.revealedEditor.selection.active, firstError.range.end);
  assert.equal(state.revealedRanges[0].range, state.diagnostics[0].diagnostics[0].range);
  assert.equal(state.revealedRanges[0].revealType, 2);
  assert.deepEqual(state.messages.at(-1), {
    kind: 'warning', message: 'ANTLR parse found 2 error(s).', progressActive: false
  });
});

test('cancellation closes progress, ignores late results, and permits another run', async () => {
  const response = deferred();
  let calls = 0;
  const { state, requestStarted } = setup(() => ++calls === 1 ? response.promise : Promise.resolve(success));
  const pending = state.command();
  const [, , token] = await requestStarted;
  state.progressSources[0].cancel();
  await pending;

  assert.equal(token.isCancellationRequested, true);
  assert.deepEqual(state.messages, [{ kind: 'info', message: 'ANTLR parse cancelled.', progressActive: false }]);
  assert.equal(state.diagnostics.length, 0);
  assert.equal(state.contexts.at(-1)[2], false);

  await state.command();
  response.resolve(syntaxError);
  await response.promise;
  assert.equal(state.requests.length, 2);
  assert.equal(state.diagnostics.length, 1, 'the cancelled result must never publish diagnostics');
  assert.equal(state.messages.at(-1).message, 'ANTLR parse succeeded in 25ms.');
});

test('can cancel while the language client is starting', async () => {
  const ready = deferred();
  const { state, progressStarted } = setup(async () => success, ready.promise);
  const pending = state.command();
  const source = await progressStarted;
  source.cancel();
  await pending;

  assert.equal(state.requests.length, 0);
  assert.equal(state.messages.at(-1).message, 'ANTLR parse cancelled.');
  ready.resolve();
  await state.command();
  assert.equal(state.requests.length, 1, 'the cancelled startup must not send a request later');
});

for (const change of ['edited', 'closed']) {
  test(`discards results when the document is ${change} during parsing`, async () => {
    const response = deferred();
    const { state, document, requestStarted } = setup(() => response.promise);
    const pending = state.command();
    await requestStarted;
    if (change === 'edited') {
      document.version++;
      state.changed({ document });
    } else {
      document.isClosed = true;
    }
    response.resolve(syntaxError);
    await pending;

    assert.equal(state.diagnostics.length, 0);
    assert.equal(state.messages.at(-1).kind, 'warning');
    assert.match(state.messages.at(-1).message, /Please run the parser again/);
  });
}

test('reports request failures and resets the running state', async () => {
  const { state } = setup(async () => { throw new Error('Worker failed'); });
  await state.command();

  assert.equal(state.messages.at(-1).kind, 'error');
  assert.match(state.messages.at(-1).message, /Worker failed/);
  assert.equal(state.messages.at(-1).progressActive, false);
  assert.equal(state.contexts.at(-1)[2], false);
  assert.equal(state.diagnostics.length, 0);
  await state.command();
  assert.equal(state.requests.length, 2);
});
