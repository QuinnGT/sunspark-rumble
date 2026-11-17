// Downloads game.bundle.js with a progress bar, then runs it as a normal script.
// Classic script (no modules, no inline code) so it works under a strict CSP and from file://.
(function () {
  var tag = document.currentScript, bundle = tag.dataset.bundle || 'game.bundle.js';
  var total = +tag.dataset.bytes || 0; // uncompressed size, injected by build:web
  var $ = function (id) { return document.getElementById(id); };
  var show = function (id, on) { $(id).classList.toggle('hidden', !on); };
  var bar = $('load-bar'), text = $('load-text');
  var mb = function (n) { return (n / 1048576).toFixed(1); };

  function fail() {
    $('error-text').textContent = 'Sunspark Rumble could not be downloaded. Check your connection, then try again.';
    show('loading', false); show('error', true);
  }

  // The fetch above already filled the HTTP cache, so this is a revalidation (or a cache hit), not a second download.
  function run() {
    var script = document.createElement('script');
    script.src = bundle; script.onerror = fail; document.body.appendChild(script);
  }

  function progress(got) {
    if (!total) { text.textContent = mb(got) + ' MB downloaded'; return; }
    var pct = Math.min(100, Math.floor(got * 100 / total));
    bar.firstElementChild.style.width = pct + '%'; bar.setAttribute('aria-valuenow', pct);
    text.textContent = pct + '%  \u00B7  ' + mb(got) + ' of ' + mb(total) + ' MB';
  }

  async function download() {
    var res = await fetch(bundle);
    if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
    // Content-Length is the compressed size when the response is encoded, so it is only usable without Content-Encoding.
    if (!total && !res.headers.get('content-encoding')) total = +res.headers.get('content-length') || 0;
    bar.classList.toggle('indeterminate', !total); show('load-progress', true);
    for (var reader = res.body.getReader(), got = 0, chunk; !(chunk = await reader.read()).done;) { got += chunk.value.length; progress(got); }
    if (total) progress(total);
  }

  function start() {
    show('loading', true);
    if (location.protocol === 'file:') return run(); // the portable edition has no network to stream from
    download().catch(function () { show('load-progress', false); }).then(run); // any fetch failure falls back to a plain script tag
  }

  $('try-again').addEventListener('click', function () { location.reload(); });

  // Touch-only devices have no keyboard or mouse, so ask before starting a large download.
  if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) {
    show('loading', false); show('touch-notice', true);
    $('load-anyway').addEventListener('click', function () { show('touch-notice', false); start(); });
  } else start();
})();
