(() => {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    let theme = null;
    try {
      theme = localStorage.getItem('theme');
    } catch {}
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark' || (theme !== 'light' && mq.matches),
    );
  };
  apply();
  mq.addEventListener('change', apply);
})();
