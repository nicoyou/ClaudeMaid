# Claude Maid

Claude Code のチャット入力欄右上に、ちっちゃいメイドさんを常駐させます。

- ときどき、にっこりまばたきします
- Claude Code が更新されても自動で再配置します

## 仕組み

VS Code の拡張機能は、ほかの拡張機能の Webview の中には描画できません。
そこで Claude Code の `webview/index.css` の末尾に、メイドさん用の CSS を目印コメントで挟んで追記しています。
Claude Code 本体のコードには手を加えていません。

## コマンド(Ctrl+Shift+P)

| コマンド | 内容 |
| --- | --- |
| Claude Maid: メイドさんを呼ぶ | 表示する |
| Claude Maid: メイドさんをお休みさせる | CSS を取り除く |
| Claude Maid: メイドさんを再配置する | 手動で再適用する |

## 設定

`claudeMaid.size` / `claudeMaid.offsetRight` /
`claudeMaid.greeting` / `claudeMaid.greetingSeconds` / `claudeMaid.imagePath`

`imagePath` に好きな画像を指定すれば、ほかのキャラクターにも差し替えられます。

## ビルドとインストール

```sh
npx @vscode/vsce package
code --install-extension claude-maid-<version>.vsix
```

インストールしたら、ウィンドウを再読み込みしてください。
アンインストールすると、追記した CSS も自動で取り除かれます。

## フォルダ構成

| 場所 | 内容 |
| --- | --- |
| `src/` | 拡張機能本体(`extension.js`)、CSS を書き換える処理(`patcher.js`)、アンインストール処理(`uninstall.js`) |
| `media/maid.svg` | メイドさんの絵 |

## ライセンス

[MIT](LICENSE)
