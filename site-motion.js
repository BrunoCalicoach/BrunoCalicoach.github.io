// Subtle motion shared by every public page.
// - The top section's text fades up one line after another when the page opens.
// - Headings, cards, plan cards and form questions rise and fade in as they scroll into view.
// The page stays fully visible if this script doesn't run, and nothing moves for people
// who turned on "reduce motion" in their device settings.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('js');

  // Items the About page already animates itself are left alone.
  const skip = (element) => element.closest('.reveal, .timeline');

  // 1. Top section: its text block's lines, one after another.
  const hero = document.querySelector('.hero-bg, .hero');
  const heroItems = [];
  if (hero) {
    let block = hero.querySelector('nav ~ div');
    while (block && block.children.length === 1 && block.firstElementChild.tagName === 'DIV') {
      block = block.firstElementChild;
    }
    if (block) {
      Array.from(block.children).forEach((child, index) => {
        if (skip(child)) return;
        child.classList.add('motion');
        child.style.setProperty('--motion-delay', (0.1 + index * 0.12).toFixed(2) + 's');
        heroItems.push(child);
      });
    }
  }

  // 2. Everything else, revealed while scrolling.
  const selectors = [
    'main h2', 'section h2',
    '.card', '.plan-card', '.question',
    'section.section-spacing form',
    'footer .grid > *', 'footer .max-w-7xl > *'
  ];
  const items = Array.from(document.querySelectorAll(selectors.join(',')))
    .filter((element) => !skip(element) && !element.closest('.hero, .hero-bg') && !element.parentElement.closest('.motion'));

  items.forEach((element) => {
    element.classList.add('motion');
    // Cards that sit side by side come in one after another.
    const siblings = Array.from(element.parentElement.children).filter((child) => items.includes(child));
    const position = siblings.indexOf(element);
    if (siblings.length > 1 && position > 0) {
      element.style.setProperty('--motion-delay', Math.min(position * 0.1, 0.4).toFixed(2) + 's');
    }
  });

  // Once an item has faded in, drop its delay so hover effects react instantly.
  document.addEventListener('transitionend', (event) => {
    const element = event.target;
    if (event.propertyName === 'opacity' && element.classList && element.classList.contains('shown')) {
      element.style.setProperty('--motion-delay', '0s');
    }
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('shown');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  items.forEach((element) => observer.observe(element));

  // On the home page's first visit, the intro (intro.js) plays first and tells us when to
  // bring in the top section's text.
  const introPlaying = document.documentElement.classList.contains('intro');
  if (introPlaying) {
    document.addEventListener('intro:done', () => {
      heroItems.forEach((element) => element.classList.add('shown'));
    }, { once: true });
  }

  // Show the top section's text, and anything already on screen, right after opening.
  setTimeout(() => {
    if (!introPlaying) heroItems.forEach((element) => element.classList.add('shown'));
    items.forEach((element) => {
      if (element.getBoundingClientRect().top < window.innerHeight) element.classList.add('shown');
    });
  }, 80);
})();
