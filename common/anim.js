/* =====================================================================
   おブログですわ — アニメーション共通基盤（SVG + GSAP）
   ---------------------------------------------------------------------
   ■ これは何？
     記事ごとに「見出しをふわっと出す」「スクロールで要素が現れる」
     「SVGを線画する」といった演出を、data 属性だけで付けられる仕組みです。
     独自の凝った演出は、記事フォルダ内の anim.js から追加できます。

   ■ 使う記事だけ、<body> の末尾（/common/site.js の後）に読み込む:
       <script src="/common/vendor/gsap.min.js"></script>
       <script src="/common/vendor/ScrollTrigger.min.js"></script>
       <script src="/common/anim.js"></script>
       <script src="anim.js"></script>   ← その記事だけの演出（任意・同じ日付フォルダ内）

   ■ HTML 側は data 属性でプリセットを指定:
       <h1  data-anim="fade-up">見出し</h1>
       <div data-anim="stagger" data-anim-stagger="0.1"> ...子要素... </div>
       <svg data-anim="draw"><path .../></svg>
     細かい調整は data-anim-○○ で:
       data-anim-duration / -delay / -distance / -ease / -start / -once / -stagger / -target

   ■ 記事専用の演出は、記事の anim.js で:
       // 新しいプリセットを足す（data-anim="pop" で使えるようになる）
       Anim.register('pop', function (el, opts, gsap) { ... });
       // GSAP 準備後に個別に動かす
       Anim.ready(function (gsap) { gsap.to('#hero', { ... }); });

   ※ プリセット追加（register）は「トップレベル」で呼ぶこと。
     ready() の中で足すと自動適用に間に合いません。
   ===================================================================== */
(function () {
  var g = window.gsap;
  if (!g) {
    console.warn('[anim] GSAP が見つかりません。/common/vendor/gsap.min.js を先に読み込んでください。');
    return;
  }
  if (window.ScrollTrigger) g.registerPlugin(window.ScrollTrigger);
  var hasST  = !!window.ScrollTrigger;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var presets = {};
  var readyCbs = [];
  var booted = false;

  // プリセットを登録（記事側からも Anim.register で追加可能）
  function register(name, fn) { presets[name] = fn; return API; }

  // GSAP 準備後に走らせたい処理を予約（すでに準備済みなら即実行）
  function ready(cb) {
    if (booted) { runCb(cb); } else { readyCbs.push(cb); }
  }
  function runCb(cb) { try { cb(g, API); } catch (e) { console.error('[anim]', e); } }

  // data-anim-foo-bar="0.5" → { fooBar: 0.5 } に整形（数値化できれば数値に）
  function readOpts(el) {
    var o = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      var m = /^data-anim-(.+)$/.exec(a.name);
      if (!m) continue;
      var key = m[1].replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
      var v = a.value.trim();
      var n = parseFloat(v);
      o[key] = (v !== '' && !isNaN(n) && String(n) === v) ? n : v;
    }
    return o;
  }

  // 画面内に入ったら発火する ScrollTrigger 設定（無ければ即再生にフォールバック）
  function withTrigger(el, o, vars) {
    if (hasST) {
      vars.scrollTrigger = { trigger: el, start: o.start || 'top 85%', once: o.once !== 0 };
    }
    return vars;
  }

  // 1要素にプリセットを適用
  function applyOne(el) {
    if (el.__anim) return;
    el.__anim = true;
    if (reduce) return;                       // 動きを控える設定なら、元の見た目のまま
    var name = el.getAttribute('data-anim');
    var fn = presets[name];
    if (!fn) { console.warn('[anim] 未知のプリセット:', name, el); return; }
    fn(el, readOpts(el), g);
  }
  function apply(root) {
    var nodes = (root || document).querySelectorAll('[data-anim]');
    Array.prototype.forEach.call(nodes, applyOne);
  }

  /* ---- 標準プリセット ------------------------------------------------ */

  // 下からふわっと（既定の万能リビール）
  register('fade-up', function (el, o, gsap) {
    gsap.from(el, withTrigger(el, o, {
      opacity: 0, y: o.distance || 24,
      duration: o.duration || 0.8, ease: o.ease || 'power2.out', delay: o.delay || 0
    }));
  });

  // その場でフェードイン
  register('fade-in', function (el, o, gsap) {
    gsap.from(el, withTrigger(el, o, {
      opacity: 0, duration: o.duration || 0.8, ease: o.ease || 'power2.out', delay: o.delay || 0
    }));
  });

  // ぷるっと拡大表示
  register('scale-in', function (el, o, gsap) {
    gsap.from(el, withTrigger(el, o, {
      opacity: 0, scale: o.from || 0.85, transformOrigin: '50% 50%',
      duration: o.duration || 0.7, ease: o.ease || 'back.out(1.6)', delay: o.delay || 0
    }));
  });

  // 子要素を順番に（data-anim-target でセレクタ指定可。既定は直下の子）
  register('stagger', function (el, o, gsap) {
    var targets = o.target ? el.querySelectorAll(o.target) : el.children;
    gsap.from(targets, withTrigger(el, o, {
      opacity: 0, y: o.distance || 20,
      duration: o.duration || 0.6, ease: o.ease || 'power2.out', stagger: o.stagger || 0.12
    }));
  });

  // SVG の線画（線を描くように出す）— GSAP core だけで実装（有料プラグイン不要）
  register('draw', function (el, o, gsap) {
    var shapes = el.matches('path,line,polyline,polygon,circle,rect,ellipse')
      ? [el] : el.querySelectorAll('path,line,polyline,polygon,circle,rect,ellipse');
    Array.prototype.forEach.call(shapes, function (p) {
      var len = (p.getTotalLength && p.getTotalLength()) || 0;
      gsap.set(p, { strokeDasharray: len || '100%', strokeDashoffset: len || 0 });
    });
    gsap.to(shapes, withTrigger(el, o, {
      strokeDashoffset: 0,
      duration: o.duration || 1.4, ease: o.ease || 'power1.inOut',
      stagger: o.stagger || 0.15, delay: o.delay || 0
    }));
  });

  /* ---- 公開 API ------------------------------------------------------ */
  var API = {
    register: register,
    apply: apply,
    ready: ready,
    gsap: g,
    ScrollTrigger: window.ScrollTrigger || null,
    presets: presets
  };
  window.Anim = API;

  function boot() {
    booted = true;
    apply();                                  // data-anim を自動適用
    readyCbs.forEach(runCb);
    readyCbs.length = 0;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
