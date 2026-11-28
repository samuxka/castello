export function getAppUrl(): string {
  if (typeof window === 'undefined') return 'https://app.erpcastle.com';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return '/?app=true';
  }
  return 'https://app.erpcastle.com';
}

export function getLandingUrl(): string {
  if (typeof window === 'undefined') return 'https://erpcastle.com';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return '/';
  }
  return 'https://erpcastle.com';
}
