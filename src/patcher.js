// Claude Code の webview/index.css と index.js にメイドさん用のコードを追記・除去する
// vscode API に依存しないので、アンインストールスクリプトからも使える
//
// CSS だけでは乱数が使えないため、出すメイドさんと言わせるセリフは JS がランダムに選んで <html> の属性に書く
// CSS はその属性を見て絵とセリフを切り替える
const fs = require("fs");
const path = require("path");

const START_MARKER = "/* ==== claude-maid:start ==== */";
const END_MARKER = "/* ==== claude-maid:end ==== */";
const BLOCK_PATTERN = /\n?\/\* ==== claude-maid:start ==== \*\/[\s\S]*?\/\* ==== claude-maid:end ==== \*\/\n?/g;
const FALLBACK_INPUT_CLASS_NAME = "inputContainer_cKsPxg";
// マウスがメイドさんの絵からこの距離以内に入ったら近づいたとみなす
const NEAR_MARGIN = 20;

const MIME_TYPES = { ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

function findClaudeCodeDirectories(extensionsDirectory) {
    if (fs.existsSync(extensionsDirectory) == false) return [];
    return fs.readdirSync(extensionsDirectory)
        .filter((name) => /^anthropic\.claude-code-/.test(name))
        .map((name) => path.join(extensionsDirectory, name))
        .filter((directory) => fs.existsSync(path.join(directory, "webview", "index.css")));
}

/** バンドルされた JS から入力欄の CSS モジュール名を探す ( ハッシュが変わっても追従できるように ) */
function detectInputClassName(claudeCodeDirectory) {
    try {
        const script = fs.readFileSync(path.join(claudeCodeDirectory, "webview", "index.js"), "utf8");
        const match = script.match(/inputWrapper:"inputWrapper_[\w-]+",inputContainer:"(inputContainer_[\w-]+)"/);
        if (match) return match[1];
    } catch {
        // 読めなければ既定のクラス名を使う
    }
    return FALLBACK_INPUT_CLASS_NAME;
}

function imageDataUri(imagePath) {
    const mimeType = MIME_TYPES[path.extname(imagePath).toLowerCase()] || "image/png";
    return `data:${mimeType};base64,${fs.readFileSync(imagePath).toString("base64")}`;
}

/** マウスを近づけたときのメイドさんの濃さ。透けさせない設定なら null */
function fadeOpacity(options) {
    const opacity = Number(options.fadeOpacity);
    return opacity >= 0 && opacity < 1 ? opacity : null;
}

function toCssString(text) {
    return `"${text.replace(/\\/g, "\\5c ").replace(/"/g, "\\22 ").replace(/\r?\n/g, "\\A ")}"`;
}

/**
 * options.maids: [{ id, imageUri, width, height, lines }]
 *   width / height は絵のドット数。1 ドット = size / 100 px で表示する
 *   カスタム画像のように指定がなければ、size x size の枠に収める
 */
function buildCss(className, options) {
    const size = Math.max(16, Math.min(300, Number(options.size) || 100));
    const right = Number(options.offsetRight) || 0;
    const sink = Math.round(size * 0.03); // 足が入力欄のふちに乗るように少しだけ沈める
    const selector = `.${className}`;
    const maidSelector = (maid) => `:root[data-claude-maid="${maid.id}"] ${selector}`;
    const maidVariables = (maid) => {
        const width = maid.width ? Math.round(maid.width * size / 100) : size;
        const height = maid.height ? Math.round(maid.height * size / 100) : size;
        return `--claude-maid-img:url("${maid.imageUri}");--claude-maid-w:${width}px;--claude-maid-h:${height}px`;
    };
    const [first, ...rest] = options.maids;
    // 先頭の子は JS が動かなかったときの表示も兼ねる
    let css = `
${selector}{${maidVariables(first)}}
${rest.map((maid) => `${maidSelector(maid)}{${maidVariables(maid)}}`).join("\n")}
${selector}::after{content:"";position:absolute;right:${right}px;bottom:calc(100% - ${sink}px);width:var(--claude-maid-w);height:var(--claude-maid-h);background:var(--claude-maid-img) no-repeat center bottom/contain;image-rendering:pixelated;filter:drop-shadow(1px 0 0 #fffc) drop-shadow(-1px 0 0 #fffc) drop-shadow(0 1px 0 #fffc) drop-shadow(0 -1px 0 #fffc);pointer-events:none;z-index:20;transition:opacity .2s ease}
`;
    if (fadeOpacity(options) != null) css += `:root[data-claude-maid-near] ${selector}::after{opacity:${fadeOpacity(options)}}\n`;
    if (options.isGreetingShown !== false) {
        css += `${selector}::before{content:${toCssString(first.lines[0])};position:absolute;right:calc(${right - 4}px + var(--claude-maid-w));bottom:calc(100% + var(--claude-maid-h) * 0.55);padding:3px 8px;border-radius:10px 10px 2px 10px;font-size:11px;line-height:1.4;white-space:pre;background:var(--vscode-editorHoverWidget-background);color:var(--vscode-editorHoverWidget-foreground);border:1px solid var(--vscode-editorHoverWidget-border);box-shadow:0 2px 6px #0003;pointer-events:none;z-index:21;opacity:0;visibility:hidden}
${options.maids.flatMap((maid) => maid.lines.map((line, i) => `:root[data-claude-maid="${maid.id}"][data-claude-maid-line="${i}"] ${selector}::before{content:${toCssString(line)}}`)).join("\n")}
${selector}:focus-within::before{animation:claude-maid-say ${Math.max(1, Number(options.greetingSeconds) || 3.5)}s ease forwards}
@keyframes claude-maid-say{0%{opacity:0;visibility:visible;transform:translateY(4px)}10%,85%{opacity:1;visibility:visible;transform:none}100%{opacity:0;visibility:hidden}}
`;
    }
    return `\n${START_MARKER}${css}${END_MARKER}\n`;
}

function buildJs(className, options) {
    const maids = JSON.stringify(options.maids.map((maid) => [maid.id, maid.lines.length]));
    // マウスがメイドさんに近づいている間だけ <html> に属性を付けて、CSS 側で透けさせる
    // 絵の位置と大きさは入力欄の ::after の計算済みスタイルから求める
    const nearScript = fadeOpacity(options) == null ? "" : `
let isNear=false,isQueued=false,pointerX=0,pointerY=0;
const setNear=(next)=>{if(next===isNear)return;isNear=next;root.toggleAttribute("data-claude-maid-near",next);};
const checkNear=()=>{isQueued=false;setNear([...document.querySelectorAll(selector)].some((box)=>{const rectangle=box.getBoundingClientRect(),style=getComputedStyle(box,"::after"),right=rectangle.right-parseFloat(style.right),bottom=rectangle.bottom-parseFloat(style.bottom);return pointerX>=right-parseFloat(style.width)-${NEAR_MARGIN}&&pointerX<=right+${NEAR_MARGIN}&&pointerY>=bottom-parseFloat(style.height)-${NEAR_MARGIN}&&pointerY<=bottom+${NEAR_MARGIN};}));};
document.addEventListener("mousemove",(event)=>{pointerX=event.clientX;pointerY=event.clientY;if(isQueued)return;isQueued=true;requestAnimationFrame(checkNear);},{passive:true});
root.addEventListener("mouseleave",()=>setNear(false));
`;
    const script = `
;(()=>{try{
const root=document.documentElement,selector=${JSON.stringify(`.${className}`)},maids=${maids},[id,count]=maids[Math.floor(Math.random()*maids.length)];
let last=-1;
const say=()=>{let i=Math.floor(Math.random()*count);if(count>1&&i===last)i=(i+1)%count;last=i;root.setAttribute("data-claude-maid-line",String(i));};
root.setAttribute("data-claude-maid",id);say();
document.addEventListener("focusin",(event)=>{const box=event.target instanceof Element&&event.target.closest(selector);if(box&&(event.relatedTarget instanceof Node&&box.contains(event.relatedTarget))==false)say();},true);
${nearScript}}catch{}})();
`;
    return `\n${START_MARKER}${script}${END_MARKER}\n`;
}

function rewrite(filePath, block) {
    const original = fs.readFileSync(filePath, "utf8");
    let next = original.replace(BLOCK_PATTERN, "");
    if (block) next += block;
    if (next === original) return false;
    fs.writeFileSync(filePath, next, "utf8");
    return true;
}

/**
 * 各 Claude Code の index.css / index.js を更新する
 * options が null ならメイドさんを取り除く
 * @returns {string[]} 実際に書き換えたディレクトリ
 */
function patchAll(extensionsDirectory, options) {
    const changedDirectories = [];
    for (const directory of findClaudeCodeDirectories(extensionsDirectory)) {
        const className = detectInputClassName(directory);
        const isCssChanged = rewrite(path.join(directory, "webview", "index.css"), options && buildCss(className, options));
        const jsPath = path.join(directory, "webview", "index.js");
        const isJsChanged = fs.existsSync(jsPath) && rewrite(jsPath, options && buildJs(className, options));
        if (isCssChanged || isJsChanged) changedDirectories.push(directory);
    }
    return changedDirectories;
}

module.exports = { patchAll, imageDataUri, findClaudeCodeDirectories, buildCss, buildJs };
