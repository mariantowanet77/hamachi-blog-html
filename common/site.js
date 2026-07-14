/* =====================================================================
   おブログですわ — 共通スクリプト
   - サイドバーの「過去の記事」一覧
   - トップ／過去記事ページの記事カード
   - フッターの「累計アクセス数」
   ===================================================================== */

/* =====================================================================
   ▼ 記事データ（ここだけ編集すれば記事が増やせます）
   新しい記事を追加するときは、この配列の "先頭" に1ブロック追加してください。
   path は web フォルダのルートからの相対パス（末尾に / を付ける）です。
   例: 'pastarticles/hello-world/'
   ===================================================================== */
const ARTICLES = [
   {
    title:   'css,jsでクナイを投げよう！',
    date:    '2026-07-12',
    tag:     '技術',
    path:    'pastarticles/20260708/',
    excerpt: 'ブログ投函第二号。JSアニメーションの学習の一つとして、クナイを投げるみたいなものを作りました。',
  },
  {
    title:   '構造とか軽くご説明あそばせ',
    date:    '2026-06-30',
    tag:     '日記',
    path:    'pastarticles/20260630/',
    excerpt: 'ブログ投函第一号。自作ドメインで立ち上げたこのサイトの構成を軽ーく紹介します。',
  },
  {
    title:   'はじめての記事 — Hello World',
    date:    '2026-06-18',
    tag:     '日記',
    path:    'pastarticles/hello-world/',
    excerpt: 'ブログを始めました。これはひな形に付属するサンプル記事です。',
  },
  // ↓ 新しい記事はこの上の行（配列の先頭）に追加していくと新着順になります
];

/* =====================================================================
   ▼ ここから下は基本的に編集不要
   ===================================================================== */
