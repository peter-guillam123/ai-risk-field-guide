/* AI risk field guide - page engine.
   Vanilla JS, no dependencies. All content lives in js/data.js (window.GUIDE). */
(function () {
  'use strict';

  var G = window.GUIDE || {};
  var doc = document;
  var root = doc.documentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  /* ---------------------------------------------------------------- helpers */

  function $(sel, el) { return (el || doc).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function h(tag, attrs, html) {
    var el = doc.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] === false || attrs[k] == null) return;
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    if (html != null) el.innerHTML = html;
    return el;
  }

  function campById(id) {
    return (G.camps || []).filter(function (c) { return c.id === id; })[0];
  }

  /* Run a callback only while an element is on screen. Returns nothing;
     calls onEnter / onLeave so animations can stop burning battery offscreen. */
  function whileVisible(el, onEnter, onLeave) {
    if (!('IntersectionObserver' in window)) { onEnter(); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? onEnter() : onLeave(); });
    }, { threshold: 0.15 }).observe(el);
  }

  /* ------------------------------------------------------------- citations */

  var refOrder = [];
  function assignRef(id) {
    if (refOrder.indexOf(id) === -1) refOrder.push(id);
    return refOrder.indexOf(id) + 1;
  }

  /* Turn [[source-id]] tokens in data strings into citation links. Text is
     escaped first, so data strings are plain text plus these tokens. */
  function rich(s) {
    return esc(s).replace(/\[\[([a-z0-9-]+)\]\]/g, function (_, id) {
      return '<a class="ref" data-src="' + id + '"></a>';
    });
  }

  function richHtml(s) {
    return String(s).replace(/\[\[([a-z0-9-]+)\]\]/g, function (_, id) {
      return '<a class="ref" data-src="' + id + '"></a>';
    });
  }

  function scanStrings(node) {
    if (node == null) return;
    if (typeof node === 'string') {
      var m, re = /\[\[([a-z0-9-]+)\]\]/g;
      while ((m = re.exec(node))) assignRef(m[1]);
    } else if (Array.isArray(node)) {
      node.forEach(scanStrings);
    } else if (typeof node === 'object') {
      Object.keys(node).forEach(function (k) { scanStrings(node[k]); });
    }
  }

  /* Number sources in reading order: each section's static refs first, then
     the data that section renders (named in its data-scan attribute). */
  function numberSources() {
    $$('[data-scan], section.chapter, .hero').forEach(function (sec) {
      $$('a.ref[data-src]', sec).forEach(function (a) { assignRef(a.dataset.src); });
      (sec.getAttribute('data-scan') || '').split(/\s+/).forEach(function (key) {
        if (key && G[key]) scanStrings(G[key]);
      });
    });
  }

  function paintRefs(scope) {
    $$('a.ref[data-src]', scope).forEach(function (a) {
      var id = a.dataset.src;
      var src = (G.sources || {})[id];
      var n = assignRef(id);
      a.textContent = src ? n : '?';
      a.href = '#src-' + id;
      a.setAttribute('aria-label', 'Source ' + n + (src ? ': ' + src.p + ', ' + src.t : ''));
      if (src) a.title = src.p + ' - ' + src.t;
      if (!src && window.console) console.warn('Missing source:', id);
    });
  }

  function renderSources() {
    var ol = $('#sources-list');
    if (!ol) return;
    refOrder.forEach(function (id, i) {
      var s = (G.sources || {})[id];
      if (!s) return;
      var li = h('li', { id: 'src-' + id });
      li.innerHTML = '<span class="n">' + (i + 1) + '</span><span><a href="' + esc(s.u) + '" rel="noopener" target="_blank">' +
        esc(s.t) + '</a><span class="m">' + esc(s.p) + (s.d ? ', ' + esc(s.d) : '') + (s.note ? '. ' + esc(s.note) : '') +
        ' <span class="chk chk--' + esc(s.v || 'ref') + '">' + ({ read: 'Read in full', seen: 'Paywalled or blocked: headline and other reports', ref: 'Reference' }[s.v] || 'Reference') + '</span></span></span>';
      ol.appendChild(li);
    });
    var c = $('#sources-count');
    if (c) c.textContent = refOrder.length;
  }

  /* ----------------------------------------------------------- theme toggle */

  function initTheme() {
    var btn = $('#theme-btn');
    if (!btn) return;
    try {
      var saved = localStorage.getItem('guide-theme');
      if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
    } catch (e) { /* storage blocked: fine */ }
    btn.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('guide-theme', next); } catch (e) { /* ignore */ }
    });
  }

  /* ------------------------------------------------- nav, progress, reveals */

  function initChrome() {
    var links = $$('.topbar__nav a');
    var bar = $('.progress');
    var targets = links.map(function (a) { return $(a.getAttribute('href')); });
    var ticking = false;

    function update() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      var max = doc.body.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
      var current = -1;
      targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top < window.innerHeight * 0.35) current = i; });
      links.forEach(function (a, i) {
        if (i === current) {
          if (a.getAttribute('aria-current') !== 'true') {
            a.setAttribute('aria-current', 'true');
            var nav = a.parentNode;
            nav.scrollLeft = a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2;
          }
        } else a.removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();

    var rv = $$('.rv');
    if ('IntersectionObserver' in window && !reduced) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      rv.forEach(function (el) { io.observe(el); });
    } else rv.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ------------------------------------------------------------ hero: noise */

  function initNoise() {
    var box = $('#noise');
    if (!box || !G.noise) return;
    var stage = $('.noise__stage', box);
    var btn = $('#noise-btn');
    // scatter slots: x, y as fractions of free space, plus a tilt
    var slots = [[.05, .02, -7], [.62, .1, 5], [.3, .22, -3], [.78, .38, 8], [.02, .42, 4],
                 [.45, .5, -6], [.7, .68, 3], [.12, .7, -4], [.4, .86, 6], [.85, .9, -8]];

    G.noise.forEach(function (n) {
      var camp = campById(n.camp) || {};
      var cell = h('div', { class: 'noise__cell', style: '--camp: var(--c-' + n.camp + ')' });
      cell.appendChild(h('span', { class: 'noise__label', text: camp.short || camp.name || '' }));
      cell.appendChild(h('span', { class: 'chip', text: n.say }));
      stage.appendChild(cell);
    });
    var chips = $$('.chip', stage);

    function scatter() {
      var sr = stage.getBoundingClientRect();
      chips.forEach(function (c) { c.style.transform = 'none'; });
      var homes = chips.map(function (c) { return c.getBoundingClientRect(); });
      chips.forEach(function (c, i) {
        var s = slots[i % slots.length], r = homes[i];
        var tx = s[0] * (sr.width - r.width) - (r.left - sr.left);
        var ty = s[1] * (sr.height - r.height) - (r.top - sr.top);
        c.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) rotate(' + s[2] + 'deg)';
        c.style.transitionDelay = (i * 40) + 'ms';
      });
    }
    function setNoisy(on) {
      box.classList.toggle('is-noisy', on);
      if (on) scatter(); else chips.forEach(function (c) { c.style.transform = 'none'; });
      if (btn) { btn.textContent = on ? 'Sort them out' : 'Mix them up again'; btn.setAttribute('aria-pressed', String(!on)); }
    }

    if (reduced) { setNoisy(false); if (btn) btn.hidden = true; return; }

    // Start as noise without animating into it, then let the reader sort it.
    chips.forEach(function (c) { c.style.transition = 'none'; });
    setNoisy(true);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      chips.forEach(function (c) { c.style.transition = ''; });
    }); });

    var touched = false;
    if (btn) btn.addEventListener('click', function () { touched = true; setNoisy(!box.classList.contains('is-noisy')); });
    setTimeout(function () { if (!touched) setNoisy(false); }, 3800);

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (box.classList.contains('is-noisy')) scatter(); }, 150);
    });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { if (box.classList.contains('is-noisy')) scatter(); });
  }

  /* -------------------------------------------------- plate: next-word toy */

  function initPredictor() {
    var el = $('#pred');
    var P = G.predictor;
    if (!el || !P) return;
    var sentence = $('#pred-sentence'), bars = $('#pred-bars'), q = $('#pred-q');
    var pickBtn = $('#pred-pick'), resetBtn = $('#pred-reset'), live = $('#pred-live');
    var temps = { cautious: 0.45, normal: 1, wild: 2.2 };
    var state = { step: 0, picks: [], temp: 'normal' };

    function options() {
      var st = P.steps[state.step];
      if (!st) return null;
      var key = state.picks.length ? state.picks[state.picks.length - 1].w : null;
      var first = state.picks.length ? state.picks[0].w : null;
      var raw = (st.by && (st.by[key] || st.by[first])) || st.opts;
      var rest = st.rest || 4;
      var t = temps[state.temp];
      var ws = raw.map(function (o) { return Math.pow(o[1], 1 / t); });
      var rw = Math.pow(rest, 1 / t) * (t > 1 ? 2.5 : 1); // long tail grows when wild
      var sum = ws.reduce(function (a, b) { return a + b; }, 0) + rw;
      return { list: raw.map(function (o, i) { return { w: o[0], p: ws[i] / sum }; }), rest: rw / sum, join: st.join };
    }

    function draw() {
      var html = esc(P.start);
      state.picks.forEach(function (p, i) {
        html += esc(P.steps[i].join || ' ') + '<span class="w' + (p.by === 'model' ? ' w--model' : '') + '">' + esc(p.w) + '</span>';
      });
      var o = options();
      if (o) html += esc(o.join || ' ') + '<span class="pred__caret" aria-hidden="true"></span>';
      else html += '.';
      sentence.innerHTML = html;

      bars.innerHTML = '';
      if (o) {
        q.textContent = 'What comes next? The model’s guess:';
        o.list.sort(function (a, b) { return b.p - a.p; }).forEach(function (op) {
          var b = h('button', { class: 'bar', type: 'button', style: '--p:' + op.p.toFixed(3) });
          b.innerHTML = '<span>' + esc(op.w) + '</span><span class="bar__pct">' + Math.round(op.p * 100) + '%</span>';
          b.addEventListener('click', function () { choose(op.w, 'you'); });
          bars.appendChild(b);
        });
        var r = h('div', { class: 'bar bar--rest', style: '--p:' + o.rest.toFixed(3) });
        r.innerHTML = '<span>tens of thousands of other options</span><span class="bar__pct">' + Math.max(1, Math.round(o.rest * 100)) + '%</span>';
        bars.appendChild(r);
      } else {
        q.textContent = 'Done. One word at a time, that is all it did.';
        bars.appendChild(h('p', { class: 'step__body' }, esc(P.outro)));
      }
      pickBtn.disabled = !o;
    }

    function choose(w, by) {
      state.picks.push({ w: w, by: by });
      state.step++;
      if (live) live.textContent = (by === 'model' ? 'The model chose ' : 'You chose ') + w + '.';
      draw();
    }

    pickBtn.addEventListener('click', function () {
      var o = options();
      if (!o) return;
      var r = Math.random() * (1 - o.rest), acc = 0, pick = o.list[0].w;
      for (var i = 0; i < o.list.length; i++) { acc += o.list[i].p; if (r <= acc) { pick = o.list[i].w; break; } }
      choose(pick, 'model');
    });
    resetBtn.addEventListener('click', function () { state.step = 0; state.picks = []; draw(); });
    $$('#pred-temp button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.temp = b.dataset.t;
        $$('#pred-temp button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        draw();
      });
    });
    draw();
  }

  /* ------------------------------------------------------ plate: agent loop */

  function initLoop() {
    var el = $('#loop');
    var L = G.loop;
    if (!el || !L) return;
    var log = $('#loop-log'), next = $('#loop-next'), play = $('#loop-play'), reset = $('#loop-reset');
    var runner = $('#loop-runner');
    var nodes = { think: $('#ln-think'), act: $('#ln-act'), look: $('#ln-look') };
    var angles = { think: -90, act: 30, look: 150, done: -90 };
    var i = 0, timer = null, ang = -90, raf = null;
    $('#loop-goal').textContent = L.goal;

    function place(a) {
      var r = a * Math.PI / 180;
      runner.setAttribute('cx', (160 + 105 * Math.cos(r)).toFixed(1));
      runner.setAttribute('cy', (160 + 105 * Math.sin(r)).toFixed(1));
    }
    function travel(to) {
      if (raf) cancelAnimationFrame(raf);
      while (to < ang) to += 360;
      if (reduced) { ang = to % 360; place(ang); return; }
      var from = ang, t0 = null;
      function tick(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / 600);
        k = 1 - Math.pow(1 - k, 3);
        place(from + (to - from) * k);
        if (k < 1) raf = requestAnimationFrame(tick); else { ang = to % 360; raf = null; }
      }
      raf = requestAnimationFrame(tick);
    }
    function step() {
      if (i >= L.steps.length) return stop();
      var s = L.steps[i++];
      Object.keys(nodes).forEach(function (k) { nodes[k].classList.toggle('is-on', k === s.k || (s.k === 'done' && k === 'think')); });
      travel(angles[s.k]);
      var li = h('li', { 'data-k': s.k });
      li.innerHTML = '<span class="k">' + esc(L.labels[s.k]) + '</span><span>' + esc(s.t) + '</span>';
      log.appendChild(li);
      next.disabled = i >= L.steps.length;
      if (i >= L.steps.length) stop();
    }
    function stop() { clearInterval(timer); timer = null; play.textContent = 'Play'; play.disabled = i >= L.steps.length; }
    function doReset() {
      stop(); i = 0; log.innerHTML = ''; next.disabled = false; play.disabled = false;
      Object.keys(nodes).forEach(function (k) { nodes[k].classList.remove('is-on'); });
      ang = -90; place(ang);
    }
    next.addEventListener('click', function () { stop(); step(); });
    play.addEventListener('click', function () {
      if (timer) return stop();
      if (i >= L.steps.length) doReset();
      play.textContent = 'Pause'; step(); timer = setInterval(step, 1700);
    });
    reset.addEventListener('click', doReset);
    place(ang);
    step();
  }

  /* ---------------------------------------------------------- plate: boat */

  function initBoat() {
    var svg = $('#boat-svg');
    if (!svg) return;
    var course = $('#boat-course'), entry = $('#boat-entry'), circle = $('#boat-circle');
    var hull = $('#boat-hull'), say = $('#boat-say');
    var scoreEl = $('#boat-score'), progEl = $('#boat-prog');
    var targets = $$('.boat__target', svg);
    var marksG = $('#boat-marks');
    [0.16, 0.33, 0.5, 0.67, 0.84].forEach(function (f) {
      var pt = course.getPointAtLength(course.getTotalLength() * f);
      var c = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('class', 'boat__mark'); c.setAttribute('r', '5');
      c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1));
      marksG.appendChild(c);
    });
    var marks = $$('.boat__mark', svg);
    var B = G.boat || {};
    var mode = 'meant', raf = null, visible = false, last = 0;
    var s = { d: 0, phase: 'course', score: 0, laps: 0, finished: false, hits: [] };
    var len = { course: course.getTotalLength(), entry: entry.getTotalLength(), circle: circle.getTotalLength() };
    var speed = 95; // px per second in viewBox units

    function pose(path, d) {
      var L = path.getTotalLength();
      var p = path.getPointAtLength(Math.max(0, Math.min(L, d)));
      var q = path.getPointAtLength(Math.max(0, Math.min(L, d + 2)));
      var a = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      hull.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ') rotate(' + a.toFixed(1) + ')');
      return p;
    }
    function near(p, el, r) {
      var x = +el.getAttribute('cx'), y = +el.getAttribute('cy');
      return (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) < r * r;
    }
    function paint() {
      scoreEl.textContent = s.score.toLocaleString('en-GB');
      progEl.textContent = mode === 'meant'
        ? Math.round(Math.min(1, s.d / len.course) * 100) + '%'
        : (s.phase === 'circle' ? 'Never' : Math.round(s.d / len.course * 100) + '%');
    }
    function resetRun() {
      s = { d: 0, phase: mode === 'meant' ? 'course' : 'entry', score: 0, laps: 0, finished: false, hits: [] };
      targets.forEach(function (t) { t.classList.remove('is-hit'); });
      marks.forEach(function (m) { m.classList.remove('is-hit'); });
      say.textContent = B[mode] || '';
      pose(mode === 'meant' ? course : entry, 0);
      paint();
    }
    function tick(t) {
      raf = null;
      if (!visible) return;
      var dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
      if (!s.finished) {
        s.d += speed * dt;
        var p;
        if (s.phase === 'course') {
          p = pose(course, s.d);
          marks.forEach(function (m) { if (!m.classList.contains('is-hit') && near(p, m, 16)) { m.classList.add('is-hit'); s.score += 10; } });
          if (s.d >= len.course) { s.finished = true; s.score += 50; say.textContent = B.meantDone || ''; setTimeout(function () { if (mode === 'meant') { resetRun(); kick(); } }, 3200); }
        } else if (s.phase === 'entry') {
          p = pose(entry, s.d);
          if (s.d >= len.entry) { s.phase = 'circle'; s.d = 0; }
        } else {
          p = pose(circle, s.d % len.circle);
          targets.forEach(function (tg, i) {
            if (!tg.classList.contains('is-hit') && near(p, tg, 15)) {
              tg.classList.add('is-hit'); s.score += 10;
              setTimeout(function () { tg.classList.remove('is-hit'); }, 1500);
            }
          });
        }
        paint();
      }
      kick();
    }
    function kick() { if (!raf && visible && !reduced) { raf = requestAnimationFrame(tick); } }

    $$('#boat-mode button').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.dataset.m;
        $$('#boat-mode button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        resetRun(); last = performance.now(); kick();
      });
    });
    resetRun();
    if (reduced) { say.textContent = B.reduced || B.got || ''; return; }
    whileVisible(svg, function () { visible = true; last = performance.now(); kick(); }, function () { visible = false; });
  }

  /* ------------------------------------------------ plate: incident stepper */

  function initSteps() {
    var el = $('#steps');
    var S = G.incident;
    if (!el || !S || !S.length) return;
    var dots = $('#steps-dots'), panel = $('#steps-panel'), count = $('#steps-count');
    var prev = $('#steps-prev'), next = $('#steps-next');
    var i = 0;
    var tagText = { known: 'Established', disputed: 'Disputed', reported: 'Reported, not confirmed' };

    S.forEach(function (s, n) {
      var b = h('button', { type: 'button', 'aria-label': 'Step ' + (n + 1) + ': ' + s.title });
      b.addEventListener('click', function () { go(n); });
      dots.appendChild(b);
    });

    function scene(sc) {
      sc = sc || {};
      $$('#steps-svg .zone').forEach(function (z) { z.classList.toggle('is-hot', (sc.hot || []).indexOf(z.dataset.z) !== -1); });
      $$('#steps-svg .link').forEach(function (l) { l.classList.toggle('is-on', (sc.links || []).indexOf(l.dataset.l) !== -1); });
      var where = { box: [0, 0], edge: [78, 0], net: [170, -6], hf: [318, 8], home: [0, 0] };
      $$('#steps-svg .agent').forEach(function (a, k) {
        var spots = sc.agents || ['box'];
        var w = where[spots[k % spots.length]] || where.box;
        var jx = ((k * 37) % 23) - 11, jy = ((k * 53) % 31) - 15;
        var spread = spots[k % spots.length] === 'box' ? 1 : 0.8;
        a.style.transform = 'translate(' + (w[0] + jx * spread * (w[0] ? 1 : 0)) + 'px,' + (w[1] + jy * (w[0] ? 1 : 0)) + 'px)';
        a.style.opacity = sc.off ? 0.15 : 1;
      });
      var board = $('#steps-board');
      if (board) board.style.opacity = sc.board ? 1 : 0;
    }

    function go(n) {
      i = Math.max(0, Math.min(S.length - 1, n));
      var s = S[i];
      panel.innerHTML =
        '<p class="step__when">' + esc(s.when) + ' <span class="tag tag--' + (s.status === 'known' ? 'known' : s.status === 'disputed' ? 'disputed' : 'unknown') + '">' + tagText[s.status || 'known'] + '</span></p>' +
        '<h4 class="step__title">' + esc(s.title) + '</h4>' +
        s.body.map(function (p) { return '<p class="step__body">' + rich(p) + '</p>'; }).join('');
      paintRefs(panel);
      $$('button', dots).forEach(function (b, k) {
        b.classList.toggle('is-done', k < i);
        if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      count.textContent = (i + 1) + ' / ' + S.length;
      prev.disabled = i === 0; next.disabled = i === S.length - 1;
      scene(s.scene);
    }
    prev.addEventListener('click', function () { go(i - 1); });
    next.addEventListener('click', function () { go(i + 1); });
    el.addEventListener('keydown', function (e) {
      if (e.target.closest('a')) return;
      if (e.key === 'ArrowRight') { go(i + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { go(i - 1); e.preventDefault(); }
    });
    go(0);
  }

  /* ---------------------------------------------------------- known/disputed */

  function renderKD() {
    var el = $('#kd');
    var K = G.kd;
    if (!el || !K) return;
    [['known', 'What is established', 'tag--known'], ['disputed', 'What is disputed', 'tag--disputed'], ['unknown', 'What nobody outside knows', 'tag--unknown']].forEach(function (row) {
      if (!K[row[0]]) return;
      var d = h('div');
      d.innerHTML = '<h4><span class="tag ' + row[2] + '">' + row[1] + '</span></h4><ul>' +
        K[row[0]].map(function (t) { return '<li>' + rich(t) + '</li>'; }).join('') + '</ul>';
      el.appendChild(d);
    });
  }

  /* ---------------------------------------------------------------- timeline */

  function renderTimeline() {
    var ol = $('#tl'), filters = $('#tl-filters');
    var T = G.timeline;
    if (!ol || !T) return;
    var kinds = G.timelineKinds || {};
    T.forEach(function (e) {
      var li = h('li', { 'data-kind': e.kind, 'data-major': e.major ? '1' : null, style: '--kind: var(' + ((kinds[e.kind] || {}).c || '--ink-3') + ')' });
      li.innerHTML = '<div class="tl__when"><span>' + esc(e.when) + '</span><span class="tag">' + esc((kinds[e.kind] || {}).n || e.kind) + '</span></div>' +
        '<p class="tl__what">' + esc(e.what) + '</p>' + (e.more ? '<p class="tl__more">' + rich(e.more) + '</p>' : '');
      ol.appendChild(li);
    });
    if (!filters) return;
    var all = h('button', { class: 'fchip fchip--all', type: 'button', 'aria-pressed': 'true', text: 'Everything' });
    filters.appendChild(all);
    var btns = [all];
    Object.keys(kinds).forEach(function (k) {
      var b = h('button', { class: 'fchip', type: 'button', 'aria-pressed': 'false', style: '--camp: var(' + kinds[k].c + ')', text: kinds[k].n });
      b.dataset.k = k; filters.appendChild(b); btns.push(b);
    });
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        $$('li', ol).forEach(function (li) { li.hidden = !!b.dataset.k && li.dataset.kind !== b.dataset.k; });
      });
    });
  }

  /* ---------------------------------------------------------- argument chain */

  function initChain() {
    var ol = $('#chain'), panel = $('#chain-panel');
    var C = G.chain;
    if (!ol || !C) return;
    var btns = [];
    C.forEach(function (c, n) {
      var li = h('li');
      var b = h('button', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'chain-panel' }, '<span>' + esc(c.link) + '</span>');
      b.addEventListener('click', function () { open(n); });
      li.appendChild(b); ol.appendChild(li); btns.push(b);
    });
    function open(n) {
      var c = C[n];
      btns.forEach(function (b, k) { b.setAttribute('aria-expanded', String(k === n)); });
      panel.innerHTML = '<p class="chain__claim"><b>The claim.</b> ' + rich(c.claim) + '</p>' +
        '<ul class="chain__replies">' + c.replies.map(function (r) {
          var camp = campById(r.camp) || {};
          return '<li style="--camp: var(--c-' + r.camp + ')"><b>' + esc(r.who || camp.name || '') + '</b>' + rich(r.say) + '</li>';
        }).join('') + '</ul>';
      paintRefs(panel);
    }
    open(0);
  }

  /* --------------------------------------------------------------------- map */

  function convexHull(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [];
    pts.forEach(function (p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
    pts.slice().reverse().forEach(function (p) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); });
    lo.pop(); up.pop();
    return lo.concat(up);
  }
  function smoothPath(pts) {
    var n = pts.length, d = '';
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      if (i === 0) d += 'M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1);
      d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' +
        p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d + 'Z';
  }

  function initMap() {
    var map = $('#map'), card = $('#mapcard'), filters = $('#map-filters'), sel = $('#map-select');
    if (!map || !G.camps) return;
    var W = 1000, H = 800, PAD = 70;
    var people = [];
    G.camps.forEach(function (c) { (c.people || []).forEach(function (p) { if (p.x != null) people.push({ p: p, c: c }); }); });

    // positions: x,y given 0-100 (y: 100 = top). Relax overlaps a little.
    people.forEach(function (o) {
      o.px = PAD + (o.p.x / 100) * (W - PAD * 2);
      o.py = PAD + (1 - o.p.y / 100) * (H - PAD * 2);
    });
    for (var it = 0; it < 60; it++) {
      for (var a = 0; a < people.length; a++) for (var b = a + 1; b < people.length; b++) {
        var A = people[a], B = people[b], dx = B.px - A.px, dy = B.py - A.py;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.01, min = 62;
        if (d < min) { var push = (min - d) / 2; dx /= d; dy /= d; A.px -= dx * push; A.py -= dy * push; B.px += dx * push; B.py += dy * push; }
      }
      people.forEach(function (o) { o.px = Math.max(40, Math.min(W - 40, o.px)); o.py = Math.max(40, Math.min(H - 40, o.py)); });
    }

    var svg = $('svg', map);
    var terrG = $('#map-terr', map);
    G.camps.forEach(function (c) {
      var mine = people.filter(function (o) { return o.c === c; });
      if (!mine.length) return;
      var ring = [];
      mine.forEach(function (o) { for (var k = 0; k < 10; k++) { var t = k / 10 * Math.PI * 2; ring.push([o.px + Math.cos(t) * 50, o.py + Math.sin(t) * 50]); } });
      var path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', smoothPath(convexHull(ring)));
      path.setAttribute('class', 'terr');
      path.setAttribute('style', '--camp: var(--c-' + c.id + ')');
      path.dataset.camp = c.id;
      terrG.appendChild(path);
    });

    var dots = [];
    people.forEach(function (o) {
      var initials = o.p.initials || o.p.name.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
      var b = h('button', { class: 'dot', type: 'button', 'aria-pressed': 'false', 'aria-label': o.p.name + ', ' + o.c.name, style: 'left:' + (o.px / W * 100).toFixed(2) + '%;top:' + (o.py / H * 100).toFixed(2) + '%;--camp: var(--c-' + o.c.id + ')' }, '<i>' + esc(initials) + '</i>');
      b.addEventListener('click', function () { show(o); });
      b.addEventListener('mouseenter', function () { if (!pinned) show(o, true); });
      map.appendChild(b); o.btn = b; dots.push(b);
      if (sel) sel.appendChild(h('option', { value: String(people.indexOf(o)), text: o.p.name + ' (' + (o.c.short || o.c.name) + ')' }));
    });

    var pinned = false;
    function show(o, soft) {
      if (!soft) pinned = true;
      dots.forEach(function (d) { d.setAttribute('aria-pressed', String(d === o.btn)); });
      card.style.setProperty('--camp', 'var(--c-' + o.c.id + ')');
      card.innerHTML =
        '<p class="mapcard__camp">' + esc(o.c.name) + '</p>' +
        '<h4 class="mapcard__name">' + esc(o.p.name) + '</h4>' +
        '<p class="mapcard__role">' + esc(o.p.role || '') + '</p>' +
        (o.p.says ? '<p class="t"><span class="k">What they argue</span>' + rich(o.p.says) + '</p>' : '') +
        (o.p.since ? '<p class="t"><span class="k">Since the Hugging Face incident</span>' + rich(o.p.since) + '</p>' : '') +
        (o.p.why ? '<p class="t"><span class="k">Why we put them here</span>' + rich(o.p.why) + '</p>' : '') +
        '<p class="t"><a href="#camp-' + o.c.id + '">Read the plate for this camp</a></p>';
      paintRefs(card);
      if (sel) sel.value = String(people.indexOf(o));
    }
    if (sel) sel.addEventListener('change', function () { var o = people[+sel.value]; if (o) show(o); });

    // camp filters
    var all = h('button', { class: 'fchip fchip--all', type: 'button', 'aria-pressed': 'true', text: 'All camps' });
    filters.appendChild(all);
    var fb = [all];
    G.camps.forEach(function (c) {
      if (!people.some(function (o) { return o.c === c; })) return;
      var b = h('button', { class: 'fchip', type: 'button', 'aria-pressed': 'false', style: '--camp: var(--c-' + c.id + ')', text: c.short || c.name });
      b.dataset.camp = c.id; filters.appendChild(b); fb.push(b);
    });
    fb.forEach(function (b) {
      b.addEventListener('click', function () {
        fb.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var id = b.dataset.camp;
        people.forEach(function (o) { o.btn.classList.toggle('is-dim', !!id && o.c.id !== id); });
        $$('.terr', map).forEach(function (t) { t.classList.toggle('is-dim', !!id && t.dataset.camp !== id); t.classList.toggle('is-hot', !!id && t.dataset.camp === id); });
      });
    });
  }

  /* ------------------------------------------------------------ camp plates */

  function renderCamps() {
    var wrap = $('#camps');
    if (!wrap || !G.camps) return;
    G.camps.forEach(function (c, n) {
      var d = h('details', { class: 'camp', id: 'camp-' + c.id, style: '--camp: var(--c-' + c.id + ')' });
      if (n === 0) d.setAttribute('open', '');
      var people = (c.people || []).map(function (p) {
        return '<li><b>' + esc(p.name) + '</b><span class="role">' + esc(p.role || '') + '</span>' + rich(p.says || '') +
          (p.since ? ' <span class="k" style="display:block;margin-top:.4rem;font-family:var(--f-mono);font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)">Since July</span>' + rich(p.since) : '') + '</li>';
      }).join('');
      d.innerHTML =
        '<summary><span class="camp__no">Plate ' + (n + 1) + ' of ' + G.camps.length + '</span>' +
        '<h3 class="camp__name">' + esc(c.name) + '</h3><span class="camp__tog" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></span>' +
        '<p class="camp__claim">' + rich(c.claim) + '</p></summary>' +
        '<div class="camp__body">' +
        '<p class="camp__aka"><b>Also called:</b> ' + rich(c.aka) + '</p>' +
        '<div><h4>What they want</h4><p>' + rich(c.wants) + '</p></div>' +
        '<div><h4>Where you will find them</h4><p>' + rich(c.habitat) + '</p></div>' +
        '<div><h4>Their strongest point</h4><p>' + rich(c.best) + '</p></div>' +
        '<div><h4>The strongest objection</h4><p>' + rich(c.worst) + '</p></div>' +
        '<div><h4>Typical calls</h4><ul class="camp__calls">' + (c.calls || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div><h4>Often confused with</h4><p>' + rich(c.confused) + '</p></div>' +
        (c.money ? '<div style="grid-column:1/-1"><h4>Money and backing</h4><p>' + rich(c.money) + '</p></div>' : '') +
        '<div class="camp__people"><h4>Voices</h4><ul class="people">' + people + '</ul></div>' +
        '</div>';
      wrap.appendChild(d);
    });
    // open the plate when arriving from the map card
    window.addEventListener('hashchange', openFromHash);
    function openFromHash() {
      var t = location.hash && $(location.hash);
      if (t && t.tagName === 'DETAILS') t.open = true;
    }
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#camp-"]');
      if (a) { var t = $(a.getAttribute('href')); if (t) t.open = true; }
    });
  }

  /* ------------------------------------------------------------------- odds */

  function renderOdds() {
    var el = $('#odds');
    var O = G.odds;
    if (!el || !O) return;
    O.forEach(function (o) {
      var lo = o.lo, hi = o.hi == null ? o.lo : o.hi;
      var row = h('div', { class: 'odds__row', style: '--camp: var(--c-' + o.camp + ')' });
      row.innerHTML = '<div class="odds__who">' + esc(o.who) + '<small>' + rich(o.note) + '</small></div>' +
        '<div class="odds__track" role="img" aria-label="' + esc(o.who + ': ' + o.label) + '">' +
        '<span class="odds__bar" style="left:' + lo + '%;width:' + Math.max(0, hi - lo) + '%"></span>' +
        '<span class="odds__val" style="left:calc(' + Math.min(hi, 76) + '% + ' + (hi - lo < 2 ? 16 : 4) + 'px)">' + esc(o.label) + '</span></div>';
      el.appendChild(row);
    });
    var sc = h('div', { class: 'odds__scale', 'aria-hidden': 'true' });
    sc.innerHTML = '<span></span><span class="odds__ticks"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></span>';
    el.appendChild(sc);
  }

  /* ------------------------------------------------------------------- quiz */

  function initQuiz() {
    var el = $('#quiz');
    var Q = G.quiz;
    if (!el || !Q) return;
    var post = $('#quiz-post'), opts = $('#quiz-opts'), fb = $('#quiz-fb'), nextB = $('#quiz-next'), prog = $('#quiz-prog'), scoreEl = $('#quiz-score');
    var i = 0, score = 0;
    function draw() {
      var q = Q[i];
      post.textContent = q.post;
      opts.innerHTML = ''; fb.innerHTML = ''; nextB.hidden = true;
      prog.textContent = 'Post ' + (i + 1) + ' of ' + Q.length;
      scoreEl.textContent = score + ' right';
      // shuffle, or the right answer is always the first button
      var order = q.options.slice().sort(function () { return Math.random() - 0.5; });
      order.forEach(function (id) {
        var c = campById(id) || {};
        var b = h('button', { class: 'quiz__opt', type: 'button', style: '--camp: var(--c-' + id + ')', text: c.short || c.name, 'data-camp': id });
        b.addEventListener('click', function () {
          $$('button', opts).forEach(function (x) { x.disabled = true; });
          var right = id === q.answer;
          if (right) score++;
          b.classList.add(right ? 'is-right' : 'is-wrong');
          $$('button', opts).forEach(function (x) { if (x.dataset.camp === q.answer) x.classList.add('is-right'); });
          fb.innerHTML = '<b>' + (right ? 'Yes. ' : 'Not quite. ') + '</b>' + rich(q.why);
          paintRefs(fb);
          scoreEl.textContent = score + ' right';
          nextB.hidden = false;
          nextB.textContent = i === Q.length - 1 ? 'Start again' : 'Next post';
          nextB.focus();
        });
        opts.appendChild(b);
      });
    }
    nextB.addEventListener('click', function () {
      if (i === Q.length - 1) { i = 0; score = 0; } else i++;
      draw();
    });
    draw();
  }

  /* ----------------------------------------------------------------- ledger */

  function renderLedger() {
    var L = G.ledger;
    if (!L) return;
    [['worry', '#ledger-worry'], ['calm', '#ledger-calm']].forEach(function (pair) {
      var ul = $(pair[1]);
      if (!ul || !L[pair[0]]) return;
      L[pair[0]].forEach(function (e) {
        var li = h('li');
        li.innerHTML = '<span class="yr">' + esc(e.when) + '</span><b>' + esc(e.title) + '</b>' + rich(e.text) + (e.but ? '<em class="but">' + rich(e.but) + '</em>' : '');
        ul.appendChild(li);
      });
    });
  }

  /* --------------------------------------------------------------- glossary */

  function initGlossary() {
    var dl = $('#gloss'), input = $('#gloss-q'), count = $('#gloss-count');
    var T = G.glossary;
    if (!dl || !T) return;
    T = T.slice().sort(function (a, b) { return a.term.toLowerCase() < b.term.toLowerCase() ? -1 : 1; });
    var rows = T.map(function (t) {
      var d = h('div');
      d.innerHTML = '<dt>' + esc(t.term) + (t.say ? '<small>' + esc(t.say) + '</small>' : '') + '</dt><dd>' + rich(t.def) + '</dd>';
      d.dataset.hay = (t.term + ' ' + t.def + ' ' + (t.also || '')).toLowerCase();
      dl.appendChild(d);
      return d;
    });
    var none = h('p', { class: 'gloss__none', hidden: '' }, 'Nothing matches. Try a shorter word.');
    dl.parentNode.insertBefore(none, dl.nextSibling);
    function filter() {
      var q = input.value.trim().toLowerCase(), n = 0;
      rows.forEach(function (r) { var ok = !q || r.dataset.hay.indexOf(q) !== -1; r.hidden = !ok; if (ok) n++; });
      count.textContent = n + (n === 1 ? ' term' : ' terms');
      none.hidden = n !== 0;
    }
    input.addEventListener('input', filter);
    filter();
  }

  /* ------------------------------------------------- prose and simple lists */

  function renderProse() {
    var P = G.prose || {};
    Object.keys(P).forEach(function (id) { var el = doc.getElementById(id); if (el) el.innerHTML = richHtml(P[id]); });
  }

  function renderShort() {
    var ul = $('#short-list');
    if (!ul || !G.short) return;
    G.short.forEach(function (x) { ul.appendChild(h('li', null, '<b>' + esc(x.b) + '</b>' + rich(x.t))); });
  }

  function renderGov() {
    var el = $('#gov');
    if (!el || !G.gov) return;
    G.gov.forEach(function (g) {
      el.appendChild(h('div', null, '<h3>' + esc(g.h) + '</h3>' + g.p.map(function (t) { return '<p>' + rich(t) + '</p>'; }).join('')));
    });
  }

  function renderQuestions() {
    var ol = $('#qs');
    if (!ol || !G.questions) return;
    G.questions.forEach(function (q) { ol.appendChild(h('li', null, '<div><b>' + esc(q.b) + '</b><p>' + rich(q.t) + '</p></div>')); });
  }

  /* ------------------------------------------------------------------- boot */

  function boot() {
    initTheme();
    renderProse();
    numberSources();
    renderShort();
    renderGov();
    renderQuestions();
    initNoise();
    initPredictor();
    initLoop();
    initBoat();
    initSteps();
    renderKD();
    renderTimeline();
    initChain();
    initMap();
    renderCamps();
    renderOdds();
    initQuiz();
    renderLedger();
    initGlossary();
    paintRefs(doc);
    renderSources();
    initChrome();
    $$('[data-asof]').forEach(function (el) { el.textContent = G.asOf || ''; });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
