// Claude Code の webview/index.css にメイドさん用の CSS を追記・除去する
// vscode API に依存しないので、アンインストールスクリプトからも使える
const fs = require('fs');
const path = require('path');

const START = '/* ==== claude-maid:start ==== */';
const END = '/* ==== claude-maid:end ==== */';
const BLOCK_RE = /\n?\/\* ==== claude-maid:start ==== \*\/[\s\S]*?\/\* ==== claude-maid:end ==== \*\/\n?/g;
const FALLBACK_CLASS = 'inputContainer_cKsPxg';

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

/** extensions フォルダ内の Claude Code 拡張 ( 全バージョン ) を列挙する */
function findClaudeDirs(extensionsDir) {
  if (!fs.existsSync(extensionsDir)) return [];
  return fs.readdirSync(extensionsDir)
    .filter((name) => /^anthropic\.claude-code-/.test(name))
    .map((name) => path.join(extensionsDir, name))
    .filter((dir) => fs.existsSync(path.join(dir, 'webview', 'index.css')));
}

/** バンドルされた JS から入力欄の CSS モジュール名を探す ( ハッシュが変わっても追従できるように ) */
function detectInputClass(claudeDir) {
  try {
    const js = fs.readFileSync(path.join(claudeDir, 'webview', 'index.js'), 'utf8');
    const m = js.match(/inputWrapper:"inputWrapper_[\w-]+",inputContainer:"(inputContainer_[\w-]+)"/);
    if (m) return m[1];
  } catch { /* 読めなければフォールバック */ }
  return FALLBACK_CLASS;
}

function imageDataUri(imagePath) {
  const mime = MIME[path.extname(imagePath).toLowerCase()] || 'image/png';
  return `data:${mime};base64,${fs.readFileSync(imagePath).toString('base64')}`;
}

function cssString(s) {
  return '"' + s.replace(/\\/g, '\\5c ').replace(/"/g, '\\22 ').replace(/\r?\n/g, '\\A ') + '"';
}

function buildCss(cls, opts) {
  const size = Math.max(16, Math.min(300, Number(opts.size) || 100));
  const right = Number(opts.offsetRight) || 0;
  const sink = Math.round(size * 0.03); // 足が入力欄のふちに乗るように少しだけ沈める
  const sel = `.${cls}`;
  let css = `
${sel}::after{content:"";position:absolute;right:${right}px;bottom:calc(100% - ${sink}px);width:${size}px;height:${size}px;background:url("${opts.imageUri}") no-repeat center bottom/contain;image-rendering:pixelated;filter:drop-shadow(1px 0 0 #fffc) drop-shadow(-1px 0 0 #fffc) drop-shadow(0 1px 0 #fffc) drop-shadow(0 -1px 0 #fffc);pointer-events:none;z-index:20;}
`;
  if (opts.greeting) {
    css += `${sel}::before{content:${cssString(opts.greeting)};position:absolute;right:${right + size - 4}px;bottom:calc(100% + ${Math.round(size * 0.55)}px);padding:3px 8px;border-radius:10px 10px 2px 10px;font-size:11px;line-height:1.4;white-space:pre;background:var(--vscode-editorHoverWidget-background);color:var(--vscode-editorHoverWidget-foreground);border:1px solid var(--vscode-editorHoverWidget-border);box-shadow:0 2px 6px #0003;pointer-events:none;z-index:21;opacity:0;visibility:hidden}
${sel}:focus-within::before{animation:claude-maid-say ${Math.max(1, Number(opts.greetingSeconds) || 3.5)}s ease forwards}
@keyframes claude-maid-say{0%{opacity:0;visibility:visible;transform:translateY(4px)}10%,85%{opacity:1;visibility:visible;transform:none}100%{opacity:0;visibility:hidden}}
`;
  }
  return `\n${START}${css}${END}\n`;
}

/**
 * 各 Claude Code の index.css を更新する
 * opts が null ならメイドさんを取り除く
 * @returns {string[]} 実際に書き換えたディレクトリ
 */
function patchAll(extensionsDir, opts) {
  const changed = [];
  for (const dir of findClaudeDirs(extensionsDir)) {
    const cssPath = path.join(dir, 'webview', 'index.css');
    const original = fs.readFileSync(cssPath, 'utf8');
    let next = original.replace(BLOCK_RE, '');
    if (opts) next += buildCss(detectInputClass(dir), opts);
    if (next !== original) {
      fs.writeFileSync(cssPath, next, 'utf8');
      changed.push(dir);
    }
  }
  return changed;
}

module.exports = { patchAll, imageDataUri, findClaudeDirs };
