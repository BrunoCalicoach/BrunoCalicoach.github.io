// Home page intro.
// First visit of a session: only the photo and a big headline. The first swipe, scroll, arrow key
// or tap moves the photo into its place, drops the real headline in, and fades the rest of the
// top section up. After that the page behaves exactly as normal.
// The small script in the page's <head> decides whether the intro plays (adds class "intro").
(function () {
  // Paths in data-intro-video / data-intro-poster are from the site's main folder (where this
  // script lives), so the Croatian pages in hr/ find the same files.
  const scriptUrl = document.currentScript ? document.currentScript.src : location.href;
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

    // With a video (data-intro-video on the page photo): its first frame shows at the start, the
    // first swipe plays it, and it stops on its last frame, which is the page photo itself.
    const videoPath = realPhoto.dataset.introVideo;
    const posterPath = realPhoto.dataset.introPoster;
    const fromRoot = (path) => new URL(path, scriptUrl).href;
    const media = videoPath
      ? `<video src="${fromRoot(videoPath)}"${posterPath ? ` poster="${fromRoot(posterPath)}"` : ''} muted playsinline preload="auto" disablepictureinpicture></video>`
      : `<img src="${photoUrl}" alt="">`;

    const stage = document.createElement('div');
    stage.className = 'intro-stage';
    stage.innerHTML = `
      <div class="intro-photo">${media}<div class="intro-look"><div class="intro-look-fade"></div></div></div>
      <div class="intro-title" aria-hidden="true">${heading.innerHTML}</div>
      <button type="button" class="intro-hint"><span></span>${hint}</button>`;
    document.body.appendChild(stage);

    const photo = stage.querySelector('.intro-photo');
    const photoImage = photo.querySelector('img, video');
    const video = photo.querySelector('video');
    if (video) video.muted = true; // some phones only allow inline playback when muted is set here too

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

      // With a video, everything moves at the video's own pace, so the headline lands and the
      // photo settles just as the pose is reached.
      let duration = 1500;
      let travel = 1250;
      if (video) {
        const seconds = isFinite(video.duration) && video.duration > 0 ? video.duration : 1.7;
        duration = Math.max(1500, Math.round(seconds * 1000 + 200));
        travel = Math.round(duration * 0.83);
        video.play().catch(() => { /* the first frame simply moves into place */ });
      }
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
      // (With a video the page photo comes in later, so the movement stays visible to the end.)
      look.animate([
        { opacity: 0 },
        { opacity: 0, offset: video ? 0.55 : 0.15 },
        { opacity: 1, offset: video ? 0.95 : 0.75 },
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
