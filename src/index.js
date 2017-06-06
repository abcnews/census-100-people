const rootEl = document.querySelector('[data-census-100-people-root]');
const appEl = document.createElement('div');

appEl.className = 'census-100-people';
appEl.innerHTML = '<pre>census-100-people OK!</pre>';
rootEl.appendChild(appEl);
