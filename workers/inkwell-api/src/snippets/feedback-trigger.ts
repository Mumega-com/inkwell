/**
 * Feedback auto-trigger snippet.
 *
 * Reads survey config from a JSON blob injected by the worker.
 * Triggers surveys based on rules: day-14, post-checkout, exit-intent.
 * Shows a minimal NPS modal. Submits to /api/feedback/respond.
 *
 * Deduplicates via localStorage — each survey fires once per visitor.
 */

interface SurveyConfig {
  id: string
  type: 'nps' | 'csat' | 'micro' | 'exit' | 'custom'
  title: string
  questions: Array<{
    id: string
    text: string
    type: 'nps' | 'rating' | 'choice' | 'text' | 'boolean'
    options?: string[]
    required: boolean
  }>
  trigger?: string
  targetPath?: string
  active: boolean
}

export function feedbackTriggerSnippet(surveys: SurveyConfig[]): string {
  if (!surveys || surveys.length === 0) return ''

  const activeSurveys = surveys.filter(s => s.active)
  if (activeSurveys.length === 0) return ''

  const surveysJson = JSON.stringify(activeSurveys)

  return `<script>
(function(){
  var surveys = ${surveysJson};
  var api = location.origin;

  function shown(id) { return localStorage.getItem('_ink_survey_' + id) === '1'; }
  function markShown(id) { localStorage.setItem('_ink_survey_' + id, '1'); }

  function matchPath(pattern, path) {
    if (!pattern) return true;
    if (pattern === path) return true;
    if (pattern.endsWith('*') && path.startsWith(pattern.slice(0, -1))) return true;
    return false;
  }

  function firstVisitDay() {
    var key = '_ink_first_visit';
    var d = localStorage.getItem(key);
    if (!d) { d = new Date().toISOString().slice(0,10); localStorage.setItem(key, d); }
    return d;
  }

  function daysSinceFirstVisit() {
    var first = new Date(firstVisitDay());
    return Math.floor((Date.now() - first.getTime()) / 86400000);
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k) {
      if (k === 'textContent') e.textContent = attrs[k];
      else if (k === 'onclick') e.addEventListener('click', attrs[k]);
      else e.style[k] = attrs[k];
    });
    if (children) children.forEach(function(c) { if (c) e.appendChild(c); });
    return e;
  }

  function showNps(survey) {
    if (shown(survey.id)) return;
    var q = (survey.questions && survey.questions[0]) ? survey.questions[0].text : 'How likely are you to recommend us?';
    var selectedScore = null;

    var overlay = el('div', {position:'fixed',bottom:'24px',right:'24px',zIndex:'99999',background:'#151519',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'20px',maxWidth:'340px',fontFamily:'system-ui',color:'#EDEDF0',boxShadow:'0 10px 15px rgba(0,0,0,0.3)'});
    overlay.id = '_ink_nps';

    // Header
    var header = el('div', {display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:'12px'});
    header.appendChild(el('span', {fontSize:'13px',fontWeight:'600',textContent:survey.title}));
    var closeBtn = el('button', {background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:'18px',padding:'0',lineHeight:'1',textContent:String.fromCharCode(215)});
    closeBtn.addEventListener('click', function() { overlay.remove(); });
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    // Question
    overlay.appendChild(el('p', {fontSize:'12px',color:'rgba(255,255,255,0.7)',margin:'0 0 12px',textContent:q}));

    // Score buttons
    var scoreRow = el('div', {display:'flex',gap:'4px',flexWrap:'wrap'});
    var buttons = [];
    for (var i = 0; i <= 10; i++) {
      (function(score) {
        var btn = el('button', {width:'28px',height:'28px',borderRadius:'4px',border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'#EDEDF0',cursor:'pointer',fontSize:'11px',transition:'background 0.15s',textContent:String(score)});
        btn.addEventListener('click', function() {
          selectedScore = score;
          buttons.forEach(function(b) { b.style.background = 'transparent'; b.style.borderColor = 'rgba(255,255,255,0.15)'; });
          btn.style.background = 'rgba(6,182,212,0.4)';
          btn.style.borderColor = '#06B6D4';
          reason.style.display = 'block';
          submit.style.display = 'block';
        });
        buttons.push(btn);
        scoreRow.appendChild(btn);
      })(i);
    }
    overlay.appendChild(scoreRow);

    // Reason textarea
    var reason = el('textarea', {width:'100%',marginTop:'10px',padding:'8px',borderRadius:'4px',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.05)',color:'#EDEDF0',fontSize:'12px',resize:'none',display:'none',height:'60px',boxSizing:'border-box'});
    reason.placeholder = 'Tell us more (optional)';
    overlay.appendChild(reason);

    // Submit button
    var submit = el('button', {display:'none',width:'100%',marginTop:'8px',padding:'8px',borderRadius:'4px',border:'none',background:'#06B6D4',color:'#fff',cursor:'pointer',fontSize:'12px',fontWeight:'600',textContent:'Submit'});
    submit.addEventListener('click', function() {
      var body = { survey_id: survey.id, answers: [{ question_id: survey.questions[0].id, value: selectedScore }] };
      if (reason.value) body.answers.push({ question_id: 'reason', value: reason.value });
      try { navigator.sendBeacon(api + '/api/feedback/respond', JSON.stringify(body)); } catch(e) {}
      markShown(survey.id);
      while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
      overlay.appendChild(el('p', {fontSize:'13px',textAlign:'center',padding:'12px',margin:'0',textContent:'Thank you for your feedback!'}));
      setTimeout(function() { overlay.remove(); }, 2000);
    });
    overlay.appendChild(submit);

    document.body.appendChild(overlay);
  }

  // Evaluate triggers
  surveys.forEach(function(s) {
    if (shown(s.id)) return;
    if (!matchPath(s.targetPath, location.pathname)) return;

    var trigger = s.trigger || 'manual';
    if (trigger === 'manual') return;

    if (trigger.startsWith('day-')) {
      var targetDay = parseInt(trigger.split('-')[1]);
      if (daysSinceFirstVisit() >= targetDay) {
        setTimeout(function() { showNps(s); }, 3000);
      }
      return;
    }

    if (trigger === 'post-checkout') {
      if (location.pathname.includes('thank') || location.pathname.includes('success') || location.pathname.includes('confirmation')) {
        setTimeout(function() { showNps(s); }, 2000);
      }
      return;
    }

    if (trigger === 'exit') {
      document.addEventListener('mouseleave', function handler(e) {
        if (e.clientY < 10) {
          document.removeEventListener('mouseleave', handler);
          showNps(s);
        }
      });
      return;
    }
  });
})();
<\\/script>`;
}
