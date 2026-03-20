/* global CSInterface, SystemPath */
(function () {
  function getCS() {
    try { return new CSInterface(); } catch (e) { return null; }
  }
  const cs = getCS();
  const statusEl = document.getElementById('status');

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || '';
    try { console.log('[TimelineHelper]', msg); } catch(e){}
  }

  // Простая файловая отладка (debug_ai.txt в корне расширения)
  function writeStatusFile(text, append) {
    try {
      if (!cs || !window.cep || !window.cep.fs) return;
      var root = cs.getSystemPath(SystemPath.EXTENSION);
      var p = root + '/jsfl/status.txt';
      if (append) {
        try {
          var r = window.cep.fs.readFile(p);
          if (r && r.err === 0 && typeof r.data === 'string') {
            text = r.data + (r.data ? '\n' : '') + text;
          }
        } catch(e0) {}
      }
      window.cep.fs.writeFile(p, text);
    } catch(e) { /* ignore */ }
  }

  function writeDebug(lines) {
    try {
      if (!cs || !window.cep || !window.cep.fs) return;
      var root = cs.getSystemPath(SystemPath.EXTENSION);
      var p = root + '/debug_ai.txt';
      var now = new Date();
      var stamp = now.toISOString();
      var text = '';
      try {
        var r = window.cep.fs.readFile(p);
        if (r && r.err === 0 && typeof r.data === 'string') text = r.data;
      } catch(e1) {}
      if (!(lines instanceof Array)) lines = [String(lines)];
      var block = '[' + stamp + '] ' + lines.join('\n');
      text += (text ? '\n' : '') + block;
      window.cep.fs.writeFile(p, text);
      // Дублируем последний блок в status.txt и в статус панели
      writeStatusFile(block, true);
      setStatus(block);
    } catch(e) { /* ignore */ }
  }

  function pathToURI(p) {
    if (!p) return '';
    let uri = p.replace(/\\/g, '/');
    if (!uri.startsWith('file:///')) uri = 'file:///' + uri;
    return uri;
  }

  function runJSFL(scriptName) {
    if (!cs) { setStatus('CSInterface недоступен'); return; }
    const extDir = cs.getSystemPath(SystemPath.EXTENSION);
    const jsflPath = extDir + '/jsfl/' + scriptName;
    const statusPath = extDir + '/jsfl/status.txt';
    const jsflURI = pathToURI(jsflPath);
    // Запускаем JSFL-файл; внутри у нас вызывается main(), который возвращает строку
    cs.evalScript('fl.runScript(' + JSON.stringify(jsflURI) + ')', function (res) {
      try {
        // Пробуем прочитать статус из файла, который записывает JSFL
        if (window.cep && window.cep.fs && window.cep.fs.readFile) {
          const read = window.cep.fs.readFile(statusPath);
          if (read && read.err === 0 && read.data) {
            setStatus(read.data);
            return;
          }
        }
      } catch(e) {}
      // Фоллбек на ответ evalScript
      setStatus((res && res !== 'undefined' && res !== 'null') ? res : 'Готово.');
    });
  }

  function isHostIllustrator() {
    try {
      if (!cs) return false;
      var host = cs.hostEnvironment && cs.hostEnvironment.appName;
      var s = String(host || '').toUpperCase();
      var res = (s === 'ILST' || s.indexOf('ILLUSTRATOR') >= 0);
      writeDebug(['isHostIllustrator?', 'appName='+s, 'result='+res]);
      return res;
    } catch(e) { return false; }
  }

  function evalExtendScript(code, cb){
    if (!cs) return cb && cb('no cs');
    cs.evalScript(code, function(res){ if (cb) cb(res); });
  }

  function getExtRoot(){
    return cs ? cs.getSystemPath(SystemPath.EXTENSION) : '';
  }

  function runImageTraceOnce(){
    if (!isHostIllustrator()) { writeDebug(['runImageTraceOnce: not AI host']); return; }
    var root = getExtRoot();
    var api = root + '/jsx/AutoImageTrace.jsx';
    var thrEl = document.getElementById('runTraceThreshold');
    var thr = null;
    try { var v = thrEl && thrEl.value != null ? String(thrEl.value).trim() : ''; if (v !== '') thr = Math.max(0, Math.min(255, parseInt(v, 10))); } catch(e) { thr = null; }
    var cleanWhiteEl = document.getElementById('runTraceCleanWhite');
    var cleanWhite = false;
    try { cleanWhite = cleanWhiteEl && cleanWhiteEl.checked === true; } catch(e) { cleanWhite = false; }
    var code = 'var api=File(' + JSON.stringify(api) + '); if(api.exists){$.evalFile(api);} AutoImageTrace_traceNow(' + (thr == null ? 'null' : String(thr)) + ', ' + (cleanWhite ? 'true' : 'false') + ');';
    evalExtendScript(code, function(res){ setStatus('AI: ' + res); writeDebug(['runImageTraceOnce: res', String(res)]); });
  }

  function shrinkTraceLayer(){
    if (!isHostIllustrator()) { writeDebug(['shrinkTraceLayer: not AI host']); return; }
    var root = getExtRoot();
    var api = root + '/jsx/AutoImageTrace.jsx';
    var code = 'var api=File(' + JSON.stringify(api) + '); if(api.exists){$.evalFile(api);} AutoImageTrace_shrinkTraceLayer(-0.5);';
    evalExtendScript(code, function(res){ setStatus('AI: ' + res); writeDebug(['shrinkTraceLayer: res', String(res)]); });
  }

  function expandTraceLayer(){
    if (!isHostIllustrator()) { writeDebug(['expandTraceLayer: not AI host']); return; }
    var root = getExtRoot();
    var api = root + '/jsx/AutoImageTrace.jsx';
    var code = 'var api=File(' + JSON.stringify(api) + '); if(api.exists){$.evalFile(api);} AutoImageTrace_shrinkTraceLayer(0.5);';
    evalExtendScript(code, function(res){ setStatus('AI: ' + res); writeDebug(['expandTraceLayer: res', String(res)]); });
  }

  var TAB_STORAGE_PREFIX = 'timelinehelper.tab.';

  function tabIsVisible(tab) {
    try {
      var h = tab.getAttribute('data-host') || '';
      if (h === 'illustrator') return document.body.classList.contains('host-illustrator');
      if (h === 'animate') return !document.body.classList.contains('host-illustrator');
      return true;
    } catch (e) { return true; }
  }

  function getVisibleTabsInList(list) {
    var tabs = list.querySelectorAll('[role="tab"]');
    var out = [];
    for (var i = 0; i < tabs.length; i++) {
      if (tabIsVisible(tabs[i])) out.push(tabs[i]);
    }
    return out;
  }

  function activateTabInList(list, tab) {
    if (!list || !tab) return;
    var panelId = tab.getAttribute('aria-controls');
    if (!panelId) return;
    var tabs = list.querySelectorAll('[role="tab"]');
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var pid = t.getAttribute('aria-controls');
      var panel = pid ? document.getElementById(pid) : null;
      var selected = (t === tab);
      t.setAttribute('aria-selected', selected ? 'true' : 'false');
      t.tabIndex = selected ? 0 : -1;
      if (panel) {
        if (selected) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      }
    }
    var gid = list.getAttribute('data-tab-group') || 'default';
    try { sessionStorage.setItem(TAB_STORAGE_PREFIX + gid, panelId); } catch (e) {}
  }

  function initTabGroups() {
    function activateTabPanelById(panelId) {
      var panel = document.getElementById(panelId);
      if (!panel || panel.getAttribute('role') !== 'tabpanel') return;
      var tab = document.querySelector('[role="tab"][aria-controls="' + panelId + '"]');
      if (!tab || !tabIsVisible(tab)) return;
      var list = tab.closest('[role="tablist"]');
      if (!list) return;
      activateTabInList(list, tab);
    }

    window.__TimelineHelper = window.__TimelineHelper || {};
    window.__TimelineHelper.activateTabPanel = activateTabPanelById;

    var lists = document.querySelectorAll('[role="tablist"]');
    for (var li = 0; li < lists.length; li++) {
      (function wire(list) {
        var gid = list.getAttribute('data-tab-group') || 'default';
        var stored = null;
        try { stored = sessionStorage.getItem(TAB_STORAGE_PREFIX + gid); } catch (e0) {}

        function pickInitialTab() {
          var visible = getVisibleTabsInList(list);
          if (stored && visible.length) {
            for (var v = 0; v < visible.length; v++) {
              if (visible[v].getAttribute('aria-controls') === stored) return visible[v];
            }
          }
          return visible[0] || null;
        }

        var initial = pickInitialTab();
        if (initial) activateTabInList(list, initial);

        var tabs = list.querySelectorAll('[role="tab"]');
        for (var j = 0; j < tabs.length; j++) {
          tabs[j].addEventListener('click', function () {
            if (!tabIsVisible(this)) return;
            activateTabInList(list, this);
          });
        }

        list.addEventListener('keydown', function (e) {
          if (!e || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
          var visible = getVisibleTabsInList(list);
          if (visible.length < 2) return;
          var ix = -1;
          for (var k = 0; k < visible.length; k++) {
            if (visible[k].getAttribute('aria-selected') === 'true') { ix = k; break; }
          }
          if (ix < 0) ix = 0;
          var next = e.key === 'ArrowRight' ? (ix + 1) % visible.length : (ix - 1 + visible.length) % visible.length;
          try { e.preventDefault(); } catch (p) {}
          activateTabInList(list, visible[next]);
          try { visible[next].focus(); } catch (f) {}
        });
      })(lists[li]);
    }
  }

  // UI toggle for Illustrator
  (function initAiButton(){
    var inAI = isHostIllustrator();
    try { document.body.classList.toggle('host-illustrator', inAI); } catch (eC) {}
    var btn = document.getElementById('runTraceOnce');
    var shrinkBtn = document.getElementById('shrinkTrace');
    var expandBtn = document.getElementById('expandTrace');
    writeDebug(['initAiButton: start']);
    writeDebug(['initAiButton: isAI='+inAI]);
    if (!inAI) {
      writeDebug(['initAiButton: hidden (not AI host)']);
      return;
    }
    if (!btn) { writeDebug(['initAiButton: btn not found']); return; }
    btn.addEventListener('click', function(){
      writeDebug(['runTraceOnce: click']);
      runImageTraceOnce();
    });
    if (shrinkBtn) {
      shrinkBtn.addEventListener('click', function(){
        writeDebug(['shrinkTrace: click']);
        shrinkTraceLayer();
      });
    }
    if (expandBtn) {
      expandBtn.addEventListener('click', function(){
        writeDebug(['expandTrace: click']);
        expandTraceLayer();
      });
    }
    writeDebug(['initAiButton: ready']);
  })();

  initTabGroups();

  function writeApplyAll(on) {
    try {
      if (!cs) return;
      const extDir = cs.getSystemPath(SystemPath.EXTENSION);
      const allPath = extDir + '/jsfl/anchor_apply_all.txt';
      if (window.cep && window.cep.fs && window.cep.fs.writeFile) {
        window.cep.fs.writeFile(allPath, on ? '1' : '0');
      }
    } catch(e) { /* ignore */ }
  }

  /** Записать split_lines_animation.txt из полей вкладки «Текст» перед SplitMultilineTextToMovieClips.jsfl */
  function writeSplitLinesAnimationFromUI() {
    try {
      if (!cs || !window.cep || !window.cep.fs || !window.cep.fs.writeFile) return false;
      const extDir = cs.getSystemPath(SystemPath.EXTENSION);
      const cfgPath = extDir + '/jsfl/split_lines_animation.txt';
      const el = function (id) { return document.getElementById(id); };
      var ox = 0;
      var oy = 0;
      var tf = 20;
      var lg = 3;
      try {
        var vx = el('splitAnimOffsetX') && el('splitAnimOffsetX').value;
        if (vx != null && String(vx).trim() !== '') ox = parseFloat(String(vx).replace(',', '.'));
        if (isNaN(ox)) ox = 0;
      } catch (e0) { ox = 0; }
      try {
        var vy = el('splitAnimOffsetY') && el('splitAnimOffsetY').value;
        if (vy != null && String(vy).trim() !== '') oy = parseFloat(String(vy).replace(',', '.'));
        if (isNaN(oy)) oy = 16;
      } catch (e1) { oy = 16; }
      try {
        var vt = el('splitAnimTweenFrames') && el('splitAnimTweenFrames').value;
        if (vt != null && String(vt).trim() !== '') tf = parseInt(String(vt).trim(), 10);
        if (isNaN(tf) || tf < 1) tf = 20;
      } catch (e2) { tf = 20; }
      try {
        var vl = el('splitAnimLayerStagger') && el('splitAnimLayerStagger').value;
        if (vl != null && String(vl).trim() !== '') lg = parseInt(String(vl).trim(), 10);
        if (isNaN(lg) || lg < 0) lg = 3;
      } catch (e3) { lg = 3; }
      const lines = [
        '# split_lines — параметры из панели Timeline Helper',
        'offset_x=' + ox,
        'offset_y=' + oy,
        'tween_frames=' + tf,
        'layer_stagger=' + lg
      ];
      const res = window.cep.fs.writeFile(cfgPath, lines.join('\n'));
      if (!res || res.err !== 0) {
        setStatus('Не удалось записать split_lines_animation.txt: ' + (res && res.err));
        return false;
      }
      return true;
    } catch (e) {
      setStatus('split_lines_animation: ' + e);
      return false;
    }
  }

  document.getElementById('swapToDup')?.addEventListener('click', function () {
    runJSFL('SwapLayerInstancesToDuplicate.jsfl');
  });
  document.getElementById('dupLayerGuideBitmap')?.addEventListener('click', function(){
    runJSFL('DuplicateLayerToGuideAndBitmap.jsfl');
  });
  document.getElementById('convertLayerToBitmap')?.addEventListener('click', function(){
    runJSFL('ConvertLayerToBitmap.jsfl');
  });
  document.getElementById('rebuildBitmapSmall')?.addEventListener('click', function(){
    runJSFL('RebuildBitmapFromLayer.jsfl');
  });
  document.getElementById('rebuildBitmapSmallMinus')?.addEventListener('click', function(){
    runJSFL('RebuildBitmapFromLayerMinus.jsfl');
  });
  document.getElementById('createOverlayLayer')?.addEventListener('click', function(){
    runJSFL('CreateOverlayActionsLayer.jsfl');
  });
  document.getElementById('toggleTextCase')?.addEventListener('click', function(){
    runJSFL('ToggleTextCase.jsfl');
  });
  document.getElementById('createLoopLimiterLayer')?.addEventListener('click', function(){
    runJSFL('CreateLoopLimiterActionsLayer.jsfl');
  });
  document.getElementById('createBitmapMask')?.addEventListener('click', function(){
    runJSFL('CreateMaskForBitmapLayer.jsfl');
  });
  document.getElementById('openBitmapInAi')?.addEventListener('click', function(){
    runJSFL('OpenBitmapInIllustrator.jsfl');
  });
  document.getElementById('splitMultilineTextMc')?.addEventListener('click', function(){
    if (!writeSplitLinesAnimationFromUI()) return;
    runJSFL('SplitMultilineTextToMovieClips.jsfl');
  });
  document.getElementById('listParents')?.addEventListener('click', function(){
    runJSFL('ListParentSymbols.jsfl');
  });
  // removed: diagnoseKF, moveAnchorRight100
  function applyPreset(val){
    try {
      const extDir = cs.getSystemPath(SystemPath.EXTENSION);
      const cfgPath = extDir + '/jsfl/anchor_preset.txt';
      if (window.cep && window.cep.fs && window.cep.fs.writeFile) {
        const res = window.cep.fs.writeFile(cfgPath, val);
        if (!res || res.err !== 0) {
          setStatus('Не удалось записать пресет: ' + (res && res.err));
          return;
        }
        // пишем флаг применения ко всем ключам
        try {
          const btn = document.getElementById('anchor-apply-all');
          const on = !!(btn && btn.classList && btn.classList.contains('active'));
          writeApplyAll(on);
        } catch(e2) {}
      }
    } catch(e) { /* ignore */ }
    setTimeout(function(){ runJSFL('SetAnchorByPreset.jsfl'); }, 30);
  }

  document.getElementById('anchor-tl')?.addEventListener('click', function(){ applyPreset('topLeft'); });
  document.getElementById('anchor-tc')?.addEventListener('click', function(){ applyPreset('topCenter'); });
  document.getElementById('anchor-tr')?.addEventListener('click', function(){ applyPreset('topRight'); });
  document.getElementById('anchor-ml')?.addEventListener('click', function(){ applyPreset('middleLeft'); });
  document.getElementById('anchor-cc')?.addEventListener('click', function(){ applyPreset('center'); });
  document.getElementById('anchor-mr')?.addEventListener('click', function(){ applyPreset('middleRight'); });
  document.getElementById('anchor-bl')?.addEventListener('click', function(){ applyPreset('bottomLeft'); });
  document.getElementById('anchor-bc')?.addEventListener('click', function(){ applyPreset('bottomCenter'); });
  document.getElementById('anchor-br')?.addEventListener('click', function(){ applyPreset('bottomRight'); });
  document.getElementById('anchor-s0')?.addEventListener('click', function(){ applyPreset('stageZero'); });
  (function initApplyAll(){
    const btn = document.getElementById('anchor-apply-all');
    if (!btn) return;
    try {
      // включено по умолчанию
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      writeApplyAll(true);
    } catch(e0) {}
    btn.addEventListener('click', function(){
      const willBeActive = !btn.classList.contains('active');
      if (willBeActive) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
      writeApplyAll(willBeActive);
    });
  })();
  setStatus('Готово.');

  // Горячая клавиша: Ctrl/⌘ + Shift + T (работает только когда панель в фокусе)
  document.addEventListener('keydown', function(e){
    try {
      if (!e) return;
      // Логируем, чтобы понять, какие поля реально приходят
      try {
        writeDebug([
          'keydown',
          'key=' + String(e.key),
          'code=' + String(e.code),
          'keyCode=' + String(e.keyCode),
          'which=' + String(e.which),
          'ctrl=' + (!!e.ctrlKey),
          'meta=' + (!!e.metaKey),
          'shift=' + (!!e.shiftKey)
        ]);
      } catch(_log) {}

      var key = String(e.key || '').toLowerCase();
      var keyCode = typeof e.keyCode === 'number' ? e.keyCode : (typeof e.which === 'number' ? e.which : null);
      var isMod = !!(e.ctrlKey || e.metaKey);
      var isT =
        (key === 't') ||
        (keyCode === 84); // резервный вариант для старых движков

      if (isMod && e.shiftKey && isT) {
        try { e.preventDefault(); } catch(_p) {}
        runJSFL('ToggleTextCase.jsfl');
      }
    } catch(_e) {}
  });
})();
