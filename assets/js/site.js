'use strict';

const copyStatus = document.getElementById('email-copy-status');
let statusTimeout;

function showCopyStatus(message, failed = false) {
  if (!copyStatus) return;
  clearTimeout(statusTimeout);
  copyStatus.textContent = message;
  copyStatus.hidden = false;
  if (!failed) {
    statusTimeout = setTimeout(() => { copyStatus.hidden = true; }, 3500);
  }
}

function copyWithSelection(value) {
  const previousFocus = document.activeElement;
  const field = document.createElement('textarea');
  field.value = value;
  field.readOnly = true;
  field.style.position = 'fixed';
  field.style.left = '-9999px';
  document.body.append(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    field.remove();
    previousFocus?.focus({ preventScroll: true });
  }
  if (!copied) throw new Error('Clipboard unavailable');
}

// Delegation keeps both the persistent footer and newly inserted content working.
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy-email]');
  if (!button) return;
  const email = button.dataset.copyEmail;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(email);
      } catch {
        copyWithSelection(email);
      }
    } else {
      copyWithSelection(email);
    }
    showCopyStatus('Email address copied.');
  } catch {
    showCopyStatus(`Copy unavailable. Email: ${email}`, true);
  }
});

// A delegated handler survives Home/CV swaps without adding history entries.
document.addEventListener('click', (event) => {
  const control = event.target.closest('[data-back-to-top]');
  if (!control || event.defaultPrevented || event.button !== 0 || event.metaKey
    || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  document.querySelector('[data-site-navigation] a[aria-current="page"]')
    ?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, left: 0,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});

// Bounce once on entry and once on exit; the hit area and ground shadow stay put.
(() => {
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const touchLayout = matchMedia('(hover: none) and (pointer: coarse)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motions = new WeakMap();
  let bottomControl;
  let bottomFrame;

  function bounce(control, entering) {
    if (reducedMotion.matches) return;
    const orb = control.querySelector('.back-to-top-orb');
    const shadow = control.querySelector('.back-to-top-shadow');
    if (!orb?.animate || !shadow) return;
    const parts = [
      [orb, [
        { offset: .18, transform: `translateY(1px) scale(${entering ? '1.08, .94' : '1.03, .94'})` },
        { offset: .48, transform: `translateY(${entering ? '-5px' : '-4px'}) scale(1.04, 1.09)` },
        { offset: .78, transform: 'translateY(.5px) scale(1.08, .98)' },
        { offset: 1, transform: entering ? 'translateY(-1px) scale(1.06)' : 'translateY(0) scale(1)' }
      ]],
      [shadow, [
        { offset: .18, transform: 'scale(1.08)', opacity: .85 },
        { offset: .48, transform: 'scale(.78)', opacity: .42 },
        { offset: .78, transform: 'scale(1.06)', opacity: .85 },
        { offset: 1, transform: entering ? 'scale(1.03)' : 'scale(1)', opacity: entering ? .85 : .75 }
      ]]
    ];
    for (const [element, frames] of parts) {
      // Rapid pointer changes continue from the current pose instead of snapping.
      const style = getComputedStyle(element);
      const start = { offset: 0, transform: style.transform, opacity: style.opacity };
      motions.get(element)?.cancel();
      motions.set(element, element.animate([start, ...frames], {
        duration: entering ? 460 : 420,
        easing: 'cubic-bezier(.22, .61, .36, 1)',
        iterations: 1
      }));
    }
  }

  function pointerBounce(event) {
    const control = event.target.closest('[data-back-to-top]');
    if (!control || control.contains(event.relatedTarget) || event.pointerType === 'touch'
      || !finePointer.matches) return;
    bounce(control, event.type === 'pointerover');
  }

  function updateBottom() {
    bottomFrame = null;
    const control = document.querySelector('[data-back-to-top]');
    if (bottomControl !== control) {
      bottomControl?.classList.remove('is-bottom-active');
      bottomControl = control;
    }
    if (!control) return;
    const wasAtBottom = control.classList.contains('is-bottom-active');
    const remaining = document.documentElement.scrollHeight - innerHeight - scrollY;
    // A small exit margin avoids retriggering on mobile browser chrome changes.
    const atBottom = touchLayout.matches && document.documentElement.scrollHeight > innerHeight + 2
      && remaining <= (wasAtBottom ? 80 : 24);
    control.classList.toggle('is-bottom-active', atBottom);
    if (atBottom && !wasAtBottom) bounce(control, true);
  }

  function scheduleBottom() {
    if (!bottomFrame) bottomFrame = requestAnimationFrame(updateBottom);
  }

  document.addEventListener('pointerover', pointerBounce);
  document.addEventListener('pointerout', pointerBounce);
  document.addEventListener('site:pagechange', scheduleBottom);
  addEventListener('scroll', scheduleBottom, { passive: true });
  addEventListener('resize', scheduleBottom);
  addEventListener('pageshow', scheduleBottom);
  touchLayout.addEventListener('change', scheduleBottom);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleBottom).observe(document.body);
  scheduleBottom();
})();

// Touch feedback never captures scrolling; each paper gets one quiet entrance glow.
(() => {
  const touchLayout = matchMedia('(hover: none) and (pointer: coarse)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const selector = '.publication-image, .profile-portrait';
  const timers = new Map();
  const revealedImages = new Set();
  let gesture;
  let observer;

  function clearFeedback() {
    gesture = null;
    for (const [element, timer] of timers) {
      clearTimeout(timer);
      element.classList.remove('is-touch-active');
    }
    timers.clear();
    document.querySelectorAll('.is-scroll-glowing')
      .forEach((element) => element.classList.remove('is-scroll-glowing'));
  }

  function observeImages() {
    observer?.disconnect();
    clearFeedback();
    if (!touchLayout.matches || reducedMotion.matches || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < .25) continue;
        const element = entry.target;
        const key = element.querySelector('img')?.getAttribute('src');
        observer.unobserve(element);
        if (revealedImages.has(key)) continue;
        revealedImages.add(key);
        if (!element.classList.contains('is-touch-active')) element.classList.add('is-scroll-glowing');
      }
    }, { threshold: .25 });
    document.querySelectorAll('.publication-image').forEach((element) => {
      if (!revealedImages.has(element.querySelector('img')?.getAttribute('src'))) observer.observe(element);
    });
  }

  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    gesture = null;
    if (!event.isPrimary || reducedMotion.matches) return;
    const element = event.target.closest(selector);
    if (element) gesture = { element, id: event.pointerId, x: event.clientX, y: event.clientY,
      started: event.timeStamp };
  }, { passive: true });
  document.addEventListener('pointermove', (event) => {
    if (gesture?.id === event.pointerId
      && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) gesture = null;
  }, { passive: true });
  document.addEventListener('pointercancel', () => { gesture = null; }, { passive: true });
  document.addEventListener('pointerup', (event) => {
    if (gesture?.id !== event.pointerId) return;
    const tap = gesture;
    gesture = null;
    if (!tap.element.isConnected || reducedMotion.matches || event.timeStamp - tap.started > 650
      || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10) return;
    const element = tap.element;
    element.classList.remove('is-scroll-glowing');
    element.classList.add('is-touch-active');
    clearTimeout(timers.get(element));
    // Keep the paper's hover state for 0.5 s, then let CSS ease it back to rest.
    timers.set(element, setTimeout(() => {
      element.classList.remove('is-touch-active');
      timers.delete(element);
    }, element.matches('.publication-image') ? 500 : 650));
  }, { passive: true });
  document.addEventListener('animationend', (event) => {
    if (event.animationName === 'publication-border-glimpse') event.target.classList.remove('is-scroll-glowing');
  });
  document.addEventListener('site:pagechange', observeImages);
  touchLayout.addEventListener('change', observeImages);
  reducedMotion.addEventListener('change', observeImages);
  addEventListener('pagehide', clearFeedback);
  addEventListener('pageshow', (event) => { if (event.persisted) observeImages(); });
  observeImages();
})();

