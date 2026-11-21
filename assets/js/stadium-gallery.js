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
  const scrollbar = gallery.querySelector('[data-gallery-scrollbar]');
  const status = gallery.querySelector('[data-gallery-status]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;

  function scrollBehavior() {
    return reducedMotion.matches ? 'auto' : 'smooth';
  }

  function centerThumbnail(behavior) {
    const thumbnail = thumbnails[current];
    const center = thumbnail.offsetLeft + thumbnail.offsetWidth / 2;
    const max = strip.scrollWidth - strip.clientWidth;
    const left = Math.max(0, Math.min(max, center - strip.clientWidth / 2));
    strip.scrollTo({ left, behavior });
  }

  function syncStripControls() {
    scrollLeft.disabled = strip.scrollLeft <= 1;
    scrollRight.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
    strip.toggleAttribute('data-at-start', scrollLeft.disabled);
    strip.toggleAttribute('data-at-end', scrollRight.disabled);
    scrollbar.value = Math.round(strip.scrollLeft);
  }

  function updateStripLayout() {
    const scrollWidth = strip.scrollWidth;
    const visibleWidth = strip.clientWidth;
    const max = scrollWidth - visibleWidth;
    scrollbar.max = max;
    scrollbar.hidden = max <= 1;
    if (!scrollbar.hidden) {
      scrollbar.style.setProperty('--stadium-scrollbar-thumb-width', `${100 * visibleWidth / scrollWidth}%`);
    }
    centerThumbnail('auto');
    syncStripControls();
  }

  function selectImage(index) {
    const thumbnail = thumbnails[index];
    if (!thumbnail) return;

    if (index !== current) {
      thumbnails[current].removeAttribute('aria-current');
      thumbnail.setAttribute('aria-current', 'true');
      preview.src = thumbnail.dataset.gallerySource;
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
    const end = thumbnails[Math.min(3, thumbnails.length - 1)];
    const distance = end.getBoundingClientRect().left - thumbnails[0].getBoundingClientRect().left;
    strip.scrollBy({ left: direction * distance, behavior: scrollBehavior() });
  }

  previous.addEventListener('click', () => selectImage(current - 1));
  next.addEventListener('click', () => selectImage(current + 1));
  scrollLeft.addEventListener('click', () => scrollThumbnails(-1));
  scrollRight.addEventListener('click', () => scrollThumbnails(1));
  scrollbar.addEventListener('input', () => {
    strip.scrollTo({ left: scrollbar.valueAsNumber, behavior: 'auto' });
  });
  strip.addEventListener('scroll', syncStripControls, { passive: true });
  thumbnails.forEach((thumbnail, index) => {
    thumbnail.addEventListener('click', () => selectImage(index));
  });

  scrollLeft.hidden = false;
  scrollRight.hidden = false;
  selectImage(0);
  updateStripLayout();
  new ResizeObserver(updateStripLayout).observe(strip);
})();
