const viteEnv = (typeof import.meta !== 'undefined' && import.meta && import.meta.env)
  ? import.meta.env
  : {};

function inferRuntimeEnv() {
  if (typeof window === 'undefined' || !window.location) {
    return 'development';
  }

  var host = String(window.location.hostname || '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'development';
  }

  return 'production';
}

export const ENV = viteEnv.VITE_ENV || inferRuntimeEnv();
export const isProduction = ENV === 'production';

export function assertSafeWrite(options = {}) {
  var requireConfirmation = !!options.requireConfirmation;

  if (isProduction) {
    if (!requireConfirmation) {
      return;
    }

    var confirmed = window.confirm(
      '⚠️ You are about to modify PRODUCTION data. Are you sure?'
    );

    if (!confirmed) {
      throw new Error('Write operation cancelled in production.');
    }
  }
}

export function mountEnvironmentBanner() {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }

  if (document.getElementById('envModeBanner')) {
    return;
  }

  var banner = document.createElement('div');
  banner.id = 'envModeBanner';
  banner.className = 'env-mode-banner ' + (isProduction ? 'is-production' : 'is-development');
  banner.textContent = isProduction ? 'PRODUCTION MODE' : 'DEV MODE';
  document.body.appendChild(banner);
}
