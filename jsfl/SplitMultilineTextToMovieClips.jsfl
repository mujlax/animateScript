// SplitMultilineTextToMovieClips.jsfl
// Выделите на сцене movie clip с многострочным текстом внутри.
// Скрипт: N строк → N уникальных символов в библиотеке (в каждом одна строка),
// N новых слоёв (split_lines_1 … split_lines_N), по одному экземпляру на слой; позиция как у исходного MC (матрица), исходный экземпляр удаляется.
// Параметры анимации: опционально split_lines_animation.txt рядом со скриптом (см. split_lines_animation.example.txt).
// На каждом split_lines: первый ключ — alpha 0 и сдвиг (offset_x/offset_y) относительно второго, classic tween; ступень слоёв — layer_stagger.
// В каждом символе текст сохраняет число строк и переносы: остаётся только «своя» строка, остальные слоты пустые (как удалить нижние/верхние строки, сохранив сетку).
// Выравнивание, позиция/rotation/scale и отступы с исходного поля (без принудительного width/height).
// Первый текст на таймлайне символа: обход слоёв сверху вниз (индекс 0 → length-1), первый ключ кадра 0.

// Сдвиг по X между копиями (0 = все в одной точке, как исходный instance)
var HORIZONTAL_STEP_PX = 0;
// Переопределяются из split_lines_animation.txt в main()
var FADE_TWEEN_LENGTH_FRAMES = 20;
var SPLIT_LINE_LAYER_FRAME_STAGGER = 3;
var FADE_FIRST_KEY_OFFSET_X_PX = 0;
var FADE_FIRST_KEY_OFFSET_Y_PX = 16;
// Classic tween easing: -100..100 или ease / linear / easeIn / easeOut / easeInOut
var FADE_TWEEN_EASE = 0;

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try {
    var scriptDir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    FLfile.write(scriptDir + '/status.txt', text);
  } catch(e) {}
  return text;
}

function trimCfgLine(s){
  try { return String(s).replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, ''); } catch(e) { return String(s); }
}

function parseNumberSafe(s, def){
  var n = parseFloat(String(s).replace(/,/g, '.'));
  if (isNaN(n)) return def;
  return n;
}

function clampEaseNumber(n){
  if (typeof n !== 'number' || isNaN(n)) return 0;
  if (n < -100) return -100;
  if (n > 100) return 100;
  return n;
}

function parseEaseConfigValue(raw){
  if (raw == null || raw === '') return 0;
  var s = trimCfgLine(String(raw));
  if (!s.length) return 0;
  var low = s.toLowerCase();
  if (low === 'linear' || low === 'none') return 0;
  if (low === 'easein' || low === 'ease-in' || low === 'ease_in') return -100;
  if (low === 'easeout' || low === 'ease-out' || low === 'ease_out') return 100;
  if (low === 'easeinout' || low === 'ease-in-out' || low === 'ease_in_out') return 0;
  return clampEaseNumber(parseFloat(s));
}

// split_lines_animation.txt: offset_x, offset_y, tween_frames, ease, layer_stagger (key=value)
function readSplitLinesAnimationConfig(logs){
  function log(m){ try{ logs.push(String(m)); }catch(e){} }
  var out = {
    offset_x: FADE_FIRST_KEY_OFFSET_X_PX,
    offset_y: FADE_FIRST_KEY_OFFSET_Y_PX,
    tween_frames: FADE_TWEEN_LENGTH_FRAMES,
    ease: FADE_TWEEN_EASE,
    layer_stagger: SPLIT_LINE_LAYER_FRAME_STAGGER
  };
  try {
    var scriptDir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    var cfgURI = scriptDir + '/split_lines_animation.txt';
    if (!FLfile.exists(cfgURI)) {
      log("split_lines_animation.txt: нет файла — дефолты (offset "+out.offset_x+","+out.offset_y+", tween "+out.tween_frames+", ease "+out.ease+", stagger "+out.layer_stagger+")");
      return out;
    }
    var txt = FLfile.read(cfgURI);
    if (txt == null || !String(txt).length) {
      log("split_lines_animation.txt: пусто — дефолты");
      return out;
    }
    var lines = String(txt).split(/\r\n|\r|\n/);
    var li, line, eq, k, v;
    for (li = 0; li < lines.length; li++) {
      line = trimCfgLine(lines[li]);
      if (!line.length || line.charAt(0) === '#') continue;
      eq = line.indexOf('=');
      if (eq < 1) continue;
      k = trimCfgLine(line.substr(0, eq)).toLowerCase().replace(/-/g, '_');
      v = trimCfgLine(line.substr(eq + 1));
      if (k === 'offset_x') out.offset_x = parseNumberSafe(v, out.offset_x);
      else if (k === 'offset_y') out.offset_y = parseNumberSafe(v, out.offset_y);
      else if (k === 'tween_frames') out.tween_frames = Math.max(1, Math.round(parseNumberSafe(v, out.tween_frames)));
      else if (k === 'ease') out.ease = parseEaseConfigValue(v);
      else if (k === 'layer_stagger') out.layer_stagger = Math.max(0, Math.round(parseNumberSafe(v, out.layer_stagger)));
    }
    log("split_lines_animation.txt: offset "+out.offset_x+","+out.offset_y+"px, tween "+out.tween_frames+" кадр., ease "+out.ease+", stagger "+out.layer_stagger);
  } catch(e) {
    log("split_lines_animation.txt: "+e+" — дефолты");
  }
  return out;
}

function applySplitLinesAnimationGlobals(cfg){
  if (!cfg) return;
  FADE_FIRST_KEY_OFFSET_X_PX = cfg.offset_x;
  FADE_FIRST_KEY_OFFSET_Y_PX = cfg.offset_y;
  FADE_TWEEN_LENGTH_FRAMES = cfg.tween_frames;
  FADE_TWEEN_EASE = clampEaseNumber(cfg.ease);
  SPLIT_LINE_LAYER_FRAME_STAGGER = cfg.layer_stagger;
}

