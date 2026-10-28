(() => {
  let theme = 'auto';
  try {
    theme = localStorage.getItem('theme') || 'auto';
  } catch {}
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
})();
