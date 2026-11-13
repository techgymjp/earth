// Natural Earth 1:50m の国データから、ゲーム用の軽量 GeoJSON を生成する。
// 使い方:
//   curl -sSLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
//   node tools/build-data.mjs ne_50m_admin_0_countries.geojson > data/countries.js
// (file:// で開いても動くよう、JSON ではなく JS として出力する)
import fs from 'node:fs';

const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// 日本語名を一般的な呼び方に揃える
const NAME_OVERRIDE = {
  'タイ王国': 'タイ', '中華民国': '台湾', '大韓民国': '韓国', '朝鮮民主主義人民共和国': '北朝鮮',
  '中華人民共和国': '中国', 'モンゴル国': 'モンゴル', 'マリ共和国': 'マリ',
  '北キプロス・トルコ共和国': '北キプロス', 'コソボ共和国': 'コソボ',
};
// 英語名 (NAME_EN) を一般的な呼び方に揃える
const EN_OVERRIDE = {
  "People's Republic of China": 'China', 'Turkish Republic of Northern Cyprus': 'Northern Cyprus',
  'Czech Republic': 'Czechia', 'Federated States of Micronesia': 'Micronesia',
  'Democratic Republic of the Congo': 'DR Congo', 'Republic of the Congo': 'Republic of the Congo',
};
// 国として出題しない地域 (クリックはできる)
const NOT_QUESTION = new Set([
  'Greenland', 'Jersey', 'Guernsey', 'Isle of Man', 'Aruba', 'Curaçao', 'Sint Maarten',
  'Åland', 'Hong Kong', 'Macao', 'N. Cyprus', 'Somaliland', 'Antarctica', 'W. Sahara',
]);
// TYPE が Disputed などでも出題する
const FORCE_QUESTION = new Set(['Palestine', 'Kosovo', 'Israel']);
const QUESTION_TYPES = new Set(['Sovereign country', 'Country', 'Sovereignty']);

// Natural Earth で "Seven seas" になっている島国の所属地域
const CONTINENT_FIX = { Seychelles: 'africa', Mauritius: 'africa', Maldives: 'asia' };
// 大陸はキーで持ち、表示名はゲーム側で言語ごとに変換する
const CONTINENT_KEY = {
  Asia: 'asia', Europe: 'europe', Africa: 'africa', 'North America': 'namerica',
  'South America': 'samerica', Oceania: 'oceania', Antarctica: 'antarctica',
  'Seven seas (open ocean)': 'other',
};

const r2 = (n) => Math.round(n * 100) / 100;
function simplifyRing(ring) {
  // 小数点以下2桁 (約1km) に丸め、連続する重複点を除く
  const out = [];
  for (const [x, y] of ring) {
    const p = [r2(x), r2(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}
function simplifyGeom(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const res = polys
    .map((poly) => poly.map(simplifyRing).filter((ring) => ring.length >= 4))
    .filter((poly) => poly.length > 0);
  return res.length === 1 ? { type: 'Polygon', coordinates: res[0] } : { type: 'MultiPolygon', coordinates: res };
}
function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}
function geomArea(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polys.reduce((s, p) => s + ringArea(p[0]), 0);
}

const features = src.features.map((f, i) => {
  const p = f.properties;
  const ja = NAME_OVERRIDE[p.NAME_JA] || p.NAME_JA;
  if (!ja) throw new Error('no ja name: ' + p.NAME);
  const en = EN_OVERRIDE[p.NAME_EN] || p.NAME_EN || p.NAME;
  const q = FORCE_QUESTION.has(p.NAME) || (QUESTION_TYPES.has(p.TYPE) && !NOT_QUESTION.has(p.NAME));
  return {
    type: 'Feature',
    properties: {
      id: i, en, ja,
      continent: CONTINENT_FIX[p.NAME] || CONTINENT_KEY[p.CONTINENT] || 'other',
      rank: p.LABELRANK, q,
      lat: r2(p.LABEL_Y), lng: r2(p.LABEL_X),
      area: Math.round(geomArea(f.geometry) * 100) / 100, // 平方度 (目安)
    },
    geometry: simplifyGeom(f.geometry),
  };
});
process.stdout.write('window.COUNTRIES = ' + JSON.stringify({ type: 'FeatureCollection', features }) + ';\n');