function trimString(s){
  try { return String(s).replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, ''); } catch(e) { return String(s); }
}

function getRootBaseName(name){
  try {
    var m = name.match(/^(.*?)(?: copy(?: \d+)?)?$/);
    if (m && typeof m[1] === 'string' && m[1].length) return m[1];
  } catch(e) {}
  return name;
}

function findLatestCopyName(lib, base){
  var best = null; var bestIdx = -1; var i, nm;
  try {
    if (!lib || !lib.items) return null;
    for (i=0;i<lib.items.length;i++){
      nm = lib.items[i].name;
      if (nm == base + " copy") { if (bestIdx < 1) { best = nm; bestIdx = 1; } }
      else if (nm.indexOf(base + " copy ") === 0){
        var tail = nm.substr((base + " copy ").length);
        var n = parseInt(tail, 10);
        if (!isNaN(n) && n > bestIdx){ bestIdx = n; best = nm; }
      }
    }
  } catch(e){}
  return best;
}

function splitLines(s){
  try { return String(s).split(/\r\n|\r|\n/); } catch(e) { return []; }
}

function countNonEmpty(lines){
  var n = 0, i;
  for (i=0;i<lines.length;i++){
    if (trimString(lines[i]).length) n++;
  }
  return n;
}

// N строк как в оригинале: в позиции keepIndex — исходный фрагмент, в остальных — пусто; склейка через \r (как в классическом тексте Animate).
function buildTextPreserveLineSlots(lines, keepIndex){
  var N = lines.length;
  var parts = [];
  var j;
  for (j = 0; j < N; j++) {
    parts.push(j === keepIndex ? String(lines[j]) : "");
  }
  return parts.join("\r");
}

function isTextLikeElement(el){
  try {
    if (!el) return false;
    if (el.elementType === 'text') return true;
    if (typeof el.getTextString === 'function' && typeof el.setTextString === 'function') return true;
  } catch(e) {}
  return false;
}

function getText(el){
  try { if (el && typeof el.getTextString === 'function') return el.getTextString(); } catch(e0) {}
  try { if (el && typeof el.textString === 'string') return el.textString; } catch(e1) {}
  return null;
}

function setText(el, s){
  try {
    if (el && typeof el.setTextString === 'function') { el.setTextString(String(s)); return true; }
  } catch(e0) {}
  try {
    if (el && typeof el.textString === 'string') { el.textString = String(s); return true; }
  } catch(e1) {}
  return false;
}

// Выравнивание абзаца: left | center | right | justify (как в getTextAttr для классического текста)
function readTextAlignment(el){
  var attrs = ["alignment", "align"];
  var ai;
  try {
    if (el && typeof el.getTextAttr === 'function') {
      for (ai = 0; ai < attrs.length; ai++) {
        try {
          var a = el.getTextAttr(attrs[ai], 0);
          if (a != null && String(a).length) return String(a).toLowerCase();
        } catch(eA) {}
      }
    }
  } catch(e0) {}
  try {
    if (el && el.textAlign != null && String(el.textAlign).length) return String(el.textAlign).toLowerCase();
  } catch(e1) {}
  return null;
}

// Позиция и масштаб поля. width/height не трогаем — в Animate это часто даёт нежелательное растягивание по X (scale).
function readTextLayoutSnapshot(el){
  var snap = { marginAttrs: {} };
  try { if (el && el.left != null) snap.left = el.left; } catch(e0) {}
  try { if (el && el.top != null) snap.top = el.top; } catch(e1) {}
  try { if (el && el.rotation != null) snap.rotation = el.rotation; } catch(e4) {}
  try { if (el && el.scaleX != null) snap.scaleX = el.scaleX; } catch(eSX) {}
  try { if (el && el.scaleY != null) snap.scaleY = el.scaleY; } catch(eSY) {}
  var marginNames = ["leftMargin", "rightMargin", "indent", "blockIndent"];
  var mi;
  if (el && typeof el.getTextAttr === 'function') {
    for (mi = 0; mi < marginNames.length; mi++) {
      try {
        var mv = el.getTextAttr(marginNames[mi], 0);
        if (mv != null && !isNaN(Number(mv))) snap.marginAttrs[marginNames[mi]] = mv;
      } catch(eM) {}
    }
  }
  return snap;
}

function applyTextLayoutSnapshot(el, snap){
  if (!el || !snap) return;
  try {
    if (snap.left != null) el.left = snap.left;
    if (snap.top != null) el.top = snap.top;
  } catch(eP) {}
  try {
    if (snap.rotation != null) el.rotation = snap.rotation;
  } catch(eR) {}
  try {
    if (snap.scaleX != null) el.scaleX = snap.scaleX;
    if (snap.scaleY != null) el.scaleY = snap.scaleY;
  } catch(eSc) {}
}

function applyTextMarginAttrs(el, marginAttrs, s){
  if (!el || !marginAttrs || typeof el.setTextAttr !== 'function') return;
  var end = Math.max(0, String(s || "").length - 1);
  var key;
  for (key in marginAttrs) {
    if (!marginAttrs.hasOwnProperty(key)) continue;
    try {
      el.setTextAttr(key, marginAttrs[key], 0, end);
    } catch(e) {}
  }
}

