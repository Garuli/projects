/* Receipt scanning: live camera (or the phone's own camera app), then OCR in the browser.
   If the server has an AI key, that is tried first and the browser OCR is the fallback. */
(function () {
  'use strict';
  var App = window.App, esc = App.esc, S = App.S;
  var stream = null, torchOn = false;

  function liveCameraPossible() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext);
  }

  function stopStream() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    torchOn = false;
  }
  function closeCamera() { stopStream(); App.$('#camera-root').innerHTML = ''; }

  function pickFile(capture) {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    input.addEventListener('change', function () { if (input.files && input.files[0]) fromFile(input.files[0]); });
    input.click();
  }

  function start() {
    if (!liveCameraPossible()) { pickFile(true); return; }   // plain http on a phone: use the camera app instead
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
      .then(function (s) {
        stream = s;
        var canTorch = false;
        try { var caps = s.getVideoTracks()[0].getCapabilities(); canTorch = !!(caps && caps.torch); } catch (e) { /* not supported */ }
        App.$('#camera-root').innerHTML =
          '<div class="cam"><video id="cam-video" playsinline muted autoplay></video>' +
          '<div class="cam-top"><button class="round-btn" data-action="cam-close" aria-label="Close camera">' + App.icon('back') + '</button>' +
          '<span class="cam-hint">Fit the whole receipt in the frame</span><span style="width:44px"></span></div>' +
          '<div class="cam-frame"><i></i><i></i><i></i><i></i></div>' +
          '<div class="cam-bottom"><button class="round-btn" data-action="cam-gallery" aria-label="Choose a photo">' + App.icon('image') + '</button>' +
          '<button class="shutter" data-action="cam-shoot" aria-label="Take photo"></button>' +
          (canTorch ? '<button class="round-btn" data-action="cam-torch" aria-label="Flash">' + App.icon('bolt') + '</button>' : '<span style="width:44px"></span>') + '</div></div>';
        var v = App.$('#cam-video'); v.srcObject = s;
      })
      .catch(function () {
        App.toast('Camera is not available. Pick or take a photo instead.', 'error');
        pickFile(true);
      });
  }

  function shoot() {
    var v = App.$('#cam-video'); if (!v || !v.videoWidth) return;
    var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    closeCamera();
    readCanvas(c);
  }

  function torch() {
    var track = stream && stream.getVideoTracks()[0]; if (!track) return;
    torchOn = !torchOn;
    track.applyConstraints({ advanced: [{ torch: torchOn }] }).catch(function () { App.toast('Flash is not available.', 'error'); });
  }

  function fromFile(file) {
    closeCamera();
    if (!/^image\//.test(file.type)) { App.toast('Please choose a photo.', 'error'); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(url);
      readCanvas(c);
    };
    img.onerror = function () { URL.revokeObjectURL(url); App.toast('That photo could not be opened.', 'error'); };
    img.src = url;
  }

  /** Scale, grayscale and stretch contrast: makes small, dim phone photos much easier for OCR. */
  function prepare(src) {
    var target = 1800, scale = Math.min(2, target / Math.max(src.width, 1));
    if (src.width > 2600) scale = 2600 / src.width;
    var c = document.createElement('canvas'); c.width = Math.round(src.width * scale); c.height = Math.round(src.height * scale);
    var ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0, c.width, c.height);
    var img = ctx.getImageData(0, 0, c.width, c.height), d = img.data, hist = new Array(256).fill(0), i, g;
    for (i = 0; i < d.length; i += 4) { g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0; d[i] = d[i + 1] = d[i + 2] = g; hist[g]++; }
    var total = c.width * c.height, lo = 0, hi = 255, acc = 0;
    for (i = 0; i < 256; i++) { acc += hist[i]; if (acc > total * 0.02) { lo = i; break; } }
    acc = 0; for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc > total * 0.2) { hi = i; break; } }
    if (hi - lo < 40) { lo = 0; hi = 255; }
    var k = 255 / (hi - lo);
    for (i = 0; i < d.length; i += 4) { var v = Math.max(0, Math.min(255, (d[i] - lo) * k)); d[i] = d[i + 1] = d[i + 2] = v; }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function progressUi(text, pct) {
    var el = App.$('#camera-root');
    el.innerHTML = '<div class="scan-wait"><div class="scan-card"><div class="scan-ill">' + App.icon('receipt', 34) + '</div><b>' + esc(text) + '</b>' +
      '<div class="bar"><i style="width:' + Math.round((pct || 0) * 100) + '%"></i></div><small class="muted">The photo stays on your phone.</small></div></div>';
  }

  var tessPromise = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (!tessPromise) tessPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = '/vendor/tesseract/tesseract.min.js';
      s.onload = resolve; s.onerror = function () { tessPromise = null; reject(new Error('The scanner could not be loaded.')); };
      document.head.appendChild(s);
    });
    return tessPromise;
  }

  function ocr(canvas) {
    progressUi('Loading the scanner…', 0.02);
    return loadTesseract().then(function () {
      return window.Tesseract.createWorker('eng', 1, {
        workerPath: '/vendor/tesseract/worker.min.js', corePath: '/vendor/tesseract-core', langPath: '/vendor/lang', gzip: true,
        logger: function (m) { if (m.status === 'recognizing text') progressUi('Reading the receipt…', m.progress); }
      });
    }).then(function (worker) {
      return worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })
        .then(function () { return worker.recognize(prepare(canvas)); })
        .then(function (r) { return worker.terminate().then(function () { return r.data.text; }); });
    });
  }

  function aiScan(canvas) {
    var max = 1600, s = Math.min(1, max / Math.max(canvas.width, canvas.height));
    var c = document.createElement('canvas'); c.width = Math.round(canvas.width * s); c.height = Math.round(canvas.height * s);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    progressUi('Reading the receipt with AI…', 0.4);
    return App.api('/api/receipt/ai', { method: 'POST', body: { image: c.toDataURL('image/jpeg', 0.8) } });
  }

  function readCanvas(canvas) {
    var run = S.config.aiScan
      ? aiScan(canvas).catch(function () { return ocr(canvas).then(function (t) { return window.Receipt.parseReceipt(t); }); })
      : ocr(canvas).then(function (t) { return window.Receipt.parseReceipt(t); });
    run.then(function (parsed) {
      App.$('#camera-root').innerHTML = '';
      if (App.scanForDraft && S.draft) { App.scanForDraft = false; App.mergeScan(parsed); } else App.startDraft(parsed, true);
    }).catch(function (e) {
      App.$('#camera-root').innerHTML = '';
      App.toast(e.message || 'The receipt could not be read. You can add the items by hand.', 'error');
      if (App.scanForDraft && S.draft) App.scanForDraft = false; else App.startDraft(null);
    });
  }

  App.scan = { start: start, shoot: shoot, torch: torch, close: closeCamera, gallery: function () { pickFile(false); }, take: function () { pickFile(true); }, fromFile: fromFile, readCanvas: readCanvas };
})();
