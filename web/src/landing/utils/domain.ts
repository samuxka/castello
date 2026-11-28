export function getAppUrl(): string {
  if (typeof window === 'undefined') return 'https://app.erpcastle.com';
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) {
    return '/?app=true';
  }
  if (host === 'erpcastle.com' || host === 'www.erpcastle.com') {
    return 'https://app.erpcastle.com';
  }
  return '/?app=true';
}

export function navigateToCastelloApp(e?: React.MouseEvent): void {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) {
    if (e) e.preventDefault();
    window.history.pushState({}, '', '/?app=true');
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
