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

document.querySelectorAll('[data-copy-email]').forEach((button) => {
  button.addEventListener('click', async () => {
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
});
