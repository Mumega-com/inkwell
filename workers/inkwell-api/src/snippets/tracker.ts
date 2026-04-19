/**
 * Client-side analytics tracker snippet.
 *
 * Injected into every tenant HTML page before </body>.
 * Auto-fires "Page Viewed" on load. Exposes window.inkwell.track()
 * for custom events. Captures UTM params and referrer.
 *
 * ~1.2 KB minified. Zero dependencies. No cookies.
 */

export function trackerSnippet(): string {
  return `<script>
(function(){
  var api = '';
  try { api = location.origin; } catch(e) {}

  var utm = {};
  try {
    var p = new URLSearchParams(location.search);
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){
      if (p.get(k)) utm[k.replace('utm_','')] = p.get(k);
    });
    if (p.get('gclid')) { utm.clickId = p.get('gclid'); utm.clickSource = 'google'; }
    if (p.get('fbclid')) { utm.clickId = p.get('fbclid'); utm.clickSource = 'meta'; }
  } catch(e) {}

  function track(name, props) {
    var body = {
      event_name: name,
      properties: Object.assign({}, props || {}, {
        path: location.pathname,
        referrer: document.referrer || null,
        title: document.title || null,
        screen: screen.width + 'x' + screen.height
      }),
      session_id: sessionId()
    };
    if (Object.keys(utm).length) body.utm = utm;
    try {
      navigator.sendBeacon(
        api + '/api/analytics/event',
        JSON.stringify(body)
      );
    } catch(e) {
      // Fallback for browsers without sendBeacon
      try {
        var x = new XMLHttpRequest();
        x.open('POST', api + '/api/analytics/event');
        x.setRequestHeader('Content-Type', 'application/json');
        x.send(JSON.stringify(body));
      } catch(e2) {}
    }
  }

  function sessionId() {
    var key = '_ink_sid';
    var sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, sid);
    }
    return sid;
  }

  // Expose globally
  window.inkwell = window.inkwell || {};
  window.inkwell.track = track;

  // Auto-track page view
  if (document.readyState === 'complete') {
    track('Page Viewed');
  } else {
    window.addEventListener('load', function() { track('Page Viewed'); });
  }
})();
<\\/script>`;
}
