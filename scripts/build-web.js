// Web ファイルを www/ にコピーする
//   npm run build     … Web 版用。そのままコピーする
//   npm run build:app … Android アプリ用(APP_BUILD=1)。Web 版だけの部分(テスト用の window.__game など)を取り除く
// Web 版だけの部分は目印で囲む: HTML は <!-- web-only --> … <!-- /web-only -->、
// JS は // web-only:start … // web-only:end、CSS は /* web-only:start */ … /* web-only:end */
// (アプリの中に画面に出ない機能を残すと、ストアの審査で「機能を隠している」と判断されることがあるため)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const item of ['index.html', 'style.css', 'game.js', 'ads.js', 'data', 'vendor', 'img']) {
  const src = path.join(root, item);
  if (!fs.existsSync(src)) throw new Error(`missing ${item}`);
  fs.cpSync(src, path.join(out, item), { recursive: true });
}

const APP = process.env.APP_BUILD === '1';
if (APP) {
  const strip = {
    '.html': /[ \t]*<!-- web-only -->[\s\S]*?<!-- \/web-only -->[ \t]*\n?/g,
    '.js': /[ \t]*\/\/ web-only:start[\s\S]*?\/\/ web-only:end[ \t]*\n?/g,
    '.css': /[ \t]*\/\* web-only:start \*\/[\s\S]*?\/\* web-only:end \*\/[ \t]*\n?/g,
  };
  // 取り除き忘れがあればビルドを止める
  const banned = [/play\.google\.com/i, /web-only/, /__game/];
  const problems = [];
  for (const name of fs.readdirSync(out)) {
    const file = path.join(out, name), re = strip[path.extname(name)];
    if (!re || !fs.statSync(file).isFile()) continue;
    const text = fs.readFileSync(file, 'utf8').replace(re, '');
    fs.writeFileSync(file, text);
    for (const b of banned) if (b.test(text)) problems.push(`${name}: ${b}`);
  }
  if (problems.length) {
    console.error('アプリ用のビルドに Web 版だけの部分が残っています:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
}
// Google Play 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
console.log(`built web assets into www/ (${APP ? 'app' : 'web'}, ads: ${mode}, version: ${version})`);
