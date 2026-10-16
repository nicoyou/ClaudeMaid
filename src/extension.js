const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { patchAll, imageDataUri } = require('./patcher');
const { loadMaids } = require('./maids');

const CLAUDE_ID = 'anthropic.claude-code';

function activate(context) {
  const run = (announce) => apply(context, announce);

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeMaid.show', async () => {
      await vscode.workspace.getConfiguration('claudeMaid').update('enabled', true, vscode.ConfigurationTarget.Global);
      run(true);
    }),
    vscode.commands.registerCommand('claudeMaid.hide', async () => {
      await vscode.workspace.getConfiguration('claudeMaid').update('enabled', false, vscode.ConfigurationTarget.Global);
      run(true);
    }),
    vscode.commands.registerCommand('claudeMaid.reapply', () => run(true)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('claudeMaid')) run(false);
    }),
    // Claude Code が更新されて新しいバージョンのフォルダが増えたら即座に再適用する
    vscode.extensions.onDidChange(() => run(false)),
  );

  run(false);
}

function extensionsDir(context) {
  const claude = vscode.extensions.getExtension(CLAUDE_ID);
  return path.dirname(claude ? claude.extensionPath : context.extensionPath);
}

function apply(context, announce) {
  const cfg = vscode.workspace.getConfiguration('claudeMaid');
  try {
    let opts = null;
    if (cfg.get('enabled', true)) {
      const greeting = (cfg.get('greeting') || '').trim();
      let maids = loadMaids(context.extensionPath, cfg.get('character', 'random'), greeting);
      const custom = (cfg.get('imagePath') || '').trim();
      if (custom) {
        if (fs.existsSync(custom)) maids = [{ id: 'custom', imageUri: imageDataUri(custom), lines: greeting ? [greeting] : [] }];
        else vscode.window.showWarningMessage(`Claude Maid: 画像が見つかりません: ${custom}(標準のメイドさんを使います)`);
      }
      opts = {
        maids,
        size: cfg.get('size', 100),
        offsetRight: cfg.get('offsetRight', 14),
        fadeOpacity: cfg.get('fadeOpacity', 0.2),
        showGreeting: cfg.get('showGreeting', true) && maids.some((m) => m.lines.length > 0),
        greetingSeconds: cfg.get('greetingSeconds', 3.5),
      };
    }

    const changed = patchAll(extensionsDir(context), opts);
    if (changed.length > 0 || announce) promptReload(opts ? 'メイドさんを配置しました' : 'メイドさんはお休み中です');
  } catch (err) {
    vscode.window.showErrorMessage(`Claude Maid: 適用に失敗しました: ${err.message}`);
  }
}

async function promptReload(message) {
  const pick = await vscode.window.showInformationMessage(
    `${message}。Claude のパネルに反映するにはウィンドウを再読み込みしてください。`,
    '再読み込み',
  );
  if (pick) vscode.commands.executeCommand('workbench.action.reloadWindow');
}

function deactivate() {}

module.exports = { activate, deactivate };
