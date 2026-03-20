// RebuildBitmapFromLayer.jsfl
// Сценарий: выбран слой с именем вида "<Name> bitmap".
// 1) Удаляем этот слой.
// 2) Находим слой с именем <Name>.
// 3) Дублируем его в новый слой, делаем normal/visible.
// 4) На выбранном ключевом кадре: scale +15% → Convert to Bitmap → scale −15%.

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try { var dir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/')); FLfile.write(dir + '/status.txt', text); } catch(e){}
  return text;
}

function tryConvertToBitmap(dom){
  try { if (dom.convertSelectionToBitmap){ dom.convertSelectionToBitmap(); return true; } } catch(e0){}
  try { if (dom.convertToBitmap){ dom.convertToBitmap(); return true; } } catch(e1){}
  return false;
}

function tryScale(dom, sx, sy){
  try { if (dom.scaleSelection){ dom.scaleSelection(sx, sy); return true; } } catch(e0){}
  try {
    // transformSelection(matrix): a c tx; b d ty
    var m = {a:sx, b:0, c:0, d:sy, tx:0, ty:0};
    if (dom.transformSelection){ dom.transformSelection(m); return true; }
  } catch(e1){}
  return false;
}

function main(){
  var dom = fl.getDocumentDOM(); if (!dom) return 'Нет открытого документа';
  var tl = dom.getTimeline(); if (!tl) return 'Нет таймлайна';
  var cur = tl.currentLayer; var layer = tl.layers[cur]; if (!layer) return 'Нет активного слоя';

  var logs = []; function log(s){ try{ logs.push(String(s)); }catch(_){} }

  var name = ''; try { name = layer.name || ''; } catch(_n){}
  if (!name){ return 'У слоя нет имени'; }
  // Извлекаем базовое имя и последний применённый процент (±N% или xK)
  var percent = 0; // последний применённый; следующий будет +15%
  var mPct = name.match(/\bbitmap\s*([+-])\s*(\d{1,3})%\s*$/i);
  var mMul = (!mPct) ? name.match(/\bbitmap\s*x\s*(\d+(?:\.\d+)?)\s*$/i) : null;
  if (mPct) {
    try { var val = parseInt(mPct[2], 10) || 0; percent = (mPct[1] === '-' ? -val : val); } catch(_p){}
  } else if (mMul) {
    try { var f = parseFloat(mMul[1])||1; percent = Math.round((f - 1) * 100); } catch(_m){}
  }
  var base = name;
  base = base.replace(/\s*bitmap\s*[+-]\s*\d{1,3}%\s*$/i, '');
  base = base.replace(/\s*bitmap\s*x\s*\d+(?:\.\d+)?\s*$/i, '');
  base = base.replace(/\s*bitmap\s*$/i, '');
  if (base === name){ return 'Имя слоя должно оканчиваться на "bitmap" (допустимо с "+N%" или "xK")'; }
  log('base name: ' + base + ', last percent: ' + percent);
  var nextPercent = percent + 15;
  var scaleUp = 1 + (nextPercent/100);

  var curFrame = tl.currentFrame|0;

  // 1) Удаляем текущий слой
  try { tl.deleteLayer(cur); } catch(eDel){ log('deleteLayer error: '+eDel); }

  // 2) Ищем базовый слой
  var baseIndex = -1; try {
    for (var i=0;i<tl.layers.length;i++){ if (tl.layers[i] && tl.layers[i].name === base){ baseIndex = i; break; } }
  } catch(eF){}
  if (baseIndex < 0){ return writeStatusAndReturn('Базовый слой не найден: '+base, logs); }

  // 3) Дублируем базовый слой
  var dupIndex = -1; try {
    tl.currentLayer = baseIndex;
    if (typeof tl.duplicateLayer === 'function'){ tl.duplicateLayer(baseIndex); dupIndex = tl.currentLayer; }
  } catch(eDup){ log('duplicateLayer error: '+eDup); }
  if (dupIndex < 0){
    try {
      var framesLen = tl.layers[baseIndex].frames.length;
      tl.currentLayer = baseIndex; tl.copyFrames(0, framesLen-1); tl.addNewLayer(base + ' bitmap'); dupIndex = tl.currentLayer; tl.pasteFrames(0);
    } catch(eFB){ log('fallback copy/paste error: '+eFB); }
  }
  if (dupIndex < 0){ return writeStatusAndReturn('Не удалось создать дубликат слоя', logs); }
  try {
    var signStr = (nextPercent >= 0 ? '+' : '-');
    var absPct = Math.abs(nextPercent);
    tl.layers[dupIndex].name = base + ' bitmap ' + signStr + absPct + '%';
    tl.layers[dupIndex].layerType = 'normal'; tl.layers[dupIndex].visible = true;
  } catch(_set){}

  // 4) На ключе: scale +15% → bitmap → scale −15%
  var converted = false;
  try {
    tl.currentLayer = dupIndex;
    var lockStates = []; for (var li=0; li<tl.layers.length; li++){ lockStates[li] = !!tl.layers[li].locked; if (li !== dupIndex) tl.layers[li].locked = true; }
    var dLayer = tl.layers[dupIndex];
    var fr = dLayer.frames[curFrame];
    if (!fr || fr.startFrame !== curFrame){ var k = curFrame; while (k>0 && dLayer.frames[k] && dLayer.frames[k].startFrame !== k){ k--; } fr = dLayer.frames[k]; curFrame = k; }
    if (fr){
      tl.currentFrame = curFrame; dom.selectNone(); dom.selectAll();
      if (dom.selection && dom.selection.length){
        // Увеличиваем на nextPercent, затем конвертим в Bitmap и точно возвращаем обратно 1/scaleUp
        tryScale(dom, scaleUp, scaleUp);
        if (tryConvertToBitmap(dom)) { converted = true; }
        var back = (scaleUp > 0) ? (1/scaleUp) : 1;
        tryScale(dom, back, back);
      }
    }
    // восстановить lock
    for (li=0; li<lockStates.length; li++){ tl.layers[li].locked = !!lockStates[li]; }
  } catch(eDo){ log('convert step error: '+eDo); }

  return writeStatusAndReturn('Пересобран bitmap из слоя '+base+' (+'+nextPercent+'%) → '+(converted?'успех':'нет выделения/ошибка'), logs);
}

main();