// По абзацам (\r): иначе выравнивание на весь текст одним диапазоном даёт неверный X для center/right при пустых строках
function applyTextAlignmentPerParagraph(el, align){
  if (!el || !align) return;
  var s = getText(el);
  if (s == null) s = "";
  s = String(s);
  var parts = s.split(/\r/);
  var pos = 0;
  var li;
  var names = ["alignment", "align"];
  for (li = 0; li < parts.length; li++) {
    var part = parts[li];
    var start = pos;
    var plen = part.length;
    var end = start + (plen > 0 ? plen - 1 : 0);
    var ni;
    for (ni = 0; ni < names.length; ni++) {
      try {
        if (typeof el.setTextAttr === 'function') {
          el.setTextAttr(names[ni], align, start, end);
          break;
        }
      } catch(eN) {}
    }
    pos += plen;
    if (li < parts.length - 1) pos += 1;
  }
}

// Первый текст на кадре 0: слои сверху вниз (0, 1, …)
function findFirstTextInSymbolTimeline(dom){
  var tl = dom.getTimeline();
  if (!tl || !tl.layers) return null;
  var li, fr, j, els, el;
  for (li=0; li<tl.layers.length; li++){
    try {
      fr = tl.layers[li].frames[0];
      if (!fr) continue;
      els = fr.elements || [];
      for (j=0;j<els.length;j++){
        el = els[j];
        if (isTextLikeElement(el)) return el;
      }
    } catch(eL) {}
  }
  return null;
}

function duplicateOneMoreSymbol(sourceItem, lib, baseRoot, logs){
  function log(m){ try{ logs.push(String(m)); }catch(e){} }
  var actualName = null; var dup = null;
  try { if (sourceItem.duplicate) { dup = sourceItem.duplicate(); if (dup && dup.name) actualName = dup.name; } } catch(e0){ log("duplicate(): "+e0); }
  if (!actualName) {
    try { lib.duplicateItem(sourceItem.name); } catch(e1){ log("duplicateItem: "+e1); }
    var guess = findLatestCopyName(lib, baseRoot);
    if (guess) actualName = guess;
  }
  return actualName;
}

function assignLibraryItemToElement(el, item, itemName, logs){
  function log(m){ try{ logs.push(String(m)); }catch(e){} }
  var d = fl.getDocumentDOM();
  var done = false;
  if (item) { try { el.libraryItem = item; done = true; } catch(eLi) { log("libraryItem: "+eLi); } }
  if (!done && itemName) { try { if (el.swapSymbol) { el.swapSymbol(itemName); done = true; } } catch(eSS){ log("swapSymbol: "+eSS); } }
  if (!done && item && d) { try { if (d.swapElement) d.swapElement(item); done = true; } catch(eD){} }
  if (!done && item) { try { if (el.swapElement) el.swapElement(item); done = true; } catch(eE){} }
  return done;
}

function resolveLibraryItemByName(lib, name){
  var i;
  try {
    for (i=0;i<lib.items.length;i++){ if (lib.items[i].name === name) return lib.items[i]; }
  } catch(e) {}
  return null;
}

// В Animate/Flash символ на сцену ставится через library.addItemToDocument, а не document.addItem.
function placeLibraryItemAt(dom, itemName, libItem, x, y, logs){
  function log(m){ try{ logs.push(String(m)); }catch(e){} }
  var lib = dom.library;
  var path = itemName;
  try { if (libItem && libItem.name) path = libItem.name; } catch(eP) {}
  if (!lib || typeof lib.addItemToDocument !== 'function') {
    log("library.addItemToDocument недоступен");
    return false;
  }
  try {
    lib.addItemToDocument({ x: x, y: y }, path);
    return true;
  } catch (e1) {
    log("addItemToDocument {x,y}+path: "+e1);
  }
  try {
    lib.selectItem(path);
    lib.addItemToDocument({ x: x, y: y });
    return true;
  } catch (e2) {
    log("addItemToDocument после selectItem: "+e2);
  }
  try {
    lib.addItemToDocument({ left: x, top: y }, path);
    return true;
  } catch (e3) {
    log("addItemToDocument {left,top}: "+e3);
  }
  return false;
}

function getKeyframeStart(layer, frameIndex){
  try {
    var f = layer.frames[frameIndex];
    if (!f) return frameIndex;
    var s = f.startFrame;
    if (typeof s === 'number') return s;
  } catch(e) {}
  return frameIndex;
}

function getElementMatrix(el){
  try { if (el && typeof el.getMatrix === 'function') return el.getMatrix(); } catch(e0) {}
  try { if (el && el.matrix) return el.matrix; } catch(e1) {}
  return null;
}

function cloneMatrix(m){
  if (!m) return null;
  try {
    return { a: m.a, b: m.b, c: m.c, d: m.d, tx: m.tx, ty: m.ty };
  } catch(e) { return m; }
}

// Умножение аффинных 2×3 как у Flash: p' = A * (B * p)
function multiplyAffine(A, B){
  return {
    a: A.a * B.a + A.c * B.b,
    b: A.b * B.a + A.d * B.b,
    c: A.a * B.c + A.c * B.d,
    d: A.b * B.c + A.d * B.d,
    tx: A.a * B.tx + A.c * B.ty + A.tx,
    ty: A.b * B.tx + A.d * B.ty + A.ty
  };
}

// Сдвиг экземпляра в координатах сцены/родителя: весь объект вместе с регистрацией (не «от точки трансформации»)
function translateDocMatrix(dx, dy){
  return { a: 1, b: 0, c: 0, d: 1, tx: dx, ty: dy };
}

function transformPoint(m, pt){
  if (!m || !pt) return null;
  return {
    x: m.a * pt.x + m.c * pt.y + m.tx,
    y: m.b * pt.x + m.d * pt.y + m.ty
  };
}

function invertMatrix(m){
  try {
    var det = m.a * m.d - m.b * m.c;
    if (!det) return null;
    var invDet = 1 / det;
    return {
      a:  m.d * invDet,
      b: -m.b * invDet,
      c: -m.c * invDet,
      d:  m.a * invDet,
      tx: (m.c * m.ty - m.d * m.tx) * invDet,
      ty: (m.b * m.tx - m.a * m.ty) * invDet
    };
  } catch(e) { return null; }
}

