/* 国探し - リアルな地球を回してお題の国を見つけるゲーム */
(() => {
  'use strict';

  const TOTAL_QUESTIONS = 10;
  const MAX_MISSES = 3;
  const TINY_AREA = 1.0;        // これより小さい国 (平方度) は近くを押せば正解
  const TINY_RADIUS_KM = 150;

  const DIFFICULTY = {
    easy:   { borders: true,  filter: (p) => p.rank <= 3 },
    normal: { borders: false, filter: (p) => p.rank <= 4 },
    hard:   { borders: false, filter: (p) => p.rank >= 5 }, // マニアックな国
  };

  const $ = (id) => document.getElementById(id);
  const features = window.COUNTRIES.features;

  // ---------------------------------------------------------------- 多言語対応
  const I18N = {
    ja: {
      docTitle: '国探し',
      title: '国探し',
      lead: '地球をくるくる回して、お題の国を見つけよう！<br>全10問・タイムも計測します',
      difficulty: '難易度', region: '地域',
      easy: 'かんたん', normal: 'ふつう', hard: 'むずかしい',
      easyDesc: '国境線あり・有名な国', normalDesc: '国境線なし・有名な国〜中くらいの国', hardDesc: '国境線なし・マニアックな国',
      all: '全世界', asia: 'アジア', europe: 'ヨーロッパ', africa: 'アフリカ',
      namerica: '北アメリカ', samerica: '南アメリカ', oceania: 'オセアニア', antarctica: '南極', other: 'その他',
      start: 'スタート',
      howto: 'ドラッグで回転・ホイール/ピンチで拡大縮小・国をクリック/タップで回答',
      loading: '地球を読み込み中…',
      hint: 'ヒント', skip: 'パス', quit: 'やめる',
      next: '次の問題へ', seeResult: '結果を見る',
      result: '結果', correctCount: '正解', totalTime: '合計タイム',
      retry: 'もう一度', menu: 'タイトルへ',
      sec: (v) => `${v}秒`,
      pts: (n) => `${n}点`,
      question: (name) => [name, 'を探して！'],
      noQuestions: 'この条件では問題がありません',
      correct: (pts, time) => `正解！ +${pts}点（${time}）`,
      answerWas: (name) => `正解は「${name}」でした`,
      sea: 'そこは海です',
      thatIs: (name) => `そこは「${name}」です`,
      wrong: (name) => `ちがいます！ そこは「${name}」です`,
      hint1: (c) => `ヒント: ${c}の国です`,
      hint2: (c) => `ヒント: ${c}の国です ／ このあたりにあります`,
      comments: ['🌏 地理マスター！すばらしい！', '✈️ 世界旅行の達人！', '🧭 なかなかの冒険家！', '🗺 もう少しで一人前！', '🎒 地球儀をくるくる回して覚えよう！'],
      modeLabel: (d, r) => `${d}・${r}`,
      newBest: (label, prev) => `🎉 ベスト更新！（${label}）前回のベスト: ${prev}点`,
      best: (label, score, time) => `ベストスコア（${label}）: ${score}点${time ? ' / ' + time : ''}`,
      soundLabel: 'サウンドのオン/オフ',
      share: 'シェア', copy: 'コピー', postX: '𝕏 でポスト', copied: 'コピーしました',
      shareText: (mode, score, correct, time) => `🌏 国探し【${mode}】で ${score}点！（${correct}/10問正解・タイム ${time}）\n#国探し`,
    },
    en: {
      docTitle: 'Find the Country',
      title: 'Find the Country',
      lead: 'Spin the globe and find the country!<br>10 questions — against the clock',
      difficulty: 'Difficulty', region: 'Region',
      easy: 'Easy', normal: 'Normal', hard: 'Hard',
      easyDesc: 'Borders shown · Well-known countries', normalDesc: 'No borders · Well-known to mid-sized', hardDesc: 'No borders · Obscure countries',
      all: 'World', asia: 'Asia', europe: 'Europe', africa: 'Africa',
      namerica: 'North America', samerica: 'South America', oceania: 'Oceania', antarctica: 'Antarctica', other: 'Other',
      start: 'Start',
      howto: 'Drag to rotate · Scroll/pinch to zoom · Click/tap a country to answer',
      loading: 'Loading the Earth…',
      hint: 'Hint', skip: 'Skip', quit: 'Quit',
      next: 'Next question', seeResult: 'See results',
      result: 'Results', correctCount: 'Correct', totalTime: 'Total time',
      retry: 'Play again', menu: 'Title',
      sec: (v) => `${v}s`,
      pts: (n) => `${n} pts`,
      question: (name) => ['Find ', name, '!'],
      noQuestions: 'No questions match these settings',
      correct: (pts, time) => `Correct! +${pts} pts (${time})`,
      answerWas: (name) => `The answer was ${name}`,
      sea: "That's the ocean",
      thatIs: (name) => `That's ${name}`,
      wrong: (name) => `Wrong! That's ${name}`,
      hint1: (c) => `Hint: It's in ${c}`,
      hint2: (c) => `Hint: It's in ${c} — somewhere around here`,
      comments: ['🌏 Geography master! Amazing!', '✈️ Seasoned world traveler!', '🧭 Quite the explorer!', '🗺 Almost there!', '🎒 Keep spinning the globe and learning!'],
      modeLabel: (d, r) => `${d} · ${r}`,
      newBest: (label, prev) => `🎉 New best! (${label}) Previous best: ${prev} pts`,
      best: (label, score, time) => `Best score (${label}): ${score} pts${time ? ' / ' + time : ''}`,
      soundLabel: 'Toggle sound',
      share: 'Share', copy: 'Copy', postX: 'Post on 𝕏', copied: 'Copied!',
      shareText: (mode, score, correct, time) => `🌏 Find the Country [${mode}]: ${score} pts! (${correct}/10 correct, ${time})\n#FindTheCountry`,
    },
  };

  let lang = 'ja';
  try {
    lang = localStorage.getItem('kunisagashi.lang') || (/^ja\b/i.test(navigator.language || '') ? 'ja' : 'en');
  } catch (e) {
    lang = /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en';
  }
  if (!I18N[lang]) lang = 'en';
  const T = () => I18N[lang];
  const nameOf = (p) => (lang === 'ja' ? p.ja : p.en);

  // ---------------------------------------------------------------- サウンド (効果音 + BGM)
  // 効果音・BGM はロード中に OfflineAudioContext で音声データとして事前に作っておき、
  // プレイ中は再生するだけにする (その場で合成しないので、スマホでも音が乱れにくい)。
  const Sound = (() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const SR = 44100;
    let ctx = null;
    let master = null;
    let bgmStarted = false;
    let enabled = true;
    try { enabled = localStorage.getItem('kunisagashi.sound') !== 'off'; } catch (e) { /* noop */ }
    const buffers = {};
    let bgmBuffer = null;

    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const N = { C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568 };

    // 1音 (描画先のコンテキストに対して)
    function tone(c, dest, freq, start, dur, { type = 'sine', vol = 0.2, slideTo = null, attack = 0.012 } = {}) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      gain.gain.linearRampToValueAtTime(0, start + dur + 0.01);
      osc.connect(gain).connect(dest);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }

    // 効果音のレシピ: [長さ(秒), 描画関数]
    const SE = {
      tap: [0.12, (c, d) => tone(c, d, 1100, 0, 0.07, { type: 'sine', vol: 0.22 })],
      select: [0.18, (c, d) => { tone(c, d, 880, 0, 0.06, { vol: 0.18 }); tone(c, d, 1320, 0.05, 0.08, { vol: 0.18 }); }],
      question: [0.7, (c, d) => {
        tone(c, d, N.E5, 0, 0.3, { type: 'triangle', vol: 0.25 });
        tone(c, d, N.B5, 0.12, 0.5, { type: 'triangle', vol: 0.25 });
      }],
      correct: [0.9, (c, d) => {
        [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(c, d, f, i * 0.07, 0.25, { type: 'triangle', vol: 0.22 }));
        tone(c, d, N.E6, 0.28, 0.55, { type: 'sine', vol: 0.2 });
      }],
      wrong: [0.55, (c, d) => {
        tone(c, d, 300, 0, 0.18, { type: 'triangle', vol: 0.3, slideTo: 200 });
        tone(c, d, 210, 0.17, 0.32, { type: 'triangle', vol: 0.3, slideTo: 130 });
      }],
      sea: [0.3, (c, d) => tone(c, d, 320, 0, 0.2, { vol: 0.25, slideTo: 200 })],
      hint: [0.45, (c, d) => { tone(c, d, N.A5, 0, 0.14, { vol: 0.2 }); tone(c, d, N.E6, 0.1, 0.28, { vol: 0.16 }); }],
      reveal: [0.85, (c, d) => {
        tone(c, d, N.G5, 0, 0.2, { type: 'triangle', vol: 0.22 });
        tone(c, d, N.E5, 0.15, 0.2, { type: 'triangle', vol: 0.22 });
        tone(c, d, N.C5, 0.3, 0.5, { type: 'triangle', vol: 0.22 });
      }],
      fanfare: [1.8, (c, d) => {
        [[N.C5, 0], [N.E5, 0.12], [N.G5, 0.24], [N.C6, 0.36], [N.G5, 0.6], [N.C6, 0.72]]
          .forEach(([f, t]) => tone(c, d, f, t, 0.3, { type: 'triangle', vol: 0.2 }));
        tone(c, d, N.E6, 0.84, 0.85, { vol: 0.2 });
        tone(c, d, N.G6, 0.84, 0.85, { vol: 0.1 });
      }],
    };

    function startRendering(oc) {
      return new Promise((resolve, reject) => {
        oc.oncomplete = (e) => resolve(e.renderedBuffer);
        const p = oc.startRendering();
        if (p && p.then) p.then(resolve, reject);
      });
    }

    function renderSE(len, fn) {
      const oc = new OAC(1, Math.ceil(SR * len), SR);
      fn(oc, oc.destination);
      return startRendering(oc);
    }

    function makeImpulse(c, seconds, decay) {
      const len = Math.floor(SR * seconds);
      const buf = c.createBuffer(2, len, SR);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    // 宇宙のアンビエント BGM (32秒のループ) を事前に作る
    async function renderBgm() {
      const CHORDS = [ // Cmaj9 → Am9 → Fmaj7#11 → Gsus2
        [48, 55, 59, 62, 64],
        [45, 52, 55, 59, 60],
        [41, 48, 52, 55, 59],
        [43, 50, 55, 57, 62],
      ];
      const SPARKLE = [72, 74, 76, 79, 81, 84, 86, 88];
      const STEP = 8;
      const L = STEP * CHORDS.length; // ループの長さ
      const TAIL = 6;                  // ループ先頭に重ねる余韻
      const oc = new OAC(2, SR * (L + TAIL), SR);
      const bus = oc.createGain();
      const reverb = oc.createConvolver();
      reverb.buffer = makeImpulse(oc, 3.5, 2.5);
      const wet = oc.createGain();
      wet.gain.value = 0.8;
      bus.connect(oc.destination);
      bus.connect(reverb);
      reverb.connect(wet).connect(oc.destination);

      CHORDS.forEach((notes, k) => {
        const t0 = k * STEP;
        const dur = STEP + 1;
        notes.forEach((m, i) => {
          [-6, 6].forEach((detune) => {
            const osc = oc.createOscillator();
            const filt = oc.createBiquadFilter();
            const g = oc.createGain();
            osc.type = i === 0 ? 'sine' : 'sawtooth';
            osc.frequency.value = mtof(m);
            osc.detune.value = detune;
            filt.type = 'lowpass';
            filt.frequency.setValueAtTime(400, t0);
            filt.frequency.linearRampToValueAtTime(900 + Math.random() * 400, t0 + dur / 2);
            filt.frequency.linearRampToValueAtTime(400, t0 + dur);
            const v = i === 0 ? 0.05 : 0.012;
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(v, t0 + 3);
            g.gain.setValueAtTime(v, t0 + dur - 3.5);
            g.gain.linearRampToValueAtTime(0, t0 + dur + 1);
            osc.connect(filt).connect(g).connect(bus);
            osc.start(t0);
            osc.stop(t0 + dur + 1.1);
          });
        });
      });

      // きらめく音
      for (let t = 0.5; t < L - 1; t += 1.2 + Math.random() * 3) {
        const osc = oc.createOscillator();
        const g = oc.createGain();
        osc.frequency.value = mtof(SPARKLE[Math.floor(Math.random() * SPARKLE.length)]);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.03, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
        osc.connect(g).connect(reverb);
        osc.start(t);
        osc.stop(t + 2.6);
      }

      const rendered = await startRendering(oc);
      // 末尾の余韻をループ先頭に重ねて、つなぎ目なくループさせる
      const loop = oc.createBuffer(2, SR * L, SR);
      let peak = 0;
      for (let ch = 0; ch < 2; ch++) {
        const src = rendered.getChannelData(ch);
        const out = loop.getChannelData(ch);
        for (let i = 0; i < out.length; i++) {
          out[i] = src[i] + (i < SR * TAIL ? src[SR * L + i] : 0);
          peak = Math.max(peak, Math.abs(out[i]));
        }
      }
      // 音量をそろえる
      const scale = peak > 0 ? 0.3 / peak : 1;
      for (let ch = 0; ch < 2; ch++) {
        const out = loop.getChannelData(ch);
        for (let i = 0; i < out.length; i++) out[i] *= scale;
      }
      return loop;
    }

    function ensureContext() {
      if (ctx || !AC) return ctx;
      ctx = new AC();
      // 音割れ防止のリミッター
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      master = ctx.createGain();
      master.gain.value = enabled ? 1 : 0;
      master.connect(limiter).connect(ctx.destination);
      return ctx;
    }

    function startBgm() {
      if (bgmStarted || !bgmBuffer || !ctx) return;
      bgmStarted = true;
      const src = ctx.createBufferSource();
      src.buffer = bgmBuffer;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 2);
      src.connect(g).connect(master);
      src.start();
    }

    return {
      get enabled() { return enabled; },
      // ロード処理: 効果音と BGM を事前に作る
      async load() {
        if (!AC || !OAC) return;
        const names = Object.keys(SE);
        const rendered = await Promise.all(names.map((n) => renderSE(SE[n][0], SE[n][1])));
        names.forEach((n, i) => { buffers[n] = rendered[i]; });
        bgmBuffer = await renderBgm();
      },
      // ユーザー操作時に呼ぶ (ブラウザの自動再生制限の解除)
      unlock() {
        const c = ensureContext();
        if (!c) return;
        if (c.state !== 'running') c.resume();
        startBgm();
      },
      toggle() {
        enabled = !enabled;
        try { localStorage.setItem('kunisagashi.sound', enabled ? 'on' : 'off'); } catch (e) { /* noop */ }
        if (master) master.gain.setTargetAtTime(enabled ? 1 : 0, ctx.currentTime, 0.05);
        return enabled;
      },
      play(name) {
        if (!ctx || !enabled || !buffers[name] || ctx.state !== 'running') return;
        const src = ctx.createBufferSource();
        src.buffer = buffers[name];
        src.connect(master);
        src.start();
      },
    };
  })();
  const sfx = (name) => () => Sound.play(name);
  Object.assign(Sound, {
    tap: sfx('tap'), select: sfx('select'), question: sfx('question'), correct: sfx('correct'),
    wrong: sfx('wrong'), sea: sfx('sea'), hint: sfx('hint'), reveal: sfx('reveal'), fanfare: sfx('fanfare'),
  });

  // ---------------------------------------------------------------- 地球
  const IS_MOBILE = window.matchMedia('(pointer: coarse)').matches;
  const PLAIN_TEXTURE = 'img/earth-blue-marble.jpg';
  let borderTexture = null; // 国境線を描き込んだテクスチャ (かんたんモード用)

  const globe = new Globe($('globe'), {
    rendererConfig: { antialias: !IS_MOBILE, powerPreference: 'high-performance' },
  })
    .globeImageUrl(PLAIN_TEXTURE)
    .bumpImageUrl('img/earth-topology.png')
    .backgroundImageUrl('img/night-sky.png')
    .showAtmosphere(true)
    .atmosphereColor('#7cc4ff')
    .atmosphereAltitude(0.18)
    // ポリゴンは正解・不正解でハイライトする国だけ描く (全ての国を描くと重いため)
    .polygonsData([])
    .polygonGeoJsonGeometry('geometry')
    .polygonSideColor(() => null)
    .polygonsTransitionDuration(0)
    .htmlElementsData([])
    .htmlLat('lat').htmlLng('lng').htmlAltitude(0.02)
    .htmlElement((d) => {
      const el = document.createElement('div');
      el.className = 'country-tag ' + d.cls;
      el.textContent = d.text;
      return el;
    })
    .pointOfView({ lat: 25, lng: 135, altitude: 2.6 });

  // スマホは描画解像度を抑えて軽くする
  globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));

  // 国境線を地球の画像に直接描き込む (線を3Dで描くより圧倒的に軽い)
  function buildBorderTexture() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const W = img.width;
        const H = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const c = canvas.getContext('2d');
        c.drawImage(img, 0, 0);
        c.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        c.lineWidth = Math.max(1, W / 2400);
        c.lineJoin = 'round';
        c.beginPath();
        for (const f of features) {
          if (f.properties.continent === 'antarctica') continue;
          const g = f.geometry;
          const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
          for (const poly of polys) {
            for (const ring of poly) {
              let px = null;
              ring.forEach(([lng, lat], i) => {
                const x = ((lng + 180) / 360) * W;
                const y = ((90 - lat) / 180) * H;
                // 経度180度をまたぐ線は引かない
                if (i === 0 || Math.abs(x - px) > W / 2) c.moveTo(x, y);
                else c.lineTo(x, y);
                px = x;
              });
            }
          }
        }
        c.stroke();
        canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92);
      };
      img.onerror = reject;
      img.src = PLAIN_TEXTURE;
    });
  }

  // ---------------------------------------------------------------- 当たり判定
  // クリックした緯度経度から国を割り出す
  const hitParts = [];
  for (const f of features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const rings of polys) {
      let minX = 180, minY = 90, maxX = -180, maxY = -90;
      for (const [x, y] of rings[0]) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      hitParts.push({ f, rings, minX, minY, maxX, maxY });
    }
  }
  function inRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function countryAt(lat, lng) {
    for (const p of hitParts) {
      if (lng < p.minX || lng > p.maxX || lat < p.minY || lat > p.maxY) continue;
      if (inRing(lng, lat, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(lng, lat, h))) return p.f;
    }
    return null;
  }

  const controls = globe.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  controls.enableDamping = true;
  controls.minDistance = 101 + 8;   // 拡大しすぎない
  controls.maxDistance = 600;

  // 拡大率に応じて回転速度を落とす (近づいたときの操作性向上)
  controls.addEventListener('change', () => {
    const alt = globe.pointOfView().altitude;
    controls.rotateSpeed = Math.max(0.12, Math.min(1, alt * 0.45));
  });

  function resize() { globe.width(window.innerWidth).height(window.innerHeight); }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- 状態
  const state = {
    difficulty: 'easy',
    region: 'all',
    playing: false,
    questions: [],
    index: 0,
    score: 0,
    results: [],
    // 現在の問題
    target: null,
    startedAt: 0,
    elapsed: 0,
    misses: 0,
    hints: 0,
    answered: false,
    // 表示
    marks: new Map(),  // feature.id -> 'good' | 'bad' | 'reveal'
    tags: [],
  };

  const CAP = {
    good: 'rgba(61, 220, 132, 0.55)',
    bad: 'rgba(255, 70, 70, 0.5)',
    reveal: 'rgba(255, 200, 61, 0.6)',
  };
  const STROKE = {
    good: '#3ddc84', bad: '#ff5a5a', reveal: '#ffc83d',
  };

  function refreshPolygons() {
    const marked = features.filter((f) => state.marks.has(f.properties.id));
    globe
      .polygonCapColor((f) => CAP[state.marks.get(f.properties.id)])
      .polygonStrokeColor((f) => STROKE[state.marks.get(f.properties.id)])
      .polygonAltitude(0.008)
      .polygonsData(marked);
  }

  function setTags() { globe.htmlElementsData(state.tags.slice()); }

  // ---------------------------------------------------------------- ユーティリティ
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function distanceKm(a, b) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  const fmtTime = (ms) => T().sec((ms / 1000).toFixed(1));

  let toastTimer = null;
  function toast(text, cls = '', ms = 1800) {
    const el = $('toast');
    el.textContent = text;
    el.className = 'toast ' + cls;
    el.hidden = false;
    // アニメーションを再生し直す
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  function bestKey() { return `kunisagashi.best.${state.difficulty}.${state.region}`; }
  function loadBest() {
    try { return JSON.parse(localStorage.getItem(bestKey())); } catch (e) { return null; }
  }
  function saveBest(v) {
    try { localStorage.setItem(bestKey(), JSON.stringify(v)); } catch (e) { /* noop */ }
  }

  // ---------------------------------------------------------------- 画面切り替え
  function show(screen) {
    $('title-screen').hidden = screen !== 'title';
    $('hud').hidden = screen !== 'play';
    $('result-screen').hidden = screen !== 'result';
  }

  function toTitle() {
    state.playing = false;
    state.answered = false;
    state.marks.clear();
    state.tags = [];
    setTags();
    refreshPolygons();
    controls.autoRotate = true;
    show('title');
  }

  // ---------------------------------------------------------------- ゲーム進行
  const MIN_POOL = 6;
  function questionPool() {
    const diff = DIFFICULTY[state.difficulty];
    const inRegion = features
      .map((f) => f.properties)
      .filter((p) => p.q && (state.region === 'all' || p.continent === state.region));
    const pool = inRegion.filter(diff.filter);
    if (pool.length >= MIN_POOL) return pool;
    // 条件に合う国が少ない地域 (例: むずかしい×南アメリカ) は、
    // むずかしいなら知名度の低い順、それ以外は有名な順に補う
    const dir = state.difficulty === 'hard' ? -1 : 1;
    return shuffle(inRegion.slice()).sort((a, b) => (a.rank - b.rank) * dir).slice(0, MIN_POOL);
  }

  function startGame() {
    const diff = DIFFICULTY[state.difficulty];
    const pool = questionPool();
    if (pool.length === 0) {
      toast(T().noQuestions, 'warn');
      return;
    }
    // 国数が10未満の地域では重複を許して10問にする (同じ国が連続しないようにする)
    let qs = shuffle(pool.slice());
    while (qs.length < TOTAL_QUESTIONS) {
      const more = shuffle(pool.slice());
      if (more.length > 1 && more[0] === qs[qs.length - 1]) more.push(more.shift());
      qs = qs.concat(more);
    }
    state.questions = qs.slice(0, TOTAL_QUESTIONS);
    state.index = 0;
    state.score = 0;
    state.results = [];
    state.lastResult = null;
    state.playing = true;
    // かんたんモードだけ国境線入りの地球にする
    const tex = diff.borders && borderTexture ? borderTexture : PLAIN_TEXTURE;
    if (globe.globeImageUrl() !== tex) globe.globeImageUrl(tex);
    controls.autoRotate = false;
    show('play');
    nextQuestion();
  }

  function nextQuestion() {
    state.target = state.questions[state.index];
    state.misses = 0;
    state.hints = 0;
    state.answered = false;
    state.elapsed = 0;
    state.startedAt = performance.now();
    state.marks.clear();
    state.tags = [];
    setTags();
    refreshPolygons();

    $('q-num').textContent = `Q${state.index + 1}/${TOTAL_QUESTIONS}`;
    renderQuestion();
    $('hint-text').textContent = '';
    $('score').textContent = T().pts(state.score);
    $('hint-btn').disabled = false;
    $('skip-btn').disabled = false;
    $('next-btn').hidden = true;
    $('toast').hidden = true;
    renderLives();
    Sound.question();

    // 出題時、少し引いた視点にする
    const pov = globe.pointOfView();
    if (pov.altitude < 1.8) globe.pointOfView({ altitude: 2.2 }, 600);
  }

  // 「〇〇を探して！」/「Find 〇〇!」
  function renderQuestion() {
    const q = $('question');
    q.textContent = '';
    if (!state.target) return;
    const name = nameOf(state.target);
    T().question(name).forEach((part) => {
      if (part === name) {
        const span = document.createElement('span');
        span.id = 'q-name';
        span.className = lang;
        span.textContent = name;
        q.append(span);
      } else {
        q.append(part);
      }
    });
  }

  function renderHint() {
    const t = state.target;
    if (!t || state.hints === 0) { $('hint-text').textContent = ''; return; }
    const c = T()[t.continent] || t.continent;
    $('hint-text').textContent = state.hints === 1 ? T().hint1(c) : T().hint2(c);
  }

  function renderLives() {
    const left = MAX_MISSES - state.misses;
    $('lives').textContent = '❤'.repeat(left) + '♡'.repeat(state.misses);
  }

  function currentElapsed() {
    return state.answered ? state.elapsed : performance.now() - state.startedAt;
  }

  let lastTimerText = '';
  function tick() {
    if (state.playing) {
      const text = '⏱ ' + fmtTime(currentElapsed());
      if (text !== lastTimerText) { $('timer').textContent = text; lastTimerText = text; }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function calcPoints(ms) {
    const sec = ms / 1000;
    const p = 1000 - Math.min(600, Math.round(sec * 15)) - state.misses * 150 - state.hints * 150;
    return Math.max(100, p);
  }

  function finishQuestion(correct) {
    state.answered = true;
    state.elapsed = performance.now() - state.startedAt;
    const t = state.target;
    const pts = correct ? calcPoints(state.elapsed) : 0;
    state.score += pts;
    state.results.push({ country: t, correct, time: state.elapsed, pts });

    state.marks.set(t.id, correct ? 'good' : 'reveal');
    state.tags = state.tags.filter((g) => g.id !== t.id);
    state.tags.push({ id: t.id, lat: t.lat, lng: t.lng, text: nameOf(t), cls: correct ? 'good' : 'reveal' });
    setTags();
    refreshPolygons();

    $('score').textContent = T().pts(state.score);
    $('hint-btn').disabled = true;
    $('skip-btn').disabled = true;

    // 国の位置へカメラを移動
    const alt = t.area < TINY_AREA ? 0.6 : Math.min(2, Math.max(0.8, Math.sqrt(t.area) / 12));
    globe.pointOfView({ lat: t.lat, lng: t.lng, altitude: alt }, 1000);

    if (correct) {
      Sound.correct();
      toast(T().correct(pts, fmtTime(state.elapsed)), 'good', 2500);
    } else {
      Sound.reveal();
      toast(T().answerWas(nameOf(t)), 'warn', 2500);
    }

    const last = state.index >= TOTAL_QUESTIONS - 1;
    $('next-btn').textContent = last ? T().seeResult : T().next;
    $('next-btn').hidden = false;
  }

  function handleClick(feature, coords) {
    if (!state.playing || state.answered) return;
    const t = state.target;
    const hitTarget = feature && feature.properties.id === t.id;
    const nearTiny = coords && t.area < TINY_AREA && distanceKm(coords, t) < TINY_RADIUS_KM;

    if (hitTarget || nearTiny) {
      finishQuestion(true);
      return;
    }

    if (!feature) {
      Sound.sea();
      toast(T().sea, '', 1200);
      return;
    }

    // 不正解: 押した国を赤く表示して名前を教える
    const p = feature.properties;
    state.misses++;
    renderLives();
    Sound.wrong();
    state.marks.set(p.id, 'bad');
    state.tags = state.tags.filter((g) => g.id !== p.id);
    state.tags.push({ id: p.id, lat: coords ? coords.lat : p.lat, lng: coords ? coords.lng : p.lng, text: nameOf(p), cls: 'bad' });
    setTags();
    refreshPolygons();

    if (state.misses >= MAX_MISSES) {
      setTimeout(() => finishQuestion(false), 500);
      toast(T().thatIs(nameOf(p)), 'bad', 1000);
      return;
    }
    toast(T().wrong(nameOf(p)), 'bad');

    // 少し経ったら赤い表示を消す
    const qIndex = state.index;
    setTimeout(() => {
      if (state.index !== qIndex || state.answered) return;
      state.marks.delete(p.id);
      state.tags = state.tags.filter((g) => g.id !== p.id);
      setTags();
      refreshPolygons();
    }, 1800);
  }

  function useHint() {
    if (!state.playing || state.answered) return;
    const t = state.target;
    state.hints++;
    Sound.hint();
    renderHint();
    if (state.hints >= 2) {
      // 正確な位置から少しずらして近くまで移動
      const jitter = () => (Math.random() - 0.5) * 12;
      globe.pointOfView({ lat: t.lat + jitter(), lng: t.lng + jitter(), altitude: 1.3 }, 1200);
      $('hint-btn').disabled = true;
    }
  }

  function showResult() {
    state.playing = false;
    const correctCount = state.results.filter((r) => r.correct).length;
    const totalTime = state.results.reduce((s, r) => s + r.time, 0);

    $('final-score').textContent = T().pts(state.score);
    $('final-correct').textContent = `${correctCount}/${TOTAL_QUESTIONS}`;
    $('final-time').textContent = fmtTime(totalTime);

    const rate = state.score / (TOTAL_QUESTIONS * 1000);
    const rank = rate >= 0.85 ? 0 : rate >= 0.65 ? 1 : rate >= 0.45 ? 2 : rate >= 0.25 ? 3 : 4;

    // ベストスコアは表示より先に判定・保存しておく (言語切り替え時に再描画するため)
    const best = loadBest();
    state.lastResult = { rank, totalTime, correctCount, prevBest: best, isNewBest: !best || state.score > best.score };
    if (state.lastResult.isNewBest) saveBest({ score: state.score, time: totalTime });
    renderResultTexts();

    state.marks.clear();
    state.tags = [];
    setTags();
    refreshPolygons();
    controls.autoRotate = true;
    globe.pointOfView({ altitude: 2.6 }, 1200);
    show('result');
    Sound.fanfare();
  }

  function renderResultTexts() {
    const r = state.lastResult;
    if (!r) return;
    const tr = T();
    $('final-score').textContent = tr.pts(state.score);
    $('final-time').textContent = fmtTime(r.totalTime);
    $('final-comment').textContent = tr.comments[r.rank];
    const label = tr.modeLabel(tr[state.difficulty], tr[state.region]);
    if (r.isNewBest) {
      $('best-score').textContent = r.prevBest ? tr.newBest(label, r.prevBest.score) : tr.best(label, state.score);
    } else {
      $('best-score').textContent = tr.best(label, r.prevBest.score, fmtTime(r.prevBest.time));
    }

    const list = $('result-list');
    list.innerHTML = '';
    state.results.forEach((res, i) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = res.correct ? 'ok' : 'ng';
      name.textContent = `${res.correct ? '○' : '×'} Q${i + 1} ${nameOf(res.country)}`;
      const pts = document.createElement('span');
      pts.className = 'pts';
      pts.textContent = `${fmtTime(res.time)} / ${tr.pts(res.pts)}`;
      li.append(name, pts);
      list.append(li);
    });
  }

  // ---------------------------------------------------------------- シェア
  const CAN_SHARE = typeof navigator.share === 'function';
  const shareUrl = () => location.origin + location.pathname;
  function shareText() {
    const r = state.lastResult;
    const tr = T();
    return tr.shareText(tr.modeLabel(tr[state.difficulty], tr[state.region]), state.score, r.correctCount, fmtTime(r.totalTime));
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(T().copied, 'good', 1500);
  }
  $('share-btn').addEventListener('click', async () => {
    if (!state.lastResult) return;
    if (CAN_SHARE) {
      try {
        await navigator.share({ title: T().docTitle, text: shareText(), url: shareUrl() });
      } catch (e) { /* キャンセル */ }
    } else {
      copyText(`${shareText()}\n${shareUrl()}`);
    }
  });
  $('x-btn').addEventListener('click', () => {
    if (!state.lastResult) return;
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(shareUrl())}`;
    window.open(u, '_blank', 'noopener');
  });

  // 画面上のテキストを現在の言語で描き直す
  function applyLanguage() {
    const tr = T();
    document.documentElement.lang = lang;
    document.title = tr.docTitle;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = tr[el.dataset.i18n];
      if (typeof v === 'string') el.innerHTML = v;
    });
    // Web Share API が使えない環境では「コピー」ボタンにする
    $('share-btn').textContent = CAN_SHARE ? tr.share : tr.copy;
    document.querySelectorAll('#lang-switch button').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
    $('sound-btn').setAttribute('aria-label', tr.soundLabel);
    $('score').textContent = tr.pts(state.score);
    renderQuestion();
    renderHint();
    if (state.answered) {
      const last = state.index >= TOTAL_QUESTIONS - 1;
      $('next-btn').textContent = last ? tr.seeResult : tr.next;
    }
    // 地球上の国名ラベル
    state.tags.forEach((g) => {
      const f = features.find((x) => x.properties.id === g.id);
      if (f) g.text = nameOf(f.properties);
    });
    setTags();
    renderResultTexts();
  }

  $('lang-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-lang]');
    if (!btn || btn.dataset.lang === lang) return;
    lang = btn.dataset.lang;
    try { localStorage.setItem('kunisagashi.lang', lang); } catch (err) { /* noop */ }
    applyLanguage();
  });

  // ---------------------------------------------------------------- イベント
  const onGlobeTap = (coords) => {
    if (!coords) return;
    const f = countryAt(coords.lat, coords.lng);
    // 南極などの出題対象外の地域を押したときも、国名は教える
    handleClick(f, coords);
  };
  // globe.gl 標準のマウス判定は、マウスを動かすたびに GPU から画素を読み戻すため重い。
  // これを止めて、タップ (ほぼ動かさずに離した操作) だけを自前で判定する。
  globe.enablePointerInteraction(false);
  const pointers = new Map();
  let tapCandidate = null;
  const globeEl = $('globe');
  globeEl.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, true);
    tapCandidate = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId } : null;
  });
  globeEl.addEventListener('pointermove', (e) => {
    if (tapCandidate && tapCandidate.id === e.pointerId && Math.hypot(e.clientX - tapCandidate.x, e.clientY - tapCandidate.y) > 8) {
      tapCandidate = null; // ドラッグ (回転) なのでタップではない
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    const c = tapCandidate;
    tapCandidate = null;
    if (e.type !== 'pointerup' || !c || c.id !== e.pointerId || performance.now() - c.t > 600) return;
    const rect = globeEl.getBoundingClientRect();
    onGlobeTap(globe.toGlobeCoords(e.clientX - rect.left, e.clientY - rect.top));
  };
  globeEl.addEventListener('pointerup', endPointer);
  globeEl.addEventListener('pointercancel', endPointer);

  function bindChoices(groupId, key) {
    $(groupId).addEventListener('click', (e) => {
      const btn = e.target.closest('.choice');
      if (!btn) return;
      Sound.select();
      $(groupId).querySelectorAll('.choice').forEach((b) => b.classList.toggle('selected', b === btn));
      state[key] = btn.dataset.value;
    });
  }
  bindChoices('difficulty', 'difficulty');
  bindChoices('region', 'region');

  // すべてのボタンでタップ音 (選択肢は専用の音)
  document.addEventListener('pointerdown', (e) => {
    Sound.unlock(); // ブラウザの自動再生制限のため、最初の操作で音を有効にして BGM を開始
    const btn = e.target.closest('button');
    if (btn && !btn.classList.contains('choice') && !btn.disabled) Sound.tap();
  });

  $('start-btn').addEventListener('click', startGame);
  $('retry-btn').addEventListener('click', startGame);
  $('menu-btn').addEventListener('click', toTitle);
  $('quit-btn').addEventListener('click', toTitle);
  $('hint-btn').addEventListener('click', useHint);
  $('skip-btn').addEventListener('click', () => {
    if (!state.playing || state.answered) return;
    finishQuestion(false);
  });
  $('next-btn').addEventListener('click', () => {
    if (state.index >= TOTAL_QUESTIONS - 1) {
      showResult();
    } else {
      state.index++;
      nextQuestion();
    }
  });

  const soundBtn = $('sound-btn');
  const renderSound = () => { soundBtn.textContent = Sound.enabled ? '🔊' : '🔇'; };
  soundBtn.addEventListener('click', () => { Sound.toggle(); renderSound(); });
  renderSound();

  // ---------------------------------------------------------------- ロード
  // 地球の画像・国境線の画像・効果音/BGM をすべて準備してからスタートできるようにする
  $('start-btn').disabled = true;
  (async () => {
    const tasks = [
      new Promise((resolve) => {
        globe.onGlobeReady(resolve);
        setTimeout(resolve, 20000); // 万一イベントが来なくても進める
      }),
      buildBorderTexture().then((url) => { borderTexture = url; }).catch((e) => console.warn('border texture', e)),
      Sound.load().catch((e) => console.warn('sound', e)),
    ];
    let done = 0;
    const progress = () => {
      done++;
      $('load-bar').style.width = `${Math.round((done / tasks.length) * 100)}%`;
    };
    tasks.forEach((t) => t.then(progress));
    await Promise.all(tasks);
    $('loading').hidden = true;
    $('start-btn').disabled = false;
  })();

  refreshPolygons();
  applyLanguage();

  // テスト用
  window.__game = { state, globe, handleClick, features, countryAt };
})();
