/**
 * Content recommendations snippet.
 *
 * Injected into content pages. Finds an element with id="inkwell-recommendations"
 * or auto-appends after <article>. Fetches recommendations from the API
 * and renders a "Related Articles" section using safe DOM methods.
 */

export function recommendationsSnippet(): string {
  return `<script>
(function(){
  var api = location.origin;
  var path = location.pathname.replace(/^\\//, '').replace(/\\/$/, '').replace(/\\.html$/, '');
  var slug = path.split('/').pop();
  if (!slug || slug === 'index') return;

  // Only run on content pages (skip dashboard, api, static assets)
  if (path.startsWith('dashboard') || path.startsWith('api/')) return;

  function el(tag, styles, text) {
    var e = document.createElement(tag);
    if (styles) Object.keys(styles).forEach(function(k) { e.style[k] = styles[k]; });
    if (text) e.textContent = text;
    return e;
  }

  function render(items) {
    if (!items || items.length === 0) return;

    var container = document.getElementById('inkwell-recommendations');
    if (!container) {
      var article = document.querySelector('article');
      if (!article) return;
      container = document.createElement('section');
      container.id = 'inkwell-recommendations';
      article.parentNode.insertBefore(container, article.nextSibling);
    }

    var wrapper = el('div', {marginTop:'2.5rem',paddingTop:'1.5rem',borderTop:'1px solid var(--ink-border,rgba(255,255,255,0.1))'});
    wrapper.appendChild(el('h3', {fontSize:'1rem',fontWeight:'600',color:'var(--ink-text,#EDEDF0)',margin:'0 0 1rem'}, 'Related Articles'));

    var grid = el('div', {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'1rem'});

    items.forEach(function(item) {
      var a = document.createElement('a');
      a.href = '/' + item.slug;
      a.style.cssText = 'display:block;padding:1rem;background:var(--ink-surface,#151519);border:1px solid var(--ink-border,rgba(255,255,255,0.1));border-radius:6px;text-decoration:none;transition:border-color 0.15s';
      a.addEventListener('mouseover', function() { a.style.borderColor = 'var(--ink-primary,#D4A017)'; });
      a.addEventListener('mouseout', function() { a.style.borderColor = 'var(--ink-border,rgba(255,255,255,0.1))'; });

      a.appendChild(el('div', {fontSize:'0.85rem',fontWeight:'600',color:'var(--ink-text,#EDEDF0)',marginBottom:'0.3rem'}, item.title || item.slug));

      if (item.description) {
        var desc = item.description.length > 100 ? item.description.slice(0, 100) + '...' : item.description;
        a.appendChild(el('div', {fontSize:'0.75rem',color:'var(--ink-muted,rgba(255,255,255,0.55))',lineHeight:'1.4'}, desc));
      }

      if (item.score !== undefined) {
        a.appendChild(el('div', {fontSize:'0.65rem',color:'var(--ink-dim,rgba(255,255,255,0.35))',marginTop:'0.4rem'}, Math.round(item.score * 100) + '% relevant'));
      }

      grid.appendChild(a);
    });

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
  }

  // Fetch recommendations
  fetch(api + '/api/analytics/recommendations/' + encodeURIComponent(slug))
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data && data.recommendations) render(data.recommendations);
    })
    .catch(function() {});
})();
<\\/script>`;
}
