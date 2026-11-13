# 国探し / Find the Country

リアルな地球をくるくる回して、「〇〇を探して！」と出題された国を見つけるWebゲームです。

## 遊び方

- ドラッグで地球を回転、ホイール／ピンチで拡大縮小
- お題の国をクリック（タップ）して回答。3回まちがえると正解が表示されます
- 全10問。1問ごとの時間と合計タイムを計測し、早く正解するほど高得点
- ヒント（地域 → おおよその位置）とパスあり

| 難易度 | 国境線 | 出題される国 |
| --- | --- | --- |
| かんたん | あり | 有名な国 |
| ふつう | なし | 有名な国〜中くらいの国 |
| むずかしい | なし | マニアックな国（小国・島国など） |

日本語と英語に対応しています（タイトル画面右上で切り替え。初回はブラウザの言語設定に合わせます）。

効果音と宇宙空間のBGMは Web Audio でリアルタイム生成しています（右下のボタンでオン／オフ）。

## ローカルで動かす

ビルド不要の静的サイトです。`index.html` をブラウザで開くか、簡易サーバーで配信します。

```bash
python3 -m http.server 8000
```

## 構成

- `index.html` / `style.css` / `game.js` … ゲーム本体
- `data/countries.js` … 国データ（`tools/build-data.mjs` で生成）
- `vendor/globe.gl.min.js` … [globe.gl](https://github.com/vasturiano/globe.gl)（MIT License）
- `img/` … 地球・星空のテクスチャ（[three-globe](https://github.com/vasturiano/three-globe) のサンプル画像、NASA Blue Marble 由来）

国境データは [Natural Earth](https://www.naturalearthdata.com/)（パブリックドメイン）の 1:50m Admin 0 – Countries を使用しています。
