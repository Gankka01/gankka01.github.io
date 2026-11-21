'use strict';

(() => {
  const gallery = document.querySelector('[data-stadium-gallery]');
  if (!gallery) return;

  const preview = gallery.querySelector('#stadium-gallery-preview');
  const strip = gallery.querySelector('#stadium-gallery-thumbnails');
  const thumbnails = [...strip.querySelectorAll('.stadium-gallery-thumbnail')];
  const previous = gallery.querySelector('[data-gallery-previous]');
  const next = gallery.querySelector('[data-gallery-next]');
  const scrollLeft = gallery.querySelector('[data-gallery-scroll-left]');
  const scrollRight = gallery.querySelector('[data-gallery-scroll-right]');
  const status = gallery.querySelector('[data-gallery-status]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;

  function scrollBehavior() {
    return reducedMotion.matches ? 'auto' : 'smooth';
  }

  function centerThumbnail(behavior) {
    const thumbnail = thumbnails[current];
    const center = thumbnail.offsetLeft + thumbnail.offsetWidth / 2;
    strip.scrollTo({ left: center - strip.clientWidth / 2, behavior });
  }

  function updateStripArrows() {
    scrollLeft.disabled = strip.scrollLeft <= 1;
    scrollRight.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
  }

  function selectImage(index) {
    const thumbnail = thumbnails[index];
    if (!thumbnail) return;

    if (index !== current) {
      thumbnails[current].removeAttribute('aria-current');
      thumbnail.setAttribute('aria-current', 'true');
      preview.src = thumbnail.querySelector('img').src;
      preview.alt = thumbnail.dataset.galleryAlt;
      status.textContent = `Image ${index + 1} of ${thumbnails.length}. ${preview.alt}`;
      current = index;
    }

    previous.hidden = current === 0;
    next.hidden = current === thumbnails.length - 1;
    if (previous.hidden && document.activeElement === previous) next.focus({ preventScroll: true });
    if (next.hidden && document.activeElement === next) previous.focus({ preventScroll: true });
    centerThumbnail(scrollBehavior());
  }

  function scrollThumbnails(direction) {
    strip.scrollBy({ left: direction * strip.clientWidth * .7, behavior: scrollBehavior() });
  }

  previous.addEventListener('click', () => selectImage(current - 1));
  next.addEventListener('click', () => selectImage(current + 1));
  scrollLeft.addEventListener('click', () => scrollThumbnails(-1));
  scrollRight.addEventListener('click', () => scrollThumbnails(1));
  strip.addEventListener('scroll', updateStripArrows, { passive: true });
  thumbnails.forEach((thumbnail, index) => {
    thumbnail.addEventListener('click', () => selectImage(index));
  });

  scrollLeft.hidden = false;
  scrollRight.hidden = false;
  selectImage(0);
  updateStripArrows();
  new ResizeObserver(() => {
    centerThumbnail('auto');
    updateStripArrows();
  }).observe(strip);
})();
