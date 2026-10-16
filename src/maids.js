// メイドさんの一覧。絵は media/maids/<id>.svg に置く
// lines は入力欄をクリックしたときに吹き出しで言うセリフ
// 吹き出しは 1 行なので、セリフは全角 16 文字くらいまでにする
const fs = require('fs');
const path = require('path');
const { imageDataUri } = require('./patcher');

const MAIDS = [
  {
    id: 'twintail',
    label: 'ツインテールメイド',
    lines: [
      'ご主人様、今日もがんばろっ!',
      'お仕事だから! それだけだから!',
      'べ、別に待ってなかったし!',
      'なになに? お手伝いするよ!',
      'コードのお掃除、まかせて!',
      'よーし、ぱぱっと終わらせるよ!',
    ],
  },
  {
    id: 'catmaid',
    label: '猫耳メイド',
    lines: [
      'おかえりにゃさいませ、ご主人様♪',
      'にゃんでもお申し付けくださいにゃ',
      'バグはぜんぶ捕まえるにゃ!',
      'ふみゃ…お昼寝してないにゃ!',
      'しっぽでお掃除するにゃ〜',
      'ねこの手、お貸ししますにゃ!',
    ],
  },
  {
    id: 'apprentice',
    label: '見習いメイド',
    lines: [
      'ごしゅじんさま、おかえりなさい!',
      'えへへ、お茶をおもちしました♪',
      'ケーキもあるよ、たべる?',
      'わたしにも、なにかできますか?',
      'おてつだい、がんばります!',
      'はやく一人前になりたいです!',
    ],
  },
  {
    id: 'blackhair',
    label: '黒髪メイド',
    lines: [
      'お帰りなさいませ、ご主人様。',
      'はい、お呼びでしょうか。',
      'バグの一つも見逃しません。',
      '紅茶の用意も整っております。',
      'お好みは、心得ております。',
      'お掃除は、済ませてあります。',
    ],
  },
  {
    id: 'blonde',
    label: '金髪メイド',
    lines: [
      'わたくしにお任せくださいませ!',
      'ごきげんよう、ご主人様!',
      '完璧なコード、お見せしますわ♪',
      'エラーなんて優雅に片付けますわ',
      'お紅茶でも、いかがかしら?',
      'わたくし、一流のメイドですもの!',
    ],
  },
  {
    id: 'oneesan',
    label: 'お姉さんメイド',
    lines: [
      '…ご主人様。ご用件は?',
      'ふぁ…起きてます。…たぶん',
      'ふふ…いつでも頼ってくださいね',
      '…ん。それ、やっておきます',
      'お疲れさまです。…少し休みます?',
      '…コーヒー、二人分いれますね',
    ],
  },
];

/**
 * patcher に渡すメイドさんの一覧を作る
 * @param {string} root 拡張機能のフォルダ ( media/maids/ がある所 )
 * @param {string} character 'random' なら全員、id を指定すればその子だけ
 * @param {string} greeting 空でなければ、全員のセリフをこの 1 つにする
 */
function loadMaids(root, character = 'random', greeting = '') {
  const picked = MAIDS.filter((m) => character === 'random' || m.id === character);
  return (picked.length ? picked : MAIDS).map((m) => {
    const file = path.join(root, 'media', 'maids', `${m.id}.svg`);
    const [, width, height] = fs.readFileSync(file, 'utf8').match(/viewBox="0 0 (\d+) (\d+)"/);
    return { id: m.id, imageUri: imageDataUri(file), width: Number(width), height: Number(height), lines: greeting ? [greeting] : m.lines };
  });
}

module.exports = { MAIDS, loadMaids };
