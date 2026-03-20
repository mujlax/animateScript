// SetAnchorByPreset.jsfl
// Устанавливает точку трансформации элементов текущего ключа активного слоя
// в один из пресетов: center, topLeft, topRight, bottomLeft, bottomRight.
// Пресет читается из файла anchor_preset.txt в этой же папке.

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try {
    var scriptDir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    var statusURI = scriptDir + '/status.txt';
    FLfile.write(statusURI, text);
  } catch(e) {}
  return text;
}

function trimString(s){
  try { return String(s).replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, ''); } catch(e){ return String(s); }
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
  } catch(e){ return null; }
}

function transformPoint(m, pt){
  return { x: m.a * pt.x + m.c * pt.y + m.tx, y: m.b * pt.x + m.d * pt.y + m.ty };
}

function docToLocal(el, ptDoc){
  try {
    var m = null;
    try { m = el.matrix; } catch(e0) {}
    if (!m && el.getMatrix) { try { m = el.getMatrix(); } catch(e1) {} }
    if (!m) return null;
    var inv = invertMatrix(m);
    if (!inv) return null;
    return transformPoint(inv, ptDoc);
  } catch(e){ return null; }
}

function readPreset(log){
  var tried = [];
  try {
    var scriptDirURI = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    var cfgURI = scriptDirURI + '/anchor_preset.txt';
    tried.push('uri=' + cfgURI);
    if (FLfile.exists(cfgURI)) {
      var txt = FLfile.read(cfgURI);
      log('uri read typeof=' + (typeof txt));
      if (txt != null) {
        txt = trimString(txt);
        if (txt && txt.length) { log('preset read (uri): ' + txt); return txt; }
      }
    }
    // Попытка прочитать по системному пути (на случай несовпадения схем)
    var platformPath = null;
    try { if (FLfile.uriToPlatformPath) { platformPath = FLfile.uriToPlatformPath(cfgURI); } } catch(e2) {}
    if (!platformPath) { platformPath = cfgURI.replace(/^file:\/\//, ''); }
    tried.push('path=' + platformPath);
    if (FLfile.exists(platformPath)) {
      var txt2 = FLfile.read(platformPath);
      log('path read typeof=' + (typeof txt2));
      if (txt2 != null) {
        txt2 = trimString(txt2);
        if (txt2 && txt2.length) { log('preset read (path): ' + txt2); return txt2; }
      }
    }
  } catch(e) { log('readPreset error: ' + e); }
  log('readPreset fallbacks tried: ' + tried.join(' | '));
  return 'center';
}

function readApplyAllFlag(log){
  try {
    var scriptDirURI = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    var allURI = scriptDirURI + '/anchor_apply_all.txt';
    if (FLfile.exists(allURI)) {
      var t = FLfile.read(allURI);
      var s = trimString(t || '');
      var on = (s === '1' || s === 'true' || s === 'TRUE');
      try { log('applyAll flag: ' + on + ' raw=' + s); } catch(eLog) {}
      return on;
    }
  } catch(e) { try { log('readApplyAllFlag error: ' + e); } catch(_) {} }
  return false;
}

function getBoundsForElement(dom, el){
  // 1) Предпочтительно: прямоугольник выделения (в координатах документа)
  try {
    dom.selectNone();
    try { dom.selection = [el]; } catch(eSel){ el.selected = true; }
    var r = dom.getSelectionRect();
    dom.selectNone();
    if (r && typeof r.left === 'number') return r;
  } catch(e0) {}
  // 2) Фоллбек: считаем через el.x/el.y и размеры
  try {
    var w = el.width, h = el.height;
    var lx = (typeof el.left === 'number') ? el.left : (typeof el.x === 'number' ? el.x : 0);
    var ty = (typeof el.top === 'number') ? el.top : (typeof el.y === 'number' ? el.y : 0);
    if (typeof w === 'number' && typeof h === 'number'){
      return { left: lx, top: ty, right: lx + w, bottom: ty + h };
    }
  } catch(e1) {}
  return null;
}

function pointByPreset(bounds, preset){
  var left = bounds.left, top = bounds.top, right = bounds.right, bottom = bounds.bottom;
  var cx = (left + right) / 2;
  var cy = (top + bottom) / 2;
  if (preset === 'stageZero') return {x:0, y:0};
  if (preset === 'topLeft') return {x:left, y:top};
  if (preset === 'topCenter') return {x:cx, y:top};
  if (preset === 'topRight') return {x:right, y:top};
  if (preset === 'middleLeft') return {x:left, y:cy};
  if (preset === 'center') return {x:cx, y:cy};
  if (preset === 'middleRight') return {x:right, y:cy};
  if (preset === 'bottomLeft') return {x:left, y:bottom};
  if (preset === 'bottomCenter') return {x:cx, y:bottom};
  if (preset === 'bottomRight') return {x:right, y:bottom};
  return {x:cx, y:cy};
}

function main(){
  var dom = fl.getDocumentDOM();
  if (!dom) { return "Нет открытого документа"; }
  var tl = dom.getTimeline(); if (!tl) { return "Нет таймлайна"; }
  var layer = tl.layers[tl.currentLayer]; if (!layer) { return "Нет активного слоя"; }

  var logs = []; function log(m){ try{ logs.push(String(m)); }catch(e){} }

  var preset = readPreset(log);
  log('preset: ' + preset);

  var applyAll = readApplyAllFlag(log);
  var moved = 0; var processedKeys = 0;

  function processFrame(frame, fi){
    processedKeys++;
    var elems = frame.elements;
    for (var i=0;i<elems.length;i++){
      var el = elems[i];
      if (!el) continue;
      try {
        var b = getBoundsForElement(dom, el);
        if (!b) { log('F'+fi+' el'+i+': no bounds'); continue; }
        if (!el.setTransformationPoint) { log('F'+fi+' el'+i+': no setTP'); continue; }
        var p = pointByPreset(b, preset);
        var localP = docToLocal(el, {x:p.x, y:p.y});
        if (!localP) { localP = { x: p.x - b.left, y: p.y - b.top }; }
        log('F'+fi+' set TP preset='+preset+' doc('+p.x+','+p.y+') local('+localP.x+','+localP.y+')');
        try { el.setTransformationPoint(localP); moved++; } catch(eSTP){ log('F'+fi+' setTP error: '+eSTP); }
      } catch(errEach){ log('F'+fi+' el'+i+' err: '+errEach); }
    }
  }

  if (applyAll){
    var frames = layer.frames;
    for (var fi=0; fi<frames.length; fi++){
      var f = frames[fi];
      if (f && f.startFrame === fi){ processFrame(f, fi); }
    }
  } else {
    var frameIndex = tl.currentFrame;
    var frame = layer.frames[frameIndex];
    if (!frame || frame.startFrame != frameIndex) {
      return writeStatusAndReturn("Текущий кадр не является ключевым", logs);
    }
    processFrame(frame, frameIndex);
  }

  return writeStatusAndReturn('Установлено точек трансформации: '+moved+' пресет: '+preset+' ключей обработано: '+processedKeys, logs);
}

// Вызов для fl.runScript
main();