// Точка трансформации в координатах родителя: doc + (dx,dy) → локальные координаты для setTransformationPoint
function syncTransformationPointDocDelta(el, tpLocal, mBefore, mAfter, dx, dy, log){
  function logf(msg){ try{ if (log) log(msg); }catch(e){} }
  if (!el || !tpLocal || !mBefore || !mAfter) return;
  if (!dx && !dy) return;
  try {
    if (typeof el.setTransformationPoint !== 'function') return;
    var docWas = transformPoint(mBefore, tpLocal);
    if (!docWas) return;
    var docTar = { x: docWas.x + (typeof dx === 'number' ? dx : 0), y: docWas.y + (typeof dy === 'number' ? dy : 0) };
    var inv = invertMatrix(mAfter);
    if (!inv) return;
    var tpNew = transformPoint(inv, docTar);
    if (tpNew) el.setTransformationPoint(tpNew);
  } catch(e) { logf("fade: sync anchor TP: "+e); }
}

function setElementMatrix(el, m){
  if (!el || !m) return false;
  try { if (typeof el.setMatrix === 'function') { el.setMatrix(m); return true; } } catch(e0) {}
  try { el.matrix = m; return true; } catch(e1) {}
  return false;
}

function setInstanceAlphaPercent(el, pct){
  if (!el) return false;
  var p = Math.max(0, Math.min(100, Number(pct)));
  try {
    el.colorMode = "alpha";
    el.colorAlphaPercent = p;
    return true;
  } catch(e0) {}
  try {
    el.colorMode = "advanced";
    el.colorAlphaPercent = p;
    return true;
  } catch(e1) {}
  return false;
}

// Нужны кадры с индексами 0..lastIndex включительно
function ensureMinFrameCount(tl, lastFrameIndex){
  try {
    var fc = tl.frameCount | 0;
    if (fc > lastFrameIndex) return;
    var add = lastFrameIndex + 1 - fc;
    if (add <= 0) return;
    try {
      tl.currentFrame = Math.max(0, fc - 1);
      tl.insertFrames(add, true);
    } catch(eIns) {
      try { tl.insertFrames(add, true); } catch(eIns2) {}
    }
  } catch(e) {}
}

// Перенос содержимого одного кадра слоя с fromFrame на toFrame (addItemToDocument часто кладёт символ на 0 вместо currentFrame)
function moveLayerKeyframeContentToFrame(dom, tl, layerIndex, fromFrame, toFrame, logs){
  function log(m){ try{ logs.push(String(m)); }catch(e){} }
  if (fromFrame === toFrame) return true;
  if (fromFrame < 0 || toFrame < 0) return false;
  try {
    ensureMinFrameCount(tl, Math.max(toFrame, fromFrame) + FADE_TWEEN_LENGTH_FRAMES + 2);
    dom = fl.getDocumentDOM();
    tl = dom.getTimeline();
    var lyrM = tl.layers[layerIndex];
    if (lyrM && lyrM.locked) lyrM.locked = false;
    tl.setSelectedLayers(layerIndex);
    tl.currentLayer = layerIndex;
    tl.setSelectedFrames(fromFrame, fromFrame, true);
    tl.currentFrame = fromFrame;
    if (typeof tl.cutFrames !== 'function') {
      log("move keyframe: cutFrames недоступен");
      return false;
    }
    tl.cutFrames();
    tl.setSelectedLayers(layerIndex);
    tl.currentLayer = layerIndex;
    tl.currentFrame = toFrame;
    if (typeof tl.convertToKeyframes === 'function') {
      tl.convertToKeyframes(toFrame, toFrame);
    }
    tl.setSelectedFrames(toFrame, toFrame, true);
    if (typeof tl.pasteFrames !== 'function') {
      log("move keyframe: pasteFrames недоступен");
      return false;
    }
    tl.pasteFrames();
    dom = fl.getDocumentDOM();
    return true;
  } catch(e) {
    try { log("move keyframe: "+e); } catch(e2) {}
    return false;
  }
}

// Индекс кадра, на котором начинается ключ с данным элементом (для copyFrames = фактический первый ключ после addItemToDocument)
function findFrameIndexOfElementOnLayer(layer, el){
  if (!layer || !el) return -1;
  var frames = layer.frames;
  if (!frames) return -1;
  var n = 0;
  try { n = frames.length | 0; } catch(e) { return -1; }
  var fi, fr, j, els;
  for (fi = 0; fi < n; fi++) {
    try {
      fr = frames[fi];
      if (!fr) continue;
      var sf = fr.startFrame;
      if (typeof sf !== 'number' || sf !== fi) continue;
      els = fr.elements || [];
      for (j = 0; j < els.length; j++) {
        if (els[j] === el) return fi;
      }
    } catch(e2) {}
  }
  for (fi = 0; fi < n; fi++) {
    try {
      fr = frames[fi];
      if (!fr) continue;
      els = fr.elements || [];
      for (j = 0; j < els.length; j++) {
        if (els[j] === el) return fi;
      }
    } catch(e3) {}
  }
  return -1;
}

