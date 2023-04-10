if(!window.location.host.includes('localhost') && !window.location.host.includes('127.0.0.1')) {
  const s = document.createElement('script');
  // eslint-disable-next-line no-undef
  s.src = chrome.runtime.getURL('scripts/bundle.js');
  document.head.appendChild(s);
}