// A shared email bubble, independent of the button's hover transform.
(() => {
  const selector = '[data-copy-email]';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const tooltip = document.createElement('div');
  const surface = document.createElement('span');
  tooltip.id = 'email-address-tooltip';
  tooltip.className = 'email-tooltip no-print';
  tooltip.setAttribute('role', 'tooltip');
  surface.className = 'email-tooltip-surface';
  tooltip.append(surface);
  tooltip.hidden = true;
  document.body.append(tooltip);
  let active;
  let positionFrame;
  let motion;

  function removeDescription() {
    if (active) {
      const descriptions = (active.getAttribute('aria-describedby') || '')
        .split(/\s+/).filter((id) => id && id !== tooltip.id);
      if (descriptions.length) active.setAttribute('aria-describedby', descriptions.join(' '));
      else active.removeAttribute('aria-describedby');
    }
  }

  function reset() {
    cancelAnimationFrame(positionFrame);
    motion?.cancel();
    motion = null;
    removeDescription();
    active = null;
    tooltip.hidden = true;
    tooltip.dataset.state = 'closed';
    tooltip.setAttribute('aria-hidden', 'true');
  }

  function pose() {
    const style = getComputedStyle(surface);
    return { offset: 0, transform: style.transform, opacity: style.opacity };
  }

  function animate(frames, duration, finished, easing = 'ease-in-out') {
    motion?.cancel();
    motion = null;
    if (reducedMotion.matches || !surface.animate) return finished?.();
    const animation = surface.animate(frames, { duration, easing, iterations: 1 });
    motion = animation;
    animation.onfinish = () => {
      if (motion !== animation) return;
      motion = null;
      animation.cancel();
      finished?.();
    };
  }

  function hide(immediate = false) {
    cancelAnimationFrame(positionFrame);
    if (tooltip.hidden) return;
    if (immediate || reducedMotion.matches || !surface.animate) return reset();
    if (tooltip.dataset.state === 'closing') return;
    removeDescription();
    tooltip.dataset.state = 'closing';
    tooltip.setAttribute('aria-hidden', 'true');
    animate([
      pose(),
      { offset: .36, transform: 'translateY(-5px) scale(1.025)', opacity: 1 },
      { offset: 1, transform: 'translateY(8px) scale(.9)', opacity: 0 }
    ], 210, reset, 'ease-out');
  }

  function position() {
    if (!active?.isConnected) return reset();
    const rect = active.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return reset();
    const edge = 12;
    const gap = 14;
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const center = rect.left + rect.width / 2;
    // The center stays still while the button scales; use its layout height.
    const middle = rect.top + rect.height / 2;
    const top = middle - active.offsetHeight / 2;
    const bottom = middle + active.offsetHeight / 2;
    const left = Math.max(edge, Math.min(center - width / 2, innerWidth - width - edge));
    const above = top - height - gap >= edge;
    tooltip.dataset.placement = above ? 'top' : 'bottom';
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${above ? top - height - gap : bottom + gap}px`;
    tooltip.style.setProperty('--tooltip-arrow-x', `${Math.max(14, Math.min(center - left, width - 14))}px`);
    // Keep the path from the button to the bubble hoverable without a hide delay.
    tooltip.style.setProperty('--tooltip-bridge-height', `${gap + 1}px`);
    tooltip.style.setProperty('--tooltip-trigger-width', `${active.offsetWidth + 8}px`);
  }

  function schedulePosition() {
    if (!active) return;
    cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(position);
  }

  function show(control, clicked = false) {
    const text = control.dataset.copyEmail.trim();
    if (!text) return;
    if (active === control && tooltip.dataset.state !== 'closing' && !clicked) return;
    const start = active === control && !tooltip.hidden
      ? pose() : { offset: 0, transform: 'translateY(8px) scale(.9)', opacity: 0 };
    if (active !== control) reset();
    active = control;
    surface.textContent = text;
    const descriptions = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    control.setAttribute('aria-describedby', [...new Set([...descriptions, tooltip.id])].join(' '));
    tooltip.hidden = false;
    tooltip.dataset.state = 'open';
    tooltip.removeAttribute('aria-hidden');
    position();
    if (tooltip.hidden) return;
    // A click gets its own hop without dismissing or rebuilding the visible bubble.
    if (clicked) {
      animate([
        start,
        { offset: .18, transform: 'translateY(1px) scale(1.02, .97)', opacity: 1 },
        { offset: .5, transform: 'translateY(-7px) scale(1.025)', opacity: 1 },
        { offset: .8, transform: 'translateY(1px) scale(.995)', opacity: 1 },
        { offset: 1, transform: 'translateY(0) scale(1)', opacity: 1 }
      ], 300);
      return;
    }
    // A quick, single hop on entry and exit (230/210 ms).
    animate([
      start,
      { offset: .5, transform: 'translateY(-5px) scale(1.025)', opacity: 1 },
      { offset: .78, transform: 'translateY(1px) scale(.995)', opacity: 1 },
      { offset: 1, transform: 'translateY(0) scale(1)', opacity: 1 }
    ], 230);
  }

  function containsTarget(target) {
    return target instanceof Node && (active?.contains(target) || tooltip.contains(target));
  }

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    if (tooltip.contains(event.target)) return;
    const control = event.target.closest(selector);
    if (control && !control.contains(event.relatedTarget)) show(control);
  });
  document.addEventListener('pointerout', (event) => {
    // Ignore moves within the button, bubble, and their invisible connecting area.
    if (!containsTarget(event.target) || containsTarget(event.relatedTarget)) return;
    if (active === document.activeElement && active?.matches(':focus-visible')) return;
    hide();
  });
  document.addEventListener('focusin', (event) => {
    const control = event.target.closest(selector);
    if (control?.matches(':focus-visible')) show(control);
  });
  document.addEventListener('focusout', (event) => {
    if (active === event.target && !active.matches(':hover') && !tooltip.matches(':hover')) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide(true);
  });
  document.addEventListener('click', (event) => {
    const control = event.target.closest(selector);
    if (control) {
      show(control, true);
      return;
    }
    if (!tooltip.contains(event.target)) hide(true);
  });
  addEventListener('scroll', schedulePosition, { passive: true });
  addEventListener('resize', schedulePosition);
  addEventListener('popstate', reset);
  addEventListener('blur', reset);
  document.addEventListener('site:pagechange', reset);
})();

// The static HTML routes remain available for direct visits and without JS.
(() => {
  const nav = document.querySelector('[data-site-navigation]');
  if (!nav || !window.fetch || !history.pushState) return;

  const links = [...nav.querySelectorAll('a[href]')];
  const normalizePath = (path) => path.replace(/\/?$/, '/');
  const routes = new Map(links.map((link, index) => [normalizePath(new URL(link.href).pathname), index]));
  const routeFor = (url) => url.origin === location.origin && !url.search && !url.hash
    ? routes.get(normalizePath(url.pathname)) : undefined;
  const metadata = ['meta[name="description"]', 'link[rel="canonical"]',
    'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:url"]'];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const cache = new Map();
  let displayedURL = new URL(location.href);
  if (!routes.has(normalizePath(displayedURL.pathname))) return;
  let sequence = 0;
  let requestNumber = 0;
  let controller;
  let transition;
  let restoring = false;
  let scrollFrame;
  const newEntry = () => ({ key: `${Date.now()}-${++sequence}`, x: 0, y: 0 });
  const initialEntry = history.state?.siteNavigation || { ...newEntry(), x: scrollX, y: scrollY };
  let displayedKey = initialEntry.key;
  history.replaceState({ ...history.state, siteNavigation: initialEntry }, '', location.href);
  history.scrollRestoration = 'manual';

  function rememberPosition() {
    const entry = history.state?.siteNavigation;
    // A popstate changes the history entry before the old DOM is replaced.
    if (restoring || entry?.key !== displayedKey) return;
    history.replaceState({ ...history.state,
      siteNavigation: { ...entry, x: scrollX, y: scrollY } }, '', location.href);
  }

  function snapshot(doc) {
    const main = doc.querySelector('main#main-content');
    if (!main || !doc.querySelector('[data-site-navigation]')) throw new Error('Unexpected page');
    return { main: main.cloneNode(true), title: doc.title, bodyClass: doc.body.className,
      metadata: metadata.map((selector) => doc.head.querySelector(selector)?.cloneNode(true)) };
  }

  cache.set(normalizePath(displayedURL.pathname), snapshot(document));

  async function loadPage(url, signal) {
    const path = normalizePath(url.pathname);
    if (cache.has(path)) return cache.get(path);
    const response = await fetch(url.href, { signal, credentials: 'same-origin', cache: 'no-cache' });
    if (!response.ok || routeFor(new URL(response.url)) !== routeFor(url)) throw new Error('Page unavailable');
    const page = snapshot(new DOMParser().parseFromString(await response.text(), 'text/html'));
    cache.set(path, page);
    return page;
  }

  function cancelPendingNavigation() {
    ++requestNumber;
    controller?.abort();
    transition?.skipTransition();
    transition = null;
    restoring = false;
    document.querySelector('main')?.removeAttribute('aria-busy');
    delete document.documentElement.dataset.pageDirection;
  }

  async function navigate(url, traversalEntry = null) {
    const ticket = ++requestNumber;
    controller?.abort();
    transition?.skipTransition();
    controller = new AbortController();
    if (!traversalEntry) rememberPosition();
    document.querySelector('main').setAttribute('aria-busy', 'true');
    try {
      const page = await loadPage(url, controller.signal);
      if (ticket !== requestNumber) return;
      const differentPage = normalizePath(url.pathname) !== normalizePath(displayedURL.pathname);
      const forward = routes.get(normalizePath(url.pathname)) > routes.get(normalizePath(displayedURL.pathname));

      const swap = () => {
        if (ticket !== requestNumber) return;
        if (!traversalEntry) rememberPosition();
        restoring = true;
        const entry = traversalEntry || newEntry();
        if (!traversalEntry) {
          history.pushState({ siteNavigation: entry }, '', url.href);
        }
        const main = page.main.cloneNode(true);
        main.removeAttribute('aria-busy');
        document.querySelector('main#main-content').replaceWith(main);
        document.body.className = page.bodyClass;
        document.title = page.title;
        metadata.forEach((selector, index) => {
          const old = document.head.querySelector(selector);
          const next = page.metadata[index]?.cloneNode(true);
          if (old && next) old.replaceWith(next);
          else if (next) document.head.append(next);
          else old?.remove();
        });
        links.forEach((link) => {
          const current = normalizePath(new URL(link.href).pathname) === normalizePath(url.pathname);
          link.classList.toggle('font-semibold', current);
          if (current) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        });
        clearTimeout(statusTimeout);
        if (copyStatus) copyStatus.hidden = true;
        displayedURL = url;
        displayedKey = entry.key;
        main.focus({ preventScroll: true });
        window.scrollTo({ left: entry.x, top: entry.y, behavior: 'instant' });
        restoring = false;
        rememberPosition();
        document.dispatchEvent(new Event('site:pagechange'));
      };

      if (differentPage && document.startViewTransition && !reducedMotion.matches) {
        document.documentElement.dataset.pageDirection = forward ? 'forward' : 'back';
        transition = document.startViewTransition(swap);
        await transition.updateCallbackDone;
        await transition.finished.catch(() => {});
      } else {
        swap();
      }
    } catch (error) {
      if (ticket !== requestNumber || error.name === 'AbortError') return;
      // A failed enhancement must never strand the visitor on the wrong URL.
      if (traversalEntry) location.reload();
      else location.assign(url.href);
    } finally {
      if (ticket === requestNumber) {
        document.querySelector('main')?.removeAttribute('aria-busy');
        delete document.documentElement.dataset.pageDirection;
        transition = null;
        restoring = false;
      }
    }
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey || link.hasAttribute('download')
      || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href);
    if (routeFor(url) === undefined) return;
    event.preventDefault();
    if (normalizePath(url.pathname) === normalizePath(displayedURL.pathname)
      && normalizePath(url.pathname) === normalizePath(location.pathname) && !location.hash) {
      // Cancel a pending request if the user chooses the still-visible page.
      cancelPendingNavigation();
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      rememberPosition();
      return;
    }
    void navigate(url);
  });

  addEventListener('popstate', (event) => {
    const url = new URL(location.href);
    // Keep native in-page anchors (including the skip link) within this document.
    if (url.pathname === displayedURL.pathname && (url.hash || displayedURL.hash)) {
      cancelPendingNavigation();
      const entry = event.state?.siteNavigation || { ...newEntry(), x: scrollX, y: scrollY };
      displayedKey = entry.key;
      displayedURL = url;
      history.replaceState({ ...event.state, siteNavigation: entry }, '', url.href);
      const ticket = requestNumber;
      requestAnimationFrame(() => {
        if (ticket !== requestNumber || displayedKey !== entry.key) return;
        if (!url.hash) window.scrollTo({ left: entry.x, top: entry.y, behavior: 'instant' });
        rememberPosition();
      });
      return;
    }
    if (routeFor(url) === undefined || !event.state?.siteNavigation) {
      location.reload();
      return;
    }
    cancelAnimationFrame(scrollFrame);
    void navigate(url, event.state.siteNavigation);
  });
  addEventListener('scroll', () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(rememberPosition);
  }, { passive: true });
  addEventListener('pagehide', rememberPosition);

  if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
    requestAnimationFrame(() => {
      if (requestNumber === 0 && displayedKey === initialEntry.key) {
        window.scrollTo({ left: initialEntry.x, top: initialEntry.y, behavior: 'instant' });
      }
    });
  }
  // Warm the other small HTML page; failed prefetches leave ordinary navigation intact.
  const prefetch = () => links.forEach((link) => { void loadPage(new URL(link.href)).catch(() => {}); });
  if ('requestIdleCallback' in window) requestIdleCallback(prefetch, { timeout: 1500 });
  else setTimeout(prefetch, 500);
})();
