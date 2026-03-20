// CreateMaskForBitmapLayer.jsfl
// Для активного слоя с bitmap-элементами создаёт маску на новом shape-слое сверху.
// Маска — прямоугольник(и) по границам bitmap в текущем ключевом кадре.

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try { var dir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/')); FLfile.write(dir + '/status.txt', text); } catch(e){}
  return text;
}

function isBitmapElement(el){
  try { if (!el) return false; if (el.elementType === 'bitmap') return true; } catch(_){ }
  try { if (el.elementType === 'instance' && el.libraryItem && el.libraryItem.itemType === 'bitmap') return true; } catch(_){ }
  return false;
}

var cachedEditOffset = null; // смещение, которое появляется при Edit-In-Place

function cloneRect(r){
  return { left:r.left, top:r.top, right:r.right, bottom:r.bottom };
}

function rectFromElementProps(el){
  try {
    var w = el.width, h = el.height;
    var lx = (typeof el.left === 'number') ? el.left : (typeof el.x === 'number' ? el.x : null);
    var ty = (typeof el.top === 'number') ? el.top : (typeof el.y === 'number' ? el.y : null);
    if (lx === null || ty === null) return null;
    if (typeof w !== 'number' || typeof h !== 'number') return null;
    return { left: lx, top: ty, right: lx + w, bottom: ty + h };
  } catch(_){ return null; }
}

function rectFromSelection(dom, el){
  try {
    var prevSel = [];
    try { if (dom.selection && dom.selection.length){ prevSel = dom.selection.slice(0); } } catch(_ps){}
    dom.selectNone();
    try { dom.selection = [el]; } catch(eSel){ el.selected = true; }
    var r = dom.getSelectionRect();
    dom.selectNone();
    if (prevSel && prevSel.length){ try { dom.selection = prevSel; } catch(_rs){} }
    if (r && typeof r.left === 'number') { return cloneRect(r); }
  } catch(_){}
  return null;
}

function ensureEditOffset(rectDoc, rectLocal){
  if (cachedEditOffset || !rectDoc || !rectLocal) return;
  try {
    var offX = rectDoc.left - rectLocal.left;
    var offY = rectDoc.top - rectLocal.top;
    if (Math.abs(offX) > 0.05 || Math.abs(offY) > 0.05){
      cachedEditOffset = { x: offX, y: offY };
    }
  } catch(_o){}
}

function applyEditOffset(rect){
  if (!rect) return null;
  if (!cachedEditOffset){ return rect; }
  return {
    left: rect.left - cachedEditOffset.x,
    top: rect.top - cachedEditOffset.y,
    right: rect.right - cachedEditOffset.x,
    bottom: rect.bottom - cachedEditOffset.y
  };
}

function getBoundsForElement(dom, el){
  var rectLocal = rectFromElementProps(el);
  var rectDoc = rectFromSelection(dom, el);
  if (rectDoc){
    ensureEditOffset(rectDoc, rectLocal);
    return applyEditOffset(rectDoc);
  }
  return rectLocal;
}

function drawMaskRectAt(dom, absLeft, absTop, absRight, absBottom){
  var w = Math.max(1, absRight - absLeft);
  var h = Math.max(1, absBottom - absTop);
  try {
    dom.selectNone();
    if (dom.addNewRectangle) {
      dom.addNewRectangle({left:absLeft, top:absTop, right:absLeft + w, bottom:absTop + h}, 0);
      return true;
    } else if (dom.drawPath) {
      dom.drawPath([ {x:absLeft,y:absTop}, {x:absLeft+w,y:absTop}, {x:absLeft+w,y:absTop+h}, {x:absLeft,y:absTop+h} ], /*isClosed*/true);
      return true;
    }
    return false;
  } catch(_){ return false; }
}

function main(){
  var dom = fl.getDocumentDOM(); if (!dom) return 'Нет открытого документа';
  var tl = dom.getTimeline(); if (!tl) return 'Нет таймлайна';
  var cur = tl.currentLayer; var layer = tl.layers[cur]; if (!layer) return 'Нет активного слоя';
  var cf = tl.currentFrame|0;

  var logs = []; function log(s){ try{ logs.push(String(s)); }catch(e){} }

  var fr = layer.frames[cf];
  if (!fr || fr.startFrame !== cf) {
    // возьмём ближайший предыдущий ключ
    var k = cf; while (k>0 && layer.frames[k] && layer.frames[k].startFrame !== k){ k--; }
    fr = layer.frames[k]; cf = k;
  }
  if (!fr){ return writeStatusAndReturn('Нет ключевого кадра', logs); }

  var elems = fr.elements||[];
  var bitmaps = [];
  for (var i=0;i<elems.length;i++){ if (isBitmapElement(elems[i])) bitmaps.push(elems[i]); }
  if (!bitmaps.length){ return writeStatusAndReturn('На кадре нет bitmap-элементов', logs); }

  // Создаём новый слой-маску над текущим
  var maskName = 'Bitmap Mask';
  try { tl.addNewLayer(maskName); } catch(eAdd){ return writeStatusAndReturn('Не удалось создать слой-маску: '+eAdd, logs); }
  var maskIdx = tl.currentLayer; // индекс созданного
  // Перемещаем маску непосредственно выше исходного слоя (чтобы были соседями)
  try { if (typeof tl.reorderLayer === 'function'){ tl.reorderLayer(maskIdx, cur); maskIdx = cur; tl.currentLayer = maskIdx; } } catch(eRe){ log('reorder error: '+eRe); }

  // Обозначаем типы слоёв
  try { tl.layers[maskIdx].layerType = 'mask'; } catch(eMT){}
  try { if (tl.layers[maskIdx+1]) tl.layers[maskIdx+1].layerType = 'masked'; } catch(eMs){}

  // Убедимся, что на слое-маске есть ключ на cf, но не создаём лишних кадров
  try { tl.currentLayer = maskIdx; } catch(_){ }
  try {
    var mfr = tl.layers[maskIdx].frames[cf];
    if (!mfr || mfr.startFrame !== cf){ tl.convertToKeyframes(cf, cf); }
  } catch(eKF){ }

  // Рисуем маску
  var added = 0;
  var inset = 0.5; // внутренний отступ в пикселях
  for (var j=0;j<bitmaps.length;j++){
    // Получаем bounds с bitmap-слоя (абсолютные координаты документа)
    var b = getBoundsForElement(dom, bitmaps[j]);
    if (!b) { log('bounds not found for element '+j); continue; }
    // Перед рисованием убеждаемся, что активен слой-маска и нужный кадр
    try { tl.currentLayer = maskIdx; } catch(_cl){}
    try { tl.currentFrame = cf; } catch(_cf){}
    dom.selectNone();
    var L = b.left + inset, T = b.top + inset, R = b.right - inset, B = b.bottom - inset;
    if (drawMaskRectAt(dom, L, T, R, B)) { added++; } else { log('addRect failed '+j); }
  }

  // В самом конце блокируем оба слоя
  try { tl.layers[maskIdx].locked = true; } catch(_lk1){}
  try { if (tl.layers[maskIdx+1]) tl.layers[maskIdx+1].locked = true; } catch(_lk2){}

  return writeStatusAndReturn('Создана маска для '+added+' bitmap(ов) на кадре '+cf, logs);
}

main();


