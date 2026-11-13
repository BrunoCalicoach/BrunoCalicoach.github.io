// Home page intro.
// First visit of a session: only the photo and a big headline. The first swipe, scroll, arrow key
// or tap moves the photo into its place, drops the real headline in, and fades the rest of the
// top section up. After that the page behaves exactly as normal.
// The small script in the page's <head> decides whether the intro plays (adds class "intro").
(function () {
  const root = document.documentElement;
  if (!root.classList.contains('intro')) return;

  const finish = () => {
    root.classList.remove('intro');
    document.dispatchEvent(new Event('intro:done'));
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
  };

  try {
    const hero = document.querySelector('.hero-bg');
    const heading = hero && hero.querySelector('h1');
    const realPhoto = hero && hero.querySelector('.hero-photo');
    if (!heading || !realPhoto || !Element.prototype.animate) { finish(); return; }

    // Take the photo and the headline from the page itself, so it works in every language.
    const urls = [...getComputedStyle(realPhoto).backgroundImage.matchAll(/url\("?([^")]+)"?\)/g)];
    const photoUrl = urls.length ? urls[urls.length - 1][1] : '';
    const accent = heading.querySelector('span');
    const lead = [...heading.childNodes].filter((node) => node !== accent).map((node) => node.textContent).join(' ').replace(/\s+/g, ' ').trim();
    const hint = root.lang.slice(0, 2) === 'hr' ? 'Skrolaj' : 'Scroll';

    const stage = document.createElement('div');
    stage.className = 'intro-stage';
    stage.innerHTML = `
      <div class="intro-photo"><img src="${photoUrl}" alt=""></div>
      <div class="intro-title" aria-hidden="true">
        <span class="intro-line">${lead}</span>
        <span class="intro-line ${accent ? accent.className : ''}">${accent ? accent.textContent.trim() : ''}</span>
      </div>
      <button type="button" class="intro-hint"><span></span>${hint}</button>`;
    document.body.appendChild(stage);

    const photo = stage.querySelector('.intro-photo');
    const photoImage = photo.querySelector('img');
    const title = stage.querySelector('.intro-title');
    let started = false;

    function start() {
      if (started) return;
      started = true;
      cleanup();
      stage.classList.add('leaving');
      try { sessionStorage.setItem('intro-seen', '1'); } catch (e) { /* private mode */ }

      const duration = 1500;
      const ease = 'cubic-bezier(.65,0,.25,1)';

      // Photo: glide from the centre into the real photo's place, dimming like the real one.
      const from = photo.getBoundingClientRect();
      const to = realPhoto.getBoundingClientRect();
      Object.assign(photo.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', transform: 'none' });
      const scale = to.width / from.width;
      photo.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scale})`, opacity: 1, offset: 0.7 },
        { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scale})`, opacity: 0 }
      ], { duration, easing: ease, fill: 'forwards' });
      // The stage.s dark background thins out so the page underneath shows through.
      stage.animate([
        { backgroundColor: "rgba(11,11,11,1)" },
        { backgroundColor: "rgba(11,11,11,1)", offset: 0.35 },
        { backgroundColor: "rgba(11,11,11,0)" }
      ], { duration: duration * 0.75, easing: "ease", fill: "forwards" });
      photoImage.style.animation = 'none';
      photoImage.animate([{ filter: 'brightness(.95)' }, { filter: 'brightness(.5)' }], { duration: duration * 0.7, easing: ease, fill: 'forwards' });

      // Big headline: shrink towards the real headline and fade as it lands.
      const lines = [...title.querySelectorAll('.intro-line')].map((line) => line.getBoundingClientRect());
      const textBox = {
        left: Math.min(...lines.map((r) => r.left)),
        top: Math.min(...lines.map((r) => r.top)),
        width: Math.max(...lines.map((r) => r.right)) - Math.min(...lines.map((r) => r.left)),
        height: Math.max(...lines.map((r) => r.bottom)) - Math.min(...lines.map((r) => r.top))
      };
      const target = heading.getBoundingClientRect();
      const titleBox = title.getBoundingClientRect();
      const shrink = Math.min(target.width / textBox.width, target.height / textBox.height);
      Object.assign(title.style, { left: titleBox.left + 'px', bottom: 'auto', top: titleBox.top + 'px', transform: 'none' });
      title.style.transformOrigin = `${textBox.left - titleBox.left}px ${textBox.top - titleBox.top}px`;
      title.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { opacity: 1, offset: 0.45 },
        { transform: `translate(${target.left - textBox.left}px, ${target.top - textBox.top}px) scale(${shrink})`, opacity: 0 }
      ], { duration: duration * 0.85, easing: ease, fill: 'forwards' });

      // The real headline drops in and settles.
      heading.style.transition = 'none';
      heading.classList.add('shown');
      heading.animate([
        { opacity: 0, transform: 'translateY(-70px)' },
        { opacity: 0, transform: 'translateY(-70px)', offset: 0.5 },
        { opacity: 1, transform: 'translateY(8px)', offset: 0.82, easing: 'cubic-bezier(.3,1.4,.5,1)' },
        { opacity: 1, transform: 'none' }
      ], { duration, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });

      // Menu, real photo, paragraph and buttons come in as the photo arrives.
      realPhoto.style.animation = 'none';
      setTimeout(finish, duration * 0.6);
      setTimeout(() => {
        stage.remove();
        heading.style.transition = '';
      }, duration + 50);
    }

    // ---------- What starts it ----------
    let touchY = null;
    const onWheel = (event) => { event.preventDefault(); if (event.deltaY > 0) start(); };
    const onTouchStart = (event) => { touchY = event.touches[0].clientY; };
    const onTouchMove = (event) => {
      event.preventDefault();
      if (touchY !== null && touchY - event.touches[0].clientY > 12) start();
    };
    const onKey = (event) => {
      if (['ArrowDown', 'PageDown', ' ', 'Spacebar', 'End', 'Enter'].includes(event.key)) { event.preventDefault(); start(); }
    };
    function cleanup() {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    stage.addEventListener('click', start);
  } catch (error) {
    document.querySelectorAll('.intro-stage').forEach((stage) => stage.remove());
    finish();
  }
})();
