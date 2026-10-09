// 拡張機能のアンインストール時に VS Code から呼ばれ、追記した CSS を取り除く
const path = require('path');
const { patchAll } = require('./patcher');

// このファイルは <extensions>/<この拡張>/src/ にあるので、2 つ上が extensions フォルダ
patchAll(path.resolve(__dirname, '..', '..'), null);