function getFirstInstanceOnLayerAtFrame(dom, layerIndex, frameIndex){
  var tl = dom.getTimeline();
  var layer = tl.layers[layerIndex];
  if (!layer) return null;
  var fr = null;
  try { fr = layer.frames[frameIndex]; } catch(e0) {}
  // Предпочесть ключ, который начинается ровно на frameIndex (иначе span с пустого кадра 0 даёт startFrame=0 и пустые elements)
  if (fr) {
    var sf = fr.startFrame;
    if (typeof sf === 'number' && sf === frameIndex) {
      var els0 = fr.elements || [];
      var j0, e0;
      for (j0 = 0; j0 < els0.length; j0++) {
        e0 = els0[j0];
        try {
          if (e0 && e0.elementType === 'instance') return e0;
        } catch(e) {}
      }
    }
    var els1 = fr.elements || [];
    var j1, e1;
    for (j1 = 0; j1 < els1.length; j1++) {
      e1 = els1[j1];
      try {
        if (e1 && e1.elementType === 'instance') return e1;
      } catch(e2) {}
    }
  }
  var kf = getKeyframeStart(layer, frameIndex);
  fr = layer.frames[kf];
  if (!fr) return null;
  var els = fr.elements || [];
  var j, el;
  for (j = 0; j < els.length; j++) {
    el = els[j];
    try {
      if (el && el.elementType === 'instance') return el;
    } catch(e) {}
  }
  return null;
}

function applySplitLineFadeTween(dom, tl, layerIndex, startFrame, logs, placedInstanceOpt){
  function log(m){ try{ logs.push(String(m)); }catch(e){} }
  var L = FADE_TWEEN_LENGTH_FRAMES;
  var endFrame = startFrame + L;
  try {
    var lyr = tl.layers[layerIndex];
    if (lyr && lyr.locked) lyr.locked = false;
  } catch(eL) {}

  ensureMinFrameCount(tl, endFrame);
  dom = fl.getDocumentDOM();
  tl = dom.getTimeline();

  var el0 = null;
  try {
    if (placedInstanceOpt && placedInstanceOpt.elementType === 'instance') el0 = placedInstanceOpt;
  } catch(ePl) {}
  if (!el0) el0 = getFirstInstanceOnLayerAtFrame(dom, layerIndex, startFrame);
  if (!el0) {
    log("fade: нет instance на кадре "+startFrame);
    return;
  }
  var origLeft = el0.left;
  var origTop = el0.top;
  var m0 = getElementMatrix(el0);
  var origMatrix = m0 ? cloneMatrix(m0) : null;
  var tp0 = null;
  var mBeforeTP = null;
  try { if (el0.getTransformationPoint) tp0 = el0.getTransformationPoint(); } catch(eTP0) {}
  try { mBeforeTP = origMatrix ? cloneMatrix(origMatrix) : cloneMatrix(getElementMatrix(el0)); } catch(eMB) {}

  if (FADE_FIRST_KEY_OFFSET_X_PX || FADE_FIRST_KEY_OFFSET_Y_PX) {
    var dxOff = FADE_FIRST_KEY_OFFSET_X_PX;
    var dyOff = FADE_FIRST_KEY_OFFSET_Y_PX;
    var offsetOk = false;
    if (origMatrix) {
      try {
        var Toff = translateDocMatrix(dxOff, dyOff);
        var mFirst = multiplyAffine(Toff, origMatrix);
        if (setElementMatrix(el0, mFirst)) offsetOk = true;
      } catch(eOffM) {
        log("fade: T*M offset: "+eOffM);
      }
    }
    if (!offsetOk) {
      try {
        dom.selectNone();
        dom.selection = [el0];
        tl.setSelectedLayers(layerIndex);
        tl.setSelectedFrames(startFrame, startFrame, true);
        tl.currentFrame = startFrame;
        dom = fl.getDocumentDOM();
        tl = dom.getTimeline();
        if (typeof dom.moveSelectionBy === 'function') {
          dom.moveSelectionBy({ x: dxOff, y: dyOff });
          offsetOk = true;
        }
      } catch(eMove) {
        log("fade: moveSelectionBy: "+eMove);
      }
    }
    if (!offsetOk) {
      try { el0.left = origLeft + dxOff; el0.top = origTop + dyOff; } catch(eOff) { log("fade: offset left/top: "+eOff); }
    }
    dom = fl.getDocumentDOM();
    tl = dom.getTimeline();
    try {
      el0 = placedInstanceOpt || getFirstInstanceOnLayerAtFrame(dom, layerIndex, startFrame) || el0;
    } catch(eRe) {}
    try {
      var mAfterTP = getElementMatrix(el0);
      if (tp0 && mBeforeTP && mAfterTP) syncTransformationPointDocDelta(el0, tp0, mBeforeTP, mAfterTP, dxOff, dyOff, log);
    } catch(eSync) {}
  }
  if (!setInstanceAlphaPercent(el0, 0)) log("fade: alpha 0 не применён");

  try {
    dom.selectNone();
    dom.selection = [el0];
  } catch(eSel0) {}

  try {
    tl.setSelectedLayers(layerIndex);
    tl.setSelectedFrames(startFrame, startFrame, true);
    tl.copyFrames();
  } catch(eC) {
    log("copyFrames: "+eC);
    return;
  }

  try {
    tl.setSelectedLayers(layerIndex);
    tl.currentFrame = endFrame;
    if (typeof tl.convertToKeyframes === 'function') {
      tl.convertToKeyframes(endFrame, endFrame);
    }
  } catch(eK) {
    log("convertToKeyframes: "+eK);
  }

  try {
    tl.setSelectedLayers(layerIndex);
    tl.setSelectedFrames(endFrame, endFrame, true);
    tl.pasteFrames();
  } catch(eP) {
    log("pasteFrames: "+eP);
    return;
  }

  dom = fl.getDocumentDOM();
  tl = dom.getTimeline();
  try { tl.currentFrame = endFrame; } catch(eCF) {}
  var el1 = getFirstInstanceOnLayerAtFrame(dom, layerIndex, endFrame);
  if (el1) {
    try {
      if (origMatrix) {
        if (!setElementMatrix(el1, cloneMatrix(origMatrix))) {
          try { el1.left = origLeft; el1.top = origTop; } catch(ePos1) { log("fade: позиция 2-го ключа: "+ePos1); }
        }
      } else {
        try { el1.left = origLeft; el1.top = origTop; } catch(ePos2) { log("fade: позиция 2-го ключа: "+ePos2); }
      }
    } catch(ePosAll) {
      log("fade: позиция 2-го ключа: "+ePosAll);
    }
    try {
      if (tp0 && origMatrix && el1.setTransformationPoint) {
        var invR = invertMatrix(origMatrix);
        if (invR) {
          var dRest = transformPoint(origMatrix, tp0);
          var tpR = transformPoint(invR, dRest);
          if (tpR) el1.setTransformationPoint(tpR);
        }
      }
    } catch(eTP1) {}
    if (!setInstanceAlphaPercent(el1, 100)) log("fade: alpha 100 не применён");
  } else {
    log("fade: нет instance на кадре "+endFrame);
  }

  try {
    tl.setSelectedLayers(layerIndex);
    // Оба ключевых кадра (первый и второй) должны входить в выделение — иначе classic tween/easing задаются некорректно.
    tl.setSelectedFrames(startFrame, endFrame, true);
    if (typeof tl.createMotionTween === 'function') {
      tl.createMotionTween();
    }
    try {
      dom = fl.getDocumentDOM();
      tl = dom.getTimeline();
      var lyrEase = tl.layers[layerIndex];
      var kfEase = lyrEase ? getKeyframeStart(lyrEase, startFrame) : startFrame;
      var frEase = lyrEase && lyrEase.frames ? lyrEase.frames[kfEase] : null;
      if (frEase && typeof FADE_TWEEN_EASE === 'number') {
        var ez = clampEaseNumber(FADE_TWEEN_EASE);
        frEase.tweenEasing = ez;
      }
    } catch(eEase) {
      log("fade: tweenEasing: "+eEase);
    }
  } catch(eT) {
    log("createMotionTween: "+eT);
    try {
      var fr = tl.layers[layerIndex].frames[startFrame];
      if (fr) fr.tweenType = "motion";
    } catch(eF) { log("tweenType motion: "+eF); }
  }
}

