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
    root.classList.remove('intro', 'intro-leaving');
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
    // With a video, only the darkening layer is copied (the first background layer): the video
    // itself becomes the page photo at the end, so there is no second picture to swap to.
    const shadeLayer = (real.backgroundImage.match(/^linear-gradient\((?:[^()]|\([^()]*\))*\)/) || [''])[0];
    Object.assign(look.style, {
      backgroundImage: video && shadeLayer ? shadeLayer : real.backgroundImage,
      // Crop exactly like the page photo, so both layers line up the whole way.
      backgroundSize: real.backgroundSize.split(',').map(() => 'cover').join(','),
      backgroundPosition: real.backgroundPosition,
      backgroundRepeat: real.backgroundRepeat
    });
    // The page photo's colour filter (e.g. black and white) goes on the whole intro photo box,
    // so the video or picture looks the same from the very first frame.
    photo.style.filter = real.filter;
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
      if (video) {
        const seconds = isFinite(video.duration) && video.duration > 0 ? video.duration : 1.7;
        duration = Math.max(1500, Math.round(seconds * 1000 + 200));
        video.play().catch(() => { /* the first frame simply moves into place */ });
      }
      const travel = Math.round(duration * 0.9);

      // The page below the top section comes in front of the shrinking photo (see intro.css).
      root.style.setProperty('--intro-body-fade', Math.round(duration * 0.5) + 'ms');
      root.classList.add('intro-leaving');

      // Photo: shrink from full screen into the real photo's exact place and size, while the
      // page photo's darkening and soft edges fade in over it.
      const to = realPhoto.getBoundingClientRect();
      const box = (rect) => ({ left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
      const fullScreen = { left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px' };
      // One continuous move that uses the whole time and glides softly into place (long ease-out).
      photo.animate([fullScreen, box(to)], { duration, easing: 'cubic-bezier(.5,0,.1,1)', fill: 'forwards' });
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
      // The page headline is first put in its final state (no fade-up offset), so the copy
      // aims at exactly the spot where the page headline will be.
      // (important: the site's fade-up transition is itself marked important)
      heading.style.setProperty('transition', 'none', 'important');
      heading.style.opacity = '0';
      heading.classList.add('shown');
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
      // Travels with a soft finish, then eases gently the last few pixels into place (no hard stop).
      title.animate([
        { transform: 'translate(0, 0) scale(1)', textShadow: '0 8px 40px rgba(0,0,0,.6)', easing: 'cubic-bezier(.55,0,.3,1)' },
        { transform: `translate(${dx}px, ${dy + 12}px) scale(${shrink})`, offset: 0.72, easing: 'cubic-bezier(.3,0,.15,1)' },
        { transform: `translate(${dx}px, ${dy}px) scale(${shrink})`, textShadow: '0 0 0 rgba(0,0,0,0)' }
      ], { duration: travel, easing: 'linear', fill: 'forwards' });

      const showHeading = () => {
        heading.style.opacity = '';
        title.style.visibility = 'hidden';
        setTimeout(() => { heading.style.removeProperty('transition'); }, 50);
      };
      realPhoto.style.animation = 'none';

      // The page around the photo shows through while it shrinks, but the menu, text and buttons
      // wait. Once the photo has settled (and a video has reached its last frame), the whole page
      // takes over in one single frame, so nothing is ever half covered. By then the intro photo
      // looks exactly like the page photo it lies on, so removing it changes nothing.
      const settled = new Promise((resolve) => setTimeout(resolve, duration));
      const ended = new Promise((resolve) => {
        if (!video || video.ended) { resolve(); return; }
        video.addEventListener('ended', resolve, { once: true });
        setTimeout(resolve, duration + 1500); // never wait forever on a slow connection
      });
      Promise.all([settled, ended]).then(() => {
        if (video) handOverFrame(video, realPhoto);
        realPhoto.style.transition = 'none';
        showHeading();
        finish();
        stage.remove();
      });
    }

    // Paint the video's last frame into the page photo, cropped exactly like the video was, so
    // the header shows the very same picture (the page's own photo stays underneath).
    function handOverFrame(source, target) {
      try {
        const rect = target.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.className = 'hero-frame';
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        const vw = source.videoWidth, vh = source.videoHeight;
        if (!vw || !vh || !canvas.width || !canvas.height) return;
        const scale = Math.max(canvas.width / vw, canvas.height / vh);
        const [px, py] = getComputedStyle(source).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
        const dw = vw * scale, dh = vh * scale;
        const context = canvas.getContext('2d');
        context.imageSmoothingQuality = 'high';
        context.drawImage(source, (canvas.width - dw) * (isNaN(px) ? 0.5 : px), (canvas.height - dh) * (isNaN(py) ? 0.5 : py), dw, dh);
        target.classList.add('has-frame');
        target.appendChild(canvas);
        // If the photo changes size (phone turned, window resized), the page's own photo,
        // which is the same picture, takes over again with its own crop.
        const drop = () => { canvas.remove(); target.classList.remove('has-frame'); };
        if (!('ResizeObserver' in window)) { window.addEventListener('resize', drop, { once: true }); return; }
        const watcher = new ResizeObserver(() => {
          const now = target.getBoundingClientRect();
          if (Math.abs(now.width - rect.width) > 1 || Math.abs(now.height - rect.height) > 1) {
            drop();
            watcher.disconnect();
          }
        });
        watcher.observe(target);
      } catch (error) { /* the page's own photo shows instead */ }
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
