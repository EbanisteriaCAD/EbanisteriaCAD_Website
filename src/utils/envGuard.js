export const ENV = import.meta.env.VITE_ENV || 'development';
export const isProduction = ENV === 'production';

export function assertSafeWrite() {
  if (isProduction) {
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
