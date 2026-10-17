const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const { patchAll, imageDataUri } = require("./patcher");
const { loadMaids } = require("./maids");

const CLAUDE_CODE_EXTENSION_ID = "anthropic.claude-code";

function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand("claudeMaid.show", async () => {
            await vscode.workspace.getConfiguration("claudeMaid").update("enabled", true, vscode.ConfigurationTarget.Global);
            apply(context, true);
        }),
        vscode.commands.registerCommand("claudeMaid.hide", async () => {
            await vscode.workspace.getConfiguration("claudeMaid").update("enabled", false, vscode.ConfigurationTarget.Global);
            apply(context, true);
        }),
        vscode.commands.registerCommand("claudeMaid.reapply", () => apply(context, true)),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration("claudeMaid")) apply(context, false);
        }),
        // Claude Code が更新されて新しいバージョンのフォルダが増えたら即座に再適用する
        vscode.extensions.onDidChange(() => apply(context, false)),
    );

    apply(context, false);
}

/** Claude Code がインストールされている extensions フォルダ */
function getExtensionsDirectory(context) {
    const claudeCodeExtension = vscode.extensions.getExtension(CLAUDE_CODE_EXTENSION_ID);
    return path.dirname(claudeCodeExtension ? claudeCodeExtension.extensionPath : context.extensionPath);
}

/**
 * 現在の設定でメイドさんを配置し直す
 * @param {boolean} isManual コマンドから呼ばれた場合は、書き換えがなくても再読み込みを案内する
 */
function apply(context, isManual) {
    const configuration = vscode.workspace.getConfiguration("claudeMaid");
    try {
        let options = null;
        if (configuration.get("enabled", true)) {
            const greeting = (configuration.get("greeting") || "").trim();
            let maids = loadMaids(context.extensionPath, configuration.get("character", "random"), greeting);
            const customImagePath = (configuration.get("imagePath") || "").trim();
            if (customImagePath) {
                if (fs.existsSync(customImagePath)) {
                    maids = [{ id: "custom", imageUri: imageDataUri(customImagePath), lines: greeting ? [greeting] : [] }];
                }
                else {
                    vscode.window.showWarningMessage(`Claude Maid: 画像が見つかりません: ${customImagePath} ( 標準のメイドさんを使います )`);
                }
            }
            options = {
                maids,
                size: configuration.get("size", 100),
                offsetRight: configuration.get("offsetRight", 14),
                fadeOpacity: configuration.get("fadeOpacity", 0.2),
                isGreetingShown: configuration.get("showGreeting", true) && maids.some((maid) => maid.lines.length > 0),
                greetingSeconds: configuration.get("greetingSeconds", 3.5),
            };
        }

        const changedDirectories = patchAll(getExtensionsDirectory(context), options);
        if (changedDirectories.length > 0 || isManual) promptReload(options ? "メイドさんを配置しました" : "メイドさんはお休み中です");
    } catch (error) {
        vscode.window.showErrorMessage(`Claude Maid: 適用に失敗しました: ${error.message}`);
    }
}

async function promptReload(message) {
    const selectedAction = await vscode.window.showInformationMessage(
        `${message}。Claude のパネルに反映するにはウィンドウを再読み込みしてください。`,
        "再読み込み",
    );
    if (selectedAction) vscode.commands.executeCommand("workbench.action.reloadWindow");
}

function deactivate() {}

module.exports = { activate, deactivate };