function findInstanceAtLayerFrame(dom, layerIndex, frameIndex, itemName, approxLeft, approxTop){
  var tl = dom.getTimeline();
  var layer = tl.layers[layerIndex];
  if (!layer) return null;
  var kf = getKeyframeStart(layer, frameIndex);
  var fr = layer.frames[kf];
  if (!fr) return null;
  var els = fr.elements || [];
  var j, el, best = null, bestD = 1e12;
  for (j=0;j<els.length;j++){
    el = els[j];
    try {
      if (!el || el.elementType !== 'instance' || !el.libraryItem) continue;
      if (el.libraryItem.name !== itemName) continue;
      var lx = el.left; var ly = el.top;
      var d = Math.abs(lx - approxLeft) + Math.abs(ly - approxTop);
      if (d < bestD) { bestD = d; best = el; }
    } catch(e) {}
  }
  return best;
}

function main(){
  var dom = fl.getDocumentDOM();
  if (!dom) return writeStatusAndReturn("Нет открытого документа", []);
  var logs = []; function log(m){ try{ logs.push(String(m)); }catch(e){} }
  applySplitLinesAnimationGlobals(readSplitLinesAnimationConfig(logs));

  var tl = dom.getTimeline();
  if (!tl) return writeStatusAndReturn("Нет таймлайна", logs);

  var sel = [];
  try { sel = dom.selection || []; } catch(eS) { sel = []; }
  var inst = null;
  if (sel && sel.length){
    try {
      if (sel[0].elementType === 'instance' && sel[0].libraryItem) inst = sel[0];
    } catch(eI) {}
  }
  if (!inst){
    var layer = tl.layers[tl.currentLayer];
    if (!layer) return writeStatusAndReturn("Нет активного слоя", logs);
    var cf = tl.currentFrame|0;
    var kf = getKeyframeStart(layer, cf);
    var fr = layer.frames[kf];
    var j, el;
    if (fr && fr.elements){
      for (j=0;j<fr.elements.length;j++){
        el = fr.elements[j];
        if (el && el.elementType === 'instance' && el.libraryItem) { inst = el; break; }
      }
    }
    if (!inst) return writeStatusAndReturn("Выделите movie clip на сцене или поставьте кадр на ключ с instance", logs);
    log("instance взят с активного слоя (не из selection)");
  }

  var sourceItem = inst.libraryItem;
  if (!sourceItem) return writeStatusAndReturn("Нет libraryItem у выделения", logs);
  try {
    var it = sourceItem.itemType || '';
    if (it && String(it).toLowerCase().indexOf('movie') < 0 && String(it).toLowerCase().indexOf('mc') < 0){
      log("itemType: "+it+" (ожидается movie clip)");
    }
  } catch(eT) {}

  var srcLayer = tl.currentLayer|0;
  var srcFrame = tl.currentFrame|0;
  var srcLeft = inst.left; var srcTop = inst.top;
  var sourceName = sourceItem.name;
  var baseRoot = getRootBaseName(sourceName);
  var lib = dom.library;

  // Чтение текста внутри символа
  try { lib.editItem(sourceName); dom = fl.getDocumentDOM(); } catch(eEdit){
    return writeStatusAndReturn("Не удалось открыть символ для редактирования: "+eEdit, logs);
  }
  var textEl = findFirstTextInSymbolTimeline(dom);
  if (!textEl) {
    try { dom.exitEditMode(); } catch(eX) {}
    fl.getDocumentDOM();
    return writeStatusAndReturn("Внутри символа не найден текстовый элемент на кадре 0", logs);
  }
  var raw = getText(textEl);
  if (raw == null) {
    try { dom.exitEditMode(); } catch(eX2) {}
    fl.getDocumentDOM();
    return writeStatusAndReturn("Не удалось прочитать текст", logs);
  }
  var lines = splitLines(raw);
  if (lines.length < 2) {
    try { dom.exitEditMode(); } catch(eX3) {}
    fl.getDocumentDOM();
    return writeStatusAndReturn("В тексте меньше двух строк (нужна многострочность)", logs);
  }
  if (countNonEmpty(lines) < 2) {
    try { dom.exitEditMode(); } catch(eX4) {}
    fl.getDocumentDOM();
    return writeStatusAndReturn("Нужно минимум две непустые строки", logs);
  }

  var savedAlign = readTextAlignment(textEl);
  if (savedAlign) log("alignment: "+savedAlign);
  var savedLayout = readTextLayoutSnapshot(textEl);
  try {
    var tlog = "text field @ "+savedLayout.left+","+savedLayout.top;
    if (savedLayout.scaleX != null && savedLayout.scaleY != null) tlog += " scale "+savedLayout.scaleX+","+savedLayout.scaleY;
    log(tlog);
  } catch(eLg) {}

  try { dom.exitEditMode(); } catch(eEx) { log("exitEditMode: "+eEx); }
  dom = fl.getDocumentDOM();
  tl = dom.getTimeline();

  // Восстановить выделение на исходный instance
  var inst2 = findInstanceAtLayerFrame(dom, srcLayer, srcFrame, sourceName, srcLeft, srcTop);
  if (!inst2) {
    try { dom.selectNone(); } catch(e0) {}
    try { if (inst) dom.selection = [inst]; } catch(e1) {}
      inst2 = dom.selection && dom.selection.length ? dom.selection[0] : null;
  }
  if (!inst2) return writeStatusAndReturn("Не удалось снова найти исходный экземпляр на таймлайне", logs);

  // Трансформ исходного MC: addItemToDocument ставит по другой точке (регистрация), без setMatrix копии «уезжают»
  var savedMatrix = cloneMatrix(getElementMatrix(inst2));
  if (savedMatrix) log("сохранена матрица instance");

  // N копий символа в библиотеке (первый — исходный)
  var N = lines.length;
  var itemNames = [sourceName];
  var d;
  for (d = 1; d < N; d++){
    var nm = duplicateOneMoreSymbol(sourceItem, lib, baseRoot, logs);
    if (!nm) return writeStatusAndReturn("Не удалось создать дубликат символа ("+d+")", logs);
    itemNames.push(nm);
    log("dup "+d+": "+nm);
  }

  // Подмена текста в каждом символе
  var idx;
  for (idx = 0; idx < N; idx++){
    lib = dom.library;
    try { lib.editItem(itemNames[idx]); dom = fl.getDocumentDOM(); } catch(eEd){
      return writeStatusAndReturn("editItem "+itemNames[idx]+": "+eEd, logs);
    }
    var te = findFirstTextInSymbolTimeline(dom);
    if (!te) {
      try { dom.exitEditMode(); } catch(e2) {}
      fl.getDocumentDOM();
      return writeStatusAndReturn("Нет текста в символе "+itemNames[idx], logs);
    }
    var builtText = buildTextPreserveLineSlots(lines, idx);
    if (!setText(te, builtText)) {
      try { dom.exitEditMode(); } catch(e3) {}
      fl.getDocumentDOM();
      return writeStatusAndReturn("Не удалось записать текст в "+itemNames[idx], logs);
    }
    applyTextLayoutSnapshot(te, savedLayout);
    applyTextMarginAttrs(te, savedLayout.marginAttrs, getText(te));
    applyTextAlignmentPerParagraph(te, savedAlign);
    try { dom.exitEditMode(); } catch(e4) {}
    dom = fl.getDocumentDOM();
  }

  tl = dom.getTimeline();
  // Слой с исходным instance до вставки
  var layerOld = tl.layers[srcLayer];
  var wasLocked = false;
  try { wasLocked = layerOld.locked; if (wasLocked) layerOld.locked = false; } catch(eLk) {}

  // N новых слоёв над слоем с instance: каждый addNewLayer(..., true) — над текущим слоем инстанса;
  // индекс слоя с исходным MC после каждой вставки: srcLayer+1, srcLayer+2, … srcLayer+N.
  var instLayerIdx = srcLayer;
  var ai;
  for (ai = 0; ai < N; ai++) {
    try {
      tl.currentLayer = instLayerIdx;
      tl.addNewLayer("split_lines_" + (ai + 1), "normal", true);
    } catch(eAdd) {
      try {
        tl.currentLayer = instLayerIdx;
        tl.addNewLayer("split_lines_" + (ai + 1));
      } catch(eAdd2) {
        if (wasLocked) try { layerOld.locked = true; } catch(eR) {}
        return writeStatusAndReturn("addNewLayer: "+eAdd+" / "+eAdd2, logs);
      }
    }
    dom = fl.getDocumentDOM();
    tl = dom.getTimeline();
    instLayerIdx = srcLayer + ai + 1;
  }
  var instanceLayerIdx = srcLayer + N;
  try { layerOld = tl.layers[instanceLayerIdx]; } catch(eLay) { layerOld = null; }

  var placeFrame = getKeyframeStart(layerOld, srcFrame);

  if (N > 0) {
    var maxLastFrame = placeFrame + (N - 1) * SPLIT_LINE_LAYER_FRAME_STAGGER + FADE_TWEEN_LENGTH_FRAMES;
    ensureMinFrameCount(tl, maxLastFrame);
    dom = fl.getDocumentDOM();
    tl = dom.getTimeline();
  }

  // Размещение: по одному экземпляру на слой; затем та же матрица, что у исходного instance
  var i, x0 = srcLeft, y0 = srcTop;
  for (i=0;i<N;i++){
    var itItem = resolveLibraryItemByName(dom.library, itemNames[i]);
    var px = x0 + i * HORIZONTAL_STEP_PX;
    var py = y0;
    var targetLayerIdx = srcLayer + i;
    var lineStartFrame = placeFrame + i * SPLIT_LINE_LAYER_FRAME_STAGGER;
    dom = fl.getDocumentDOM();
    tl = dom.getTimeline();
    try {
      tl.setSelectedLayers(targetLayerIdx);
      tl.currentLayer = targetLayerIdx;
      tl.setSelectedFrames(lineStartFrame, lineStartFrame, true);
      tl.currentFrame = lineStartFrame;
    } catch(eTL) {}
    if (!placeLibraryItemAt(dom, itemNames[i], itItem, px, py, logs)) {
      try {
        if (layerOld && wasLocked) layerOld.locked = true;
      } catch(eR2) {}
      return writeStatusAndReturn("library.addItemToDocument не удалось — разместите символы вручную", logs);
    }
    dom = fl.getDocumentDOM();
    var selAfter = dom.selection;
    if (selAfter && selAfter.length && selAfter[0].elementType === 'instance'){
      var placed = selAfter[0];
      if (itItem && !assignLibraryItemToElement(placed, itItem, itemNames[i], logs)){
        log("предупреждение: не удалось назначить символ для "+i);
      }
      if (savedMatrix) {
        if (!setElementMatrix(placed, cloneMatrix(savedMatrix))) {
          try { placed.left = px; placed.top = py; } catch(ePos) { log("left/top fallback: "+ePos); }
        }
      } else {
        try { placed.left = px; placed.top = py; } catch(ePos2) { log("left/top: "+ePos2); }
      }
      dom = fl.getDocumentDOM();
      tl = dom.getTimeline();
      var effectiveStartFrame = lineStartFrame;
      try {
        var lyrPl = tl.layers[targetLayerIdx];
        var ff = findFrameIndexOfElementOnLayer(lyrPl, placed);
        if (typeof ff === 'number' && ff >= 0) {
          if (ff !== lineStartFrame) {
            log("слой "+(i+1)+": символ на кадре "+ff+", перенос ключа на "+lineStartFrame);
            if (moveLayerKeyframeContentToFrame(dom, tl, targetLayerIdx, ff, lineStartFrame, logs)) {
              dom = fl.getDocumentDOM();
              tl = dom.getTimeline();
              var placedMoved = getFirstInstanceOnLayerAtFrame(dom, targetLayerIdx, lineStartFrame);
              if (!placedMoved) {
                try {
                  var sM = dom.selection;
                  if (sM && sM.length && sM[0].elementType === 'instance') placedMoved = sM[0];
                } catch(eSM) {}
              }
              if (placedMoved) placed = placedMoved;
              effectiveStartFrame = lineStartFrame;
            } else {
              effectiveStartFrame = ff;
              log("слой "+(i+1)+": перенос не удался, fade с кадра "+ff);
            }
          } else {
            effectiveStartFrame = ff;
          }
        } else {
          log("слой "+(i+1)+": не найден кадр для placed — используем "+lineStartFrame);
        }
      } catch(eFF) {
        try { log("findFrameIndexOfElementOnLayer: "+eFF); } catch(eL) {}
      }
      try {
        applySplitLineFadeTween(dom, tl, targetLayerIdx, effectiveStartFrame, logs, placed);
      } catch(eFade) {
        try { log("fade tween: "+eFade); } catch(eL2) {}
      }
    }
  }

  // Удалить исходный instance со старого слоя (после вставки — индекс +1)
  try {
    var delL = tl.layers[instanceLayerIdx];
    if (delL && delL.locked) delL.locked = false;
  } catch(eUL) {}
  try { tl.setSelectedLayers(instanceLayerIdx); } catch(eS2) {}
  try { tl.currentLayer = instanceLayerIdx; } catch(eS3) {}
  try { tl.currentFrame = placeFrame; } catch(eS4) {}
  dom = fl.getDocumentDOM();
  tl = dom.getTimeline();
  var toDelete = findInstanceAtLayerFrame(dom, instanceLayerIdx, srcFrame, sourceName, srcLeft, srcTop);
  if (toDelete){
    try { dom.selectNone(); dom.selection = [toDelete]; } catch(eD1) {}
    try { if (dom.deleteSelection) dom.deleteSelection(); } catch(eDel){ log("deleteSelection: "+eDel); }
  } else {
    log("исходный экземпляр не найден для удаления (проверьте вручную)");
  }

  if (wasLocked) {
    try {
      var lyrLock = tl.layers[instanceLayerIdx];
      if (lyrLock) lyrLock.locked = true;
    } catch(eWL) {}
  }

  return writeStatusAndReturn(
    "Готово: "+N+" строк → "+N+" символов, слои split_lines_1…"+N+(HORIZONTAL_STEP_PX ? ", сдвиг X "+HORIZONTAL_STEP_PX+"px" : ", позиция как у исходного (matrix)")+", fade 0→100 classic tween "+FADE_TWEEN_LENGTH_FRAMES+" кадр., ease "+FADE_TWEEN_EASE+(SPLIT_LINE_LAYER_FRAME_STAGGER ? ", слой i: +"+SPLIT_LINE_LAYER_FRAME_STAGGER+" кадр. к слою i−1" : "")+((FADE_FIRST_KEY_OFFSET_X_PX || FADE_FIRST_KEY_OFFSET_Y_PX) ? ", 1-й ключ "+FADE_FIRST_KEY_OFFSET_X_PX+","+FADE_FIRST_KEY_OFFSET_Y_PX+" px" : "")+"\n"+itemNames.join(", "),
    logs
  );
}

main();
