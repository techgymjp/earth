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

効果音と宇宙空間のBGMは Web Audio で生成しています。ロード中に音声データとして作っておき、プレイ中は再生するだけにしています（右下のボタンでオン／オフ）。

結果画面からスコアをシェアできます（スマホは端末の共有メニュー、PCはコピー、または 𝕏 でポスト）。

## 軽量化の工夫

- 国境線は3Dの線ではなく地球の画像に直接描き込む（かんたんモード）
- 国の当たり判定はクリックした緯度経度から計算し、ハイライトする国だけをポリゴンで描く
- マウス移動ごとのGPUの判定処理を止め、タップだけを判定する
- スマホでは描画解像度を抑える

## ローカルで動かす

ビルド不要の静的サイトです。`index.html` をブラウザで開くか、簡易サーバーで配信します。

```bash
python3 -m http.server 8000
```

## 構成

- `index.html` / `style.css` / `game.js` … ゲーム本体
- `ads.js` / `ads-config.js` / `build-info.js` … Android アプリ用の広告とバージョン表示（Web 版では何もしない）
- `data/countries.js` … 国データ（`tools/build-data.mjs` で生成）
- `vendor/globe.gl.min.js` … [globe.gl](https://github.com/vasturiano/globe.gl)（MIT License）
- `img/` … 地球・星空のテクスチャ（[three-globe](https://github.com/vasturiano/three-globe) のサンプル画像、NASA Blue Marble 由来）

国境データは [Natural Earth](https://www.naturalearthdata.com/)（パブリックドメイン）の 1:50m Admin 0 – Countries を使用しています。

## Android アプリ

[Capacitor](https://capacitorjs.com/) でゲームのファイルをアプリに同梱し、Android アプリにしています（オフラインで遊べます）。
構成は techgymjp/jet-fighter の `docs/ANDROID_PORTING.md`、techgymjp/jackal と同じです。

- パッケージ名: `jp.techgym.earth`
- アプリ名: 国探し（英語の端末では Find Country）
- 縦画面固定・全画面・プレイ中は画面を消さない
- 戻るボタン: プレイ中は一時停止（一時停止中なら再開）、タイトル・結果画面ではアプリを終了
- 別アプリに切り替えると自動で一時停止して音を止める（一時停止中は地球を隠し、タイマーも止める）
- シェアは Android の共有メニュー
- 広告（AdMob）
  - バナー: タイトル画面・一時停止画面・結果画面の下中央（プレイ中は地球の操作と重なるので出さない）
  - 全画面広告（インタースティシャル）: プレイ開始、結果画面の「もう一度」、「タイトルへ」、一時停止からの「再開」のたびに毎回
  - リワード広告（チート）: 3回まちがえてハートがなくなったら「広告を見てハートを1つ回復」（1 ゲーム 3 回まで）。
    押した国を見届けられるよう 2 秒後に出し、6 秒で自動的にあきらめる。案内と広告の間はタイマーを止める。
    使ったことは結果画面とシェア文に「ハート回復N回」と出る
  - EU など同意が必要な地域ではタイトル画面に「広告の設定」
- タイトル画面にバージョン（ビルド番号）とプライバシーポリシーへのリンク

ビルドは GitHub Actions（`.github/workflows/android.yml`）で行います。

1. `npm ci` → `npm run build:app`（`www/` に Web ファイルをコピーし、Web 版だけの部分（テスト用の `window.__game`）を取り除き、`ads-config.js` と `build-info.js` を生成）→ `npx cap sync android` → `./gradlew assembleDebug`
2. 既定ブランチなら、Release `android-latest` の `earth.apk` を差し替え（動作確認用・テスト広告）
   - リリース画面: `https://github.com/techgymjp/earth/releases/tag/android-latest`（QR コード: `docs/apk-qr.png`）
   - APK 直接: `https://github.com/techgymjp/earth/releases/latest/download/earth.apk`
3. GitHub Secrets に署名鍵（`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`）があれば、本番広告で署名付き AAB を作り Artifact に上げる

![動作確認用 APK のリリース画面](docs/apk-qr.png)

AdMob のアプリ ID は `android/app/src/main/res/values/strings.xml` の `admob_app_id`、本番の広告ユニット ID は `ads.js` の `UNITS.android.production` にあります。
動作確認用 APK はどれもテスト広告、Google Play 用の AAB は本番の広告です。

手元で試すとき: `npm install` → `npm run android:sync` → `npm run android:open`（Android Studio が必要）。
アイコンと起動画面は `assets/` の元画像（`tools/icon.html` で描画）から `npx @capacitor/assets generate --android` で生成しています。

## ライセンス

著作権はテックジム株式会社に帰属します（All rights reserved）。許可なく複製・改変・再配布すること、Web サイトやアプリ（Google Play、App Store など）として公開・販売すること、名前・アイコン・画像を使うことを禁止します。
テックジムの受講生が学習目的で複製・改変することは許可します（アプリストアでの公開・広告の掲載・販売などの商用利用は不可、著作権表示を残すこと）。
同梱している globe.gl（MIT License）、テクスチャ、Natural Earth のデータは、それぞれのライセンスのままです。詳しくは `LICENSE` を見てください。

## OGP 画像

`ogp.jpg`（1200×630）は `tools/ogp.html` をブラウザで 1200×630 のウィンドウで開き、スクリーンショットして作っています。
