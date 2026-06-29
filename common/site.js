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
})();