(function () {
  // 各ページの <body data-base="..."> に書かれた、web ルートまでの相対パス
  const base = document.body.dataset.base || '';

  // 記事へのリンクを作る。
  // フォルダ指定（末尾が /）のときは、そのままフォルダURL（○○/）へ飛ばす。
  // S3 の静的ホスティングが index.html を自動で補うので、URL に index.html は出ない。
  function articleHref(path) {
    return base + path;
  }

  // 記事カードのHTMLを作る
  function cardHTML(article) {
    return (
      '<article class="card">' +
        '<div class="card__meta">' +
          '<span class="tag">' + article.tag + '</span>' +
          '<time datetime="' + article.date + '">' + article.date + '</time>' +
        '</div>' +
        '<h3 class="card__title"><a href="' + articleHref(article.path) + '">' + article.title + '</a></h3>' +
        '<p class="card__excerpt">' + (article.excerpt || '') + '</p>' +
      '</article>'
    );
  }

  // --- サイドバー：過去の記事（最新5件） ---
  const sidebar = document.getElementById('sidebar-articles');
  if (sidebar) {
    if (ARTICLES.length === 0) {
      sidebar.innerHTML = '<li class="article-list__empty">まだ記事がありません</li>';
    } else {
      sidebar.innerHTML = ARTICLES.slice(0, 5).map(function (a) {
        return (
          '<li class="article-list__item">' +
            '<a href="' + articleHref(a.path) + '">' +
              '<span class="article-list__date">' + a.date + '</span>' +
              '<span class="article-list__title">' + a.title + '</span>' +
            '</a>' +
          '</li>'
        );
      }).join('');
    }
  }

  // --- トップページ：最新の記事（3件） ---
  const latest = document.getElementById('latest-articles');
  if (latest) {
    latest.innerHTML = ARTICLES.length
      ? ARTICLES.slice(0, 3).map(cardHTML).join('')
      : '<p class="article-list__empty">まだ記事がありません。</p>';
  }

  // --- 過去記事ページ：すべての記事（管理用） ---
  const manage = document.getElementById('article-manage');
  if (manage) {
    manage.innerHTML = ARTICLES.length
      ? ARTICLES.map(cardHTML).join('')
      : '<p class="article-list__empty">まだ記事がありません。site.js の ARTICLES に追加してください。</p>';
  }

// --- 累計アクセス数（Lambda + DynamoDB｜localStorageで二重カウント防止） ---
  const countEl = document.getElementById('access-count');
  if (countEl) {
    const COUNTER_URL = 'https://q4u3h52bgomsp5k76sjxj4p4uu0uvfmf.lambda-url.ap-northeast-1.on.aws/';
    let isNew = false;
    try {
      if (!localStorage.getItem('hamachi_visited')) {
        isNew = true;
        localStorage.setItem('hamachi_visited', '1');
      }
    } catch (e) {
      // localStorageが使えない環境（プライベートモード等）では毎回カウント扱い
      isNew = true;
    }
    fetch(COUNTER_URL + (isNew ? '?new=1' : ''))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        countEl.textContent = Number(data.count).toLocaleString('ja-JP');
      })
      .catch(function (e) {
        countEl.textContent = '—';
        console.warn('カウンターの取得に失敗:', e);
      });
  }

  // --- 記事のいいねボタン（Lambda(Java) + DynamoDB｜localStorageで自分の状態を記憶） ---
  // 記事ページのカテゴリ（.tag）の横にハート型のトグルボタンを差し込みます。
  // LIKE_API_URL が空（デプロイ前）の間は何も表示しません。
  const LIKE_API_URL = 'https://nfnfwtchy4khy4nqi3bjsj463a0xndnv.lambda-url.ap-northeast-1.on.aws/'; // 例: 'https://xxxx.lambda-url.ap-northeast-1.on.aws/'
  // 一覧のカード（article.card）ではなく、記事本文の先頭にあるメタ欄だけが対象
  const likeMeta = document.querySelector('article:not(.card) .card__meta');
  // 記事ID = pastarticles/ 直下のフォルダ名（例: 20260708, hello-world）
  const likeMatch = location.pathname.match(/\/pastarticles\/([A-Za-z0-9_-]+)\//);
  if (LIKE_API_URL && likeMeta && likeMatch) {
    const articleId = likeMatch[1];
    const storageKey = 'hamachi_liked_' + articleId;

    let liked = false;
    try { liked = localStorage.getItem(storageKey) === '1'; } catch (e) {}
    let likes = null;   // サーバー上のいいね数（取得できるまで null）
    let busy = false;   // 連打で API を叩きすぎないように

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'like-btn';
    btn.innerHTML =
      '<span class="like-btn__heart" aria-hidden="true">♥</span>' +
      '<span class="like-btn__count">…</span>';
    likeMeta.appendChild(btn);
    const likeCountEl = btn.querySelector('.like-btn__count');

    function renderLike() {
      btn.classList.toggle('is-liked', liked);
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      btn.setAttribute('aria-label', liked ? 'いいねを取り消す' : 'いいねする');
      likeCountEl.textContent = likes === null ? '…' : Number(likes).toLocaleString('ja-JP');
    }
    renderLike();

    // 現在のいいね数を取得
    fetch(LIKE_API_URL + '?article=' + articleId)
      .then(function (res) { return res.json(); })
      .then(function (data) { likes = data.likes; renderLike(); })
      .catch(function (e) {
        likeCountEl.textContent = '—';
        console.warn('いいね数の取得に失敗:', e);
      });

    btn.addEventListener('click', function () {
      if (busy || likes === null) return;
      busy = true;

      // 先に見た目を切り替える（楽観的更新）。失敗したら戻す。
      const prevLiked = liked;
      const prevLikes = likes;
      liked = !liked;
      likes = Math.max(0, likes + (liked ? 1 : -1));
      renderLike();

      fetch(LIKE_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ article: articleId, action: liked ? 'like' : 'unlike' }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          likes = data.likes; // サーバーの正確な数に合わせる
          try { localStorage.setItem(storageKey, liked ? '1' : '0'); } catch (e) {}
        })
        .catch(function (e) {
          liked = prevLiked;
          likes = prevLikes;
          console.warn('いいねの送信に失敗:', e);
        })
        .then(function () { // 成否どちらでも最終状態を描画
          busy = false;
          renderLike();
        });
    });
  }

  // --- タイトルのタイプライター演出 ---
  // data-typewriter を付けた要素の文字を、1文字ずつカタカタと表示します。
  // data-typewriter の値 = 「1文字あたりの表示間隔(ミリ秒)」。省略時は 110。
  document.querySelectorAll('[data-typewriter]').forEach(function (el) {
    const chars = Array.from(el.textContent);   // 絵文字も1文字として扱う
    const speed = parseInt(el.dataset.typewriter, 10) || 110;

    el.textContent = '';
    el.classList.add('is-typing');
    let i = 0;
    (function tick() {
      if (i < chars.length) {
        el.textContent += chars[i++];
        setTimeout(tick, speed);
      } else {
        el.classList.remove('is-typing');
        el.classList.add('is-done');
      }
    })();
  });

  /* =====================================================================
     ▼ 背景の情景（夜空・海・砂浜）
     <body> の先頭に .scene を差し込み、星をばらまいて、
     ときどき流れ星を飛ばします。secret/ 配下では表示しません。
     ===================================================================== */
  function initScene() {
    if (document.querySelector('.scene')) return;      // 二重生成を防ぐ
    const reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = document.createElement('div');
    scene.className = 'scene';
    scene.setAttribute('aria-hidden', 'true');         // 装飾なので読み上げ対象外
    scene.innerHTML =
      '<div class="scene__sky"></div>' +
      '<div class="scene__moon"></div>' +
      '<div class="scene__stars"></div>' +
      '<div class="scene__sea"><div class="scene__moonlight"></div></div>' +
      '<div class="scene__beach"></div>' +
      '<div class="scene__shooting"></div>';
    document.body.prepend(scene);

    // --- 星をばらまく（夜空エリアに） ---
    const stars = scene.querySelector('.scene__stars');
    const count = Math.min(160, Math.round(window.innerWidth / 9));
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'star';
      const size = Math.random() < 0.15 ? 2.6 : (Math.random() < 0.5 ? 1.8 : 1.2);
      s.style.left = (Math.random() * 100) + '%';
      s.style.top  = (Math.random() * 100) + '%';
      s.style.width = s.style.height = size + 'px';
      s.style.setProperty('--dur',   (2 + Math.random() * 3.5).toFixed(2) + 's');
      s.style.setProperty('--delay', (Math.random() * 4).toFixed(2) + 's');
      frag.appendChild(s);
    }
    stars.appendChild(frag);

    if (reduce) return;   // 「動きを減らす」設定なら流れ星は出さない

    // --- ときどき小さな流れ星 ---
    const layer = scene.querySelector('.scene__shooting');
    function shoot() {
      const el = document.createElement('div');
      el.className = 'shooting-star';
      el.innerHTML = '<span class="shooting-star__streak"></span>';
      const toLeft = Math.random() < 0.5;              // 左下 or 右下へ
      const ang = toLeft ? (180 - (16 + Math.random() * 16)) : (16 + Math.random() * 16);
      el.style.setProperty('--ang',  ang + 'deg');
      el.style.setProperty('--dist', (280 + Math.random() * 260) + 'px');
      el.style.setProperty('--sdur', (700 + Math.random() * 450) + 'ms');
      el.style.left = (Math.random() * 90 + 5) + 'vw';
      el.style.top  = (Math.random() * 32 + 3) + 'vh';
      el.addEventListener('animationend', function () { el.remove(); });
      layer.appendChild(el);
    }
    (function schedule() {
      setTimeout(function () { shoot(); schedule(); }, 4000 + Math.random() * 7000);
    })();
  }

  // secret/ 配下（隠しページ）では情景を出さない
  if (!location.pathname.includes('/secret/')) {
    initScene();
  }
})();
