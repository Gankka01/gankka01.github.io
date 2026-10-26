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
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motions = new WeakMap();

  function bounce(event) {
    const control = event.target.closest('[data-back-to-top]');
    if (!control || control.contains(event.relatedTarget) || event.pointerType === 'touch'
      || !finePointer.matches || reducedMotion.matches) return;
    const orb = control.querySelector('.back-to-top-orb');
    const shadow = control.querySelector('.back-to-top-shadow');
    if (!orb?.animate || !shadow) return;
    const entering = event.type === 'pointerover';
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

  document.addEventListener('pointerover', bounce);
  document.addEventListener('pointerout', bounce);
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
      document.documentElement.dataset.pageDirection = forward ? 'forward' : 'back';

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
      };

      if (differentPage && document.startViewTransition && !reducedMotion.matches) {
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
