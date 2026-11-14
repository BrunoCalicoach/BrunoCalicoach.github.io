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
    const hint = root.lang.slice(0, 2) === 'hr' ? 'Skrolaj' : 'Scroll';

    const stage = document.createElement('div');
    stage.className = 'intro-stage';
    stage.innerHTML = `
      <div class="intro-photo"><img src="${photoUrl}" alt=""><div class="intro-look"><div class="intro-look-fade"></div></div></div>
      <div class="intro-title" aria-hidden="true">${heading.innerHTML}</div>
      <button type="button" class="intro-hint"><span></span>${hint}</button>`;
    document.body.appendChild(stage);

    const photo = stage.querySelector('.intro-photo');
    const photoImage = photo.querySelector('img');

    // Copy the page photo's own look (darkening, crop and soft edge fades), so the intro photo
    // can turn into it on the way and land looking exactly like the real one.
    const look = photo.querySelector('.intro-look');
    const real = getComputedStyle(realPhoto);
    Object.assign(look.style, {
      backgroundImage: real.backgroundImage,
      // Crop exactly like the page photo, so both layers line up the whole way.
      backgroundSize: real.backgroundSize.split(',').map(() => 'cover').join(','),
      backgroundPosition: real.backgroundPosition,
      backgroundRepeat: real.backgroundRepeat,
      filter: real.filter
    });
    look.querySelector('.intro-look-fade').style.backgroundImage = getComputedStyle(realPhoto, '::after').backgroundImage;
    // The photo itself uses the page photo's crop point too (the last background layer is the photo).
    const positions = real.backgroundPosition.split(',');
    photoImage.style.objectPosition = positions[positions.length - 1].trim();
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

      // Photo: shrink from full screen into the real photo's exact place and size, while the
      // page photo's darkening and soft edges fade in over it.
      const to = realPhoto.getBoundingClientRect();
      const box = (rect) => ({ left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
      photo.animate([
        { left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px', opacity: 1 },
        { ...box(to), opacity: 1, offset: 0.8 },
        { ...box(to), opacity: 0 }
      ], { duration, easing: ease, fill: 'forwards' });
      look.animate([
        { opacity: 0 },
        { opacity: 0, offset: 0.15 },
        { opacity: 1, offset: 0.75 },
        { opacity: 1 }
      ], { duration, easing: 'ease-in-out', fill: 'forwards' });
      // The stage.s dark background thins out so the page underneath shows through.
      stage.animate([
        { backgroundColor: "rgba(11,11,11,1)" },
        { backgroundColor: "rgba(11,11,11,1)", offset: 0.35 },
        { backgroundColor: "rgba(11,11,11,0)" }
      ], { duration: duration * 0.75, easing: "ease", fill: "forwards" });
      photoImage.style.animation = 'none';

      // Headline: the same text, font and lines as the page headline, only bigger. It travels to
      // the page headline's spot, shrinking to its size, and settles with a small bounce.
      // When it lands, the page headline takes over in exactly the same place.
      const titleBox = title.getBoundingClientRect();
      const target = heading.getBoundingClientRect();
      const shrink = parseFloat(getComputedStyle(heading).fontSize) / parseFloat(getComputedStyle(title).fontSize);
      const dx = target.left - titleBox.left;
      const dy = target.top - titleBox.top;
      Object.assign(title.style, { left: titleBox.left + 'px', top: titleBox.top + 'px', bottom: 'auto', transform: 'none', transformOrigin: '0 0' });
      title.querySelectorAll('.hero-line').forEach((line) => {
        line.style.animation = 'none';
        line.style.opacity = '1';
        line.style.transform = 'none';
      });
      const travel = 1250;
      title.animate([
        { transform: 'translate(0, 0) scale(1)', textShadow: '0 8px 40px rgba(0,0,0,.6)' },
        { transform: `translate(${dx}px, ${dy + 16}px) scale(${shrink})`, offset: 0.8, easing: 'cubic-bezier(.3,0,.3,1)' },
        { transform: `translate(${dx}px, ${dy}px) scale(${shrink})`, textShadow: '0 0 0 rgba(0,0,0,0)' }
      ], { duration: travel, easing: 'cubic-bezier(.6,0,.35,1)', fill: 'forwards' });

      heading.style.transition = 'none';
      heading.style.opacity = '0';
      heading.classList.add('shown');
      setTimeout(() => {
        heading.style.opacity = '';
        title.style.visibility = 'hidden';
        setTimeout(() => { heading.style.transition = ''; }, 50);
      }, travel);

      // Menu, real photo, paragraph and buttons come in as the photo arrives.
      realPhoto.style.animation = 'none';
      setTimeout(finish, duration * 0.6);
      setTimeout(() => stage.remove(), duration + 50);
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
