// Claude Code の webview/index.css と index.js にメイドさん用のコードを追記・除去する
// vscode API に依存しないので、アンインストールスクリプトからも使える
//
// CSS だけでは乱数が使えないため、出すメイドさんと言わせるセリフは JS がランダムに選んで <html> の属性に書く
// CSS はその属性を見て絵とセリフを切り替える
const fs = require('fs');
const path = require('path');

const START = '/* ==== claude-maid:start ==== */';
const END = '/* ==== claude-maid:end ==== */';
const BLOCK_RE = /\n?\/\* ==== claude-maid:start ==== \*\/[\s\S]*?\/\* ==== claude-maid:end ==== \*\/\n?/g;
const FALLBACK_CLASS = 'inputContainer_cKsPxg';
// マウスがメイドさんの絵からこの距離以内に入ったら近づいたとみなす
const NEAR_MARGIN = 20;

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

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
  } catch { }
  return FALLBACK_CLASS;
}

function imageDataUri(imagePath) {
  const mime = MIME[path.extname(imagePath).toLowerCase()] || 'image/png';
  return `data:${mime};base64,${fs.readFileSync(imagePath).toString('base64')}`;
}

/** マウスを近づけたときのメイドさんの濃さ。透けさせない設定なら null */
function fadeOpacity(opts) {
  const opacity = Number(opts.fadeOpacity);
  return opacity >= 0 && opacity < 1 ? opacity : null;
}

