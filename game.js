/* 国探し - リアルな地球を回してお題の国を見つけるゲーム */
(() => {
  'use strict';

  const TOTAL_QUESTIONS = 10;
  const MAX_MISSES = 3;
  const TINY_AREA = 1.0;        // これより小さい国 (平方度) は近くを押せば正解
  const TINY_RADIUS_KM = 150;

  const DIFFICULTY = {
    easy:   { label: 'かんたん',   borders: true,  filter: (p) => p.rank <= 3 },
    normal: { label: 'ふつう',     borders: false, filter: (p) => p.rank <= 4 },
    hard:   { label: 'むずかしい', borders: false, filter: (p) => p.rank >= 5 }, // マニアックな国
  };

  const $ = (id) => document.getElementById(id);
  const features = window.COUNTRIES.features;

  // ---------------------------------------------------------------- 効果音
  const Sound = (() => {
    let ctx = null;
    let enabled = true;
    try { enabled = localStorage.getItem('kunisagashi.sound') !== 'off'; } catch (e) { /* noop */ }

    let master = null;
    function ac() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = enabled ? 1 : 0;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    // 1音を鳴らす
    function tone(freq, start, dur, { type = 'sine', vol = 0.2, slideTo = null, attack = 0.005 } = {}) {
      const c = ac();
      if (!c || !enabled) return;
      const t0 = c.currentTime + start;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568 };

    return {
      get enabled() { return enabled; },
      get ctx() { return ac(); },
      get master() { ac(); return master; },
      toggle() {
        enabled = !enabled;
        if (master) master.gain.setTargetAtTime(enabled ? 1 : 0, ctx.currentTime, 0.05);
        try { localStorage.setItem('kunisagashi.sound', enabled ? 'on' : 'off'); } catch (e) { /* noop */ }
        return enabled;
      },
      unlock() { ac(); },
      tap() { tone(1200, 0, 0.06, { type: 'triangle', vol: 0.15 }); },
      select() { tone(900, 0, 0.05, { type: 'triangle', vol: 0.12 }); tone(1350, 0.05, 0.07, { type: 'triangle', vol: 0.12 }); },
      question() {
        tone(N.E5, 0, 0.25, { type: 'triangle', vol: 0.18 });
        tone(N.B5, 0.12, 0.45, { type: 'triangle', vol: 0.18 });
      },
      correct() {
        [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, i * 0.07, 0.25, { type: 'square', vol: 0.07 }));
        tone(N.E6, 0.28, 0.5, { type: 'triangle', vol: 0.15 });
      },
      wrong() {
        tone(220, 0, 0.18, { type: 'sawtooth', vol: 0.09, slideTo: 150 });
        tone(160, 0.17, 0.3, { type: 'sawtooth', vol: 0.09, slideTo: 100 });
      },
      sea() { tone(300, 0, 0.18, { type: 'sine', vol: 0.15, slideTo: 200 }); },
      hint() { tone(N.A5, 0, 0.12, { type: 'sine', vol: 0.15 }); tone(N.E6, 0.1, 0.25, { type: 'sine', vol: 0.12 }); },
      reveal() {
        tone(N.G5, 0, 0.2, { type: 'triangle', vol: 0.15 });
        tone(N.E5, 0.15, 0.2, { type: 'triangle', vol: 0.15 });
        tone(N.C5, 0.3, 0.45, { type: 'triangle', vol: 0.15 });
      },
      fanfare() {
        const seq = [[N.C5, 0], [N.E5, 0.12], [N.G5, 0.24], [N.C6, 0.36], [N.G5, 0.6], [N.C6, 0.72]];
        seq.forEach(([f, t]) => tone(f, t, 0.3, { type: 'square', vol: 0.06 }));
        tone(N.E6, 0.84, 0.8, { type: 'triangle', vol: 0.16 });
        tone(N.G6, 0.84, 0.8, { type: 'triangle', vol: 0.08 });
      },
    };
  })();

  // ---------------------------------------------------------------- BGM (宇宙のアンビエント)
  // 音声ファイルを使わず、Web Audio でゆっくり変化する和音ときらめく音をリアルタイム生成する
  const Music = (() => {
    let started = false;
    let bus = null;
    let reverb = null;
    let chordIndex = 0;

    // ゆったりした和音進行 (Cmaj9 → Am9 → Fmaj7#11 → Gsus2)
    const CHORDS = [
      [48, 55, 59, 62, 64],
      [45, 52, 55, 59, 60],
      [41, 48, 52, 55, 59],
      [43, 50, 55, 57, 62],
    ];
    const SPARKLE = [72, 74, 76, 79, 81, 84, 86, 88]; // ペンタトニック
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function makeImpulse(c, seconds, decay) {
      const len = Math.floor(c.sampleRate * seconds);
      const buf = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    function playChord() {
      const c = Sound.ctx;
      const notes = CHORDS[chordIndex % CHORDS.length];
      chordIndex++;
      const t0 = c.currentTime;
      const dur = 9;
      notes.forEach((m, i) => {
        [-6, 6].forEach((detune) => {
          const osc = c.createOscillator();
          const filt = c.createBiquadFilter();
          const g = c.createGain();
          osc.type = i === 0 ? 'sine' : 'sawtooth';
          osc.frequency.value = mtof(m);
          osc.detune.value = detune;
          filt.type = 'lowpass';
          filt.frequency.setValueAtTime(400, t0);
          filt.frequency.linearRampToValueAtTime(900 + Math.random() * 400, t0 + dur / 2);
          filt.frequency.linearRampToValueAtTime(400, t0 + dur);
          const v = i === 0 ? 0.05 : 0.012;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(v, t0 + 3);
          g.gain.setValueAtTime(v, t0 + dur - 3.5);
          g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 1);
          osc.connect(filt).connect(g).connect(bus);
          osc.start(t0);
          osc.stop(t0 + dur + 1.2);
        });
      });
    }

    function sparkle() {
      const c = Sound.ctx;
      const t0 = c.currentTime + Math.random() * 0.5;
      const m = SPARKLE[Math.floor(Math.random() * SPARKLE.length)];
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = mtof(m);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.5);
      osc.connect(g).connect(reverb);
      osc.start(t0);
      osc.stop(t0 + 2.6);
    }

    return {
      start() {
        if (started) return;
        const c = Sound.ctx;
        if (!c) return;
        started = true;
        bus = c.createGain();
        bus.gain.value = 0.9;
        reverb = c.createConvolver();
        reverb.buffer = makeImpulse(c, 5, 2.5);
        const wet = c.createGain();
        wet.gain.value = 0.8;
        bus.connect(Sound.master);
        bus.connect(reverb);
        reverb.connect(wet).connect(Sound.master);
        playChord();
        setInterval(playChord, 8000);
        (function loop() {
          sparkle();
          setTimeout(loop, 1200 + Math.random() * 3500);
        })();
      },
    };
  })();

  // ---------------------------------------------------------------- 地球
  const globe = new Globe($('globe'))
    .globeImageUrl('img/earth-blue-marble.jpg')
    .bumpImageUrl('img/earth-topology.png')
    .backgroundImageUrl('img/night-sky.png')
    .showAtmosphere(true)
    .atmosphereColor('#7cc4ff')
    .atmosphereAltitude(0.18)
    .polygonsData(features)
    .polygonGeoJsonGeometry('geometry')
    .polygonSideColor(() => null)
    .polygonsTransitionDuration(200)
    .htmlElementsData([])
    .htmlLat('lat').htmlLng('lng').htmlAltitude(0.02)
    .htmlElement((d) => {
      const el = document.createElement('div');
      el.className = 'country-tag ' + d.cls;
      el.textContent = d.text;
      return el;
    })
    .pointOfView({ lat: 25, lng: 135, altitude: 2.6 });

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
    hoverId: null,
    tags: [],
  };

  const CAP = {
    good: 'rgba(61, 220, 132, 0.55)',
    bad: 'rgba(255, 70, 70, 0.5)',
    reveal: 'rgba(255, 200, 61, 0.6)',
    hover: 'rgba(255, 255, 255, 0.18)',
    none: 'rgba(0, 0, 0, 0)',
  };
  const STROKE = {
    good: '#3ddc84', bad: '#ff5a5a', reveal: '#ffc83d',
  };

  function refreshPolygons() {
    const borders = DIFFICULTY[state.difficulty].borders && (state.playing || state.answered);
    globe
      .polygonCapColor((f) => {
        const m = state.marks.get(f.properties.id);
        if (m) return CAP[m];
        if (borders && f.properties.id === state.hoverId) return CAP.hover;
        return CAP.none;
      })
      .polygonStrokeColor((f) => {
        const m = state.marks.get(f.properties.id);
        if (m) return STROKE[m];
        return borders ? 'rgba(255, 255, 255, 0.75)' : null;
      })
      .polygonAltitude((f) => (state.marks.has(f.properties.id) ? 0.012 : 0.006));
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

  const fmtTime = (ms) => (ms / 1000).toFixed(1) + '秒';

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
    state.hoverId = null;
    setTags();
    refreshPolygons();
    controls.autoRotate = true;
    show('title');
  }

  // ---------------------------------------------------------------- ゲーム進行
  function startGame() {
    const diff = DIFFICULTY[state.difficulty];
    const pool = features
      .map((f) => f.properties)
      .filter((p) => p.q && diff.filter(p) && (state.region === 'all' || p.continent === state.region));
    if (pool.length === 0) {
      toast('この条件では問題がありません', 'warn');
      return;
    }
    // 国数が10未満の地域では重複を許して10問にする
    let qs = shuffle(pool.slice());
    while (qs.length < TOTAL_QUESTIONS) qs = qs.concat(shuffle(pool.slice()));
    state.questions = qs.slice(0, TOTAL_QUESTIONS);
    state.index = 0;
    state.score = 0;
    state.results = [];
    state.playing = true;
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
    $('q-name').textContent = state.target.ja;
    $('hint-text').textContent = '';
    $('score').textContent = `${state.score}点`;
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

  function renderLives() {
    const left = MAX_MISSES - state.misses;
    $('lives').textContent = '❤'.repeat(left) + '♡'.repeat(state.misses);
  }

  function currentElapsed() {
    return state.answered ? state.elapsed : performance.now() - state.startedAt;
  }

  function tick() {
    if (state.playing) $('timer').textContent = '⏱ ' + fmtTime(currentElapsed());
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
    state.results.push({ name: t.ja, correct, time: state.elapsed, pts });

    state.marks.set(t.id, correct ? 'good' : 'reveal');
    state.tags = state.tags.filter((g) => g.id !== t.id);
    state.tags.push({ id: t.id, lat: t.lat, lng: t.lng, text: t.ja, cls: correct ? 'good' : 'reveal' });
    setTags();
    refreshPolygons();

    $('score').textContent = `${state.score}点`;
    $('hint-btn').disabled = true;
    $('skip-btn').disabled = true;

    // 国の位置へカメラを移動
    const alt = t.area < TINY_AREA ? 0.6 : Math.min(2, Math.max(0.8, Math.sqrt(t.area) / 12));
    globe.pointOfView({ lat: t.lat, lng: t.lng, altitude: alt }, 1000);

    if (correct) {
      Sound.correct();
      toast(`正解！ +${pts}点（${fmtTime(state.elapsed)}）`, 'good', 2500);
    } else {
      Sound.reveal();
      toast(`正解は「${t.ja}」でした`, 'warn', 2500);
    }

    const last = state.index >= TOTAL_QUESTIONS - 1;
    $('next-btn').textContent = last ? '結果を見る' : '次の問題へ';
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
      toast('そこは海です', '', 1200);
      return;
    }

    // 不正解: 押した国を赤く表示して名前を教える
    const p = feature.properties;
    state.misses++;
    renderLives();
    Sound.wrong();
    state.marks.set(p.id, 'bad');
    state.tags = state.tags.filter((g) => g.id !== p.id);
    state.tags.push({ id: p.id, lat: coords ? coords.lat : p.lat, lng: coords ? coords.lng : p.lng, text: p.ja, cls: 'bad' });
    setTags();
    refreshPolygons();

    if (state.misses >= MAX_MISSES) {
      setTimeout(() => finishQuestion(false), 500);
      toast(`そこは「${p.ja}」です`, 'bad', 1000);
      return;
    }
    toast(`ちがいます！ そこは「${p.ja}」です`, 'bad');

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
    if (state.hints === 1) {
      $('hint-text').textContent = `ヒント: ${t.continent}の国です`;
    } else {
      $('hint-text').textContent = `ヒント: ${t.continent}の国です ／ このあたりにあります`;
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

    $('final-score').textContent = state.score;
    $('final-correct').textContent = `${correctCount}/${TOTAL_QUESTIONS}`;
    $('final-time').textContent = fmtTime(totalTime);

    const rate = state.score / (TOTAL_QUESTIONS * 1000);
    $('final-comment').textContent =
      rate >= 0.85 ? '🌏 地理マスター！すばらしい！' :
      rate >= 0.65 ? '✈️ 世界旅行の達人！' :
      rate >= 0.45 ? '🧭 なかなかの冒険家！' :
      rate >= 0.25 ? '🗺 もう少しで一人前！' :
      '🎒 地球儀をくるくる回して覚えよう！';

    const best = loadBest();
    const label = `${DIFFICULTY[state.difficulty].label}・${state.region === 'all' ? '全世界' : state.region}`;
    if (!best || state.score > best.score) {
      saveBest({ score: state.score, time: totalTime });
      $('best-score').textContent = best ? `🎉 ベスト更新！（${label}）前回のベスト: ${best.score}点` : `ベストスコア（${label}）: ${state.score}点`;
    } else {
      $('best-score').textContent = `ベストスコア（${label}）: ${best.score}点 / ${fmtTime(best.time)}`;
    }

    const list = $('result-list');
    list.innerHTML = '';
    state.results.forEach((r, i) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = r.correct ? 'ok' : 'ng';
      name.textContent = `${r.correct ? '○' : '×'} Q${i + 1} ${r.name}`;
      const pts = document.createElement('span');
      pts.className = 'pts';
      pts.textContent = `${fmtTime(r.time)} / ${r.pts}点`;
      li.append(name, pts);
      list.append(li);
    });

    state.marks.clear();
    state.tags = [];
    setTags();
    refreshPolygons();
    controls.autoRotate = true;
    globe.pointOfView({ altitude: 2.6 }, 1200);
    show('result');
    Sound.fanfare();
  }

  // ---------------------------------------------------------------- イベント
  globe
    .onPolygonClick((f, ev, coords) => handleClick(f, coords))
    .onGlobeClick((coords) => handleClick(null, coords))
    .onPolygonHover((f) => {
      if (!DIFFICULTY[state.difficulty].borders || !state.playing) return;
      state.hoverId = f ? f.properties.id : null;
      refreshPolygons();
    });

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
    Sound.unlock();
    Music.start(); // ブラウザの自動再生制限のため、最初の操作で BGM を開始
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

  // 地球のテクスチャ読み込み完了
  $('start-btn').disabled = true;
  globe.onGlobeReady(() => {
    $('start-btn').disabled = false;
    $('loading').hidden = true;
  });
  // 念のため、読み込みが遅くても操作できるようにする
  setTimeout(() => { $('start-btn').disabled = false; $('loading').hidden = true; }, 8000);

  refreshPolygons();

  // テスト用
  window.__game = { state, globe, handleClick, features };
})();
