/* =====================================================================
   pastarticles/20260708/ — この記事だけのアニメーション
   共通基盤（/common/anim.js）が読み込まれた後に実行されます。
   ここに書けば、他の記事に影響を与えずに演出を足せます。
   ===================================================================== */

/* ① 記事専用のプリセットを追加（HTML で data-anim="pop" として使える）
      ※ 自動適用に間に合わせるため、register はトップレベルで呼ぶ。 */
Anim.register('pop', function (el, opts, gsap) {
  gsap.from(el, {
    scale: 0, rotation: -25, opacity: 0, transformOrigin: '50% 50%',
    duration: 0.6, ease: 'back.out(2)',
    scrollTrigger: Anim.ScrollTrigger ? { trigger: el, start: 'top 85%', once: true } : undefined
  });
});

/* ② DOM 準備後に、個別の要素をアニメーションさせる */
Anim.ready(function (gsap) {
  // 見出しの星アイコンを、ゆっくり揺れながら浮かせ続ける
  if (document.getElementById('demo-star')) {
    gsap.to('#demo-star', {
      y: -6, rotation: 12, transformOrigin: '50% 50%',
      duration: 1.6, ease: 'sine.inOut', repeat: -1, yoyo: true
    });
  }
});