function cssString(s) {
  return '"' + s.replace(/\\/g, '\\5c ').replace(/"/g, '\\22 ').replace(/\r?\n/g, '\\A ') + '"';
}

/**
 * opts.maids: [{ id, imageUri, width, height, lines }]
 *   width / height は絵のドット数。1 ドット = size / 100 px で表示する
 *   カスタム画像のように指定がなければ、size x size の枠に収める
 */
function buildCss(cls, opts) {
  const size = Math.max(16, Math.min(300, Number(opts.size) || 100));
  const right = Number(opts.offsetRight) || 0;
  const sink = Math.round(size * 0.03); // 足が入力欄のふちに乗るように少しだけ沈める
  const sel = `.${cls}`;
  const who = (m) => `:root[data-claude-maid="${m.id}"] ${sel}`;
  const vars = (m) => {
    const w = m.width ? Math.round(m.width * size / 100) : size;
    const h = m.height ? Math.round(m.height * size / 100) : size;
    return `--claude-maid-img:url("${m.imageUri}");--claude-maid-w:${w}px;--claude-maid-h:${h}px`;
  };
  const [first, ...rest] = opts.maids;
  // 先頭の子は JS が動かなかったときの表示も兼ねる
  let css = `
${sel}{${vars(first)}}
${rest.map((m) => `${who(m)}{${vars(m)}}`).join('\n')}
${sel}::after{content:"";position:absolute;right:${right}px;bottom:calc(100% - ${sink}px);width:var(--claude-maid-w);height:var(--claude-maid-h);background:var(--claude-maid-img) no-repeat center bottom/contain;image-rendering:pixelated;filter:drop-shadow(1px 0 0 #fffc) drop-shadow(-1px 0 0 #fffc) drop-shadow(0 1px 0 #fffc) drop-shadow(0 -1px 0 #fffc);pointer-events:none;z-index:20;transition:opacity .2s ease}
`;
  if (fadeOpacity(opts) != null) css += `:root[data-claude-maid-near] ${sel}::after{opacity:${fadeOpacity(opts)}}\n`;
  if (opts.showGreeting !== false) {
    css += `${sel}::before{content:${cssString(first.lines[0])};position:absolute;right:calc(${right - 4}px + var(--claude-maid-w));bottom:calc(100% + var(--claude-maid-h) * 0.55);padding:3px 8px;border-radius:10px 10px 2px 10px;font-size:11px;line-height:1.4;white-space:pre;background:var(--vscode-editorHoverWidget-background);color:var(--vscode-editorHoverWidget-foreground);border:1px solid var(--vscode-editorHoverWidget-border);box-shadow:0 2px 6px #0003;pointer-events:none;z-index:21;opacity:0;visibility:hidden}
${opts.maids.flatMap((m) => m.lines.map((line, i) => `:root[data-claude-maid="${m.id}"][data-claude-maid-line="${i}"] ${sel}::before{content:${cssString(line)}}`)).join('\n')}
${sel}:focus-within::before{animation:claude-maid-say ${Math.max(1, Number(opts.greetingSeconds) || 3.5)}s ease forwards}
@keyframes claude-maid-say{0%{opacity:0;visibility:visible;transform:translateY(4px)}10%,85%{opacity:1;visibility:visible;transform:none}100%{opacity:0;visibility:hidden}}
`;
  }
  return `\n${START}${css}${END}\n`;
}

function buildJs(cls, opts) {
  const maids = JSON.stringify(opts.maids.map((m) => [m.id, m.lines.length]));
  // マウスがメイドさんに近づいている間だけ <html> に属性を付けて、CSS 側で透けさせる
  // 絵の位置と大きさは入力欄の ::after の計算済みスタイルから求める
  const nearJs = fadeOpacity(opts) == null ? "" : `
let isNear=false,isQueued=false,pointerX=0,pointerY=0;
const setNear=(next)=>{if(next===isNear)return;isNear=next;root.toggleAttribute("data-claude-maid-near",next);};
const checkNear=()=>{isQueued=false;setNear([...document.querySelectorAll(selector)].some((box)=>{const rect=box.getBoundingClientRect(),style=getComputedStyle(box,"::after"),right=rect.right-parseFloat(style.right),bottom=rect.bottom-parseFloat(style.bottom);return pointerX>=right-parseFloat(style.width)-${NEAR_MARGIN}&&pointerX<=right+${NEAR_MARGIN}&&pointerY>=bottom-parseFloat(style.height)-${NEAR_MARGIN}&&pointerY<=bottom+${NEAR_MARGIN};}));};
document.addEventListener("mousemove",(e)=>{pointerX=e.clientX;pointerY=e.clientY;if(isQueued)return;isQueued=true;requestAnimationFrame(checkNear);},{passive:true});
root.addEventListener("mouseleave",()=>setNear(false));
`;
  const js = `
;(()=>{try{
const root=document.documentElement,selector=${JSON.stringify(`.${cls}`)},maids=${maids},[id,count]=maids[Math.floor(Math.random()*maids.length)];
let last=-1;
const say=()=>{let i=Math.floor(Math.random()*count);if(count>1&&i===last)i=(i+1)%count;last=i;root.setAttribute("data-claude-maid-line",String(i));};
root.setAttribute("data-claude-maid",id);say();
document.addEventListener("focusin",(e)=>{const box=e.target instanceof Element&&e.target.closest(selector);if(box&&!(e.relatedTarget instanceof Node&&box.contains(e.relatedTarget)))say();},true);
${nearJs}}catch(e){}})();
`;
  return `\n${START}${js}${END}\n`;
}

function rewrite(file, block) {
  const original = fs.readFileSync(file, 'utf8');
  let next = original.replace(BLOCK_RE, '');
  if (block) next += block;
  if (next === original) return false;
  fs.writeFileSync(file, next, 'utf8');
  return true;
}

/**
 * 各 Claude Code の index.css / index.js を更新する
 * opts が null ならメイドさんを取り除く
 * @returns {string[]} 実際に書き換えたディレクトリ
 */
function patchAll(extensionsDir, opts) {
  const changed = [];
  for (const dir of findClaudeDirs(extensionsDir)) {
    const cls = detectInputClass(dir);
    const css = rewrite(path.join(dir, 'webview', 'index.css'), opts && buildCss(cls, opts));
    const jsPath = path.join(dir, 'webview', 'index.js');
    const js = fs.existsSync(jsPath) && rewrite(jsPath, opts && buildJs(cls, opts));
    if (css || js) changed.push(dir);
  }
  return changed;
}

module.exports = { patchAll, imageDataUri, findClaudeDirs, buildCss, buildJs };
