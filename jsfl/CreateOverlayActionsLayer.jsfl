// CreateOverlayActionsLayer.jsfl
// Создаёт новый пустой слой наверху, вставляет пустой ключ в кадр 0
// и добавляет код в панель Actions кадра (для HTML5 Canvas):
//
// var domOverlay = document.getElementById("dom_overlay_container");
// domOverlay.style.border = '1px solid #666666';
// domOverlay.style.boxSizing = 'border-box';

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try {
    var dir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    FLfile.write(dir + '/status.txt', text);
  } catch(e){}
  return text;
}

function uniqueLayerName(tl, base){
  try {
    var exists = {}; for (var i=0;i<tl.layers.length;i++){ try{ exists[tl.layers[i].name||('Layer '+i)] = true; }catch(_e){} }
    if (!exists[base]) return base;
    var n=2; while (exists[base+" "+n]) n++;
    return base+" "+n;
  } catch(e){ return base; }
}

function main(){
  var dom = fl.getDocumentDOM(); if (!dom) return 'Нет открытого документа';
  var tl = dom.getTimeline(); if (!tl) return 'Нет таймлайна';

  var logs = []; function log(s){ try{ logs.push(String(s)); }catch(e){} }

  var topIndex = 0; try { topIndex = tl.layers.length - 1; } catch(_t){}
  if (topIndex < 0) return 'Нет слоёв';

  try { tl.currentLayer = topIndex; } catch(_cl){}

  var baseName = 'DOM Overlay Border';
  var layerName = uniqueLayerName(tl, baseName);
  // Добавление нового слоя
  try { tl.addNewLayer(layerName); } catch(eAdd){ return writeStatusAndReturn('Не удалось создать слой: '+eAdd, logs); }

  var newIndex = tl.currentLayer;
  // Перемещаем слой на самый верх списка (первую позицию)
  try {
    if (typeof tl.reorderLayer === 'function') {
      tl.reorderLayer(newIndex, 0);
      newIndex = 0; tl.currentLayer = newIndex;
    }
  } catch(eRe){ log('reorderLayer->0 error: '+eRe); }
  try { tl.currentFrame = 0; } catch(_cf){}
  try { tl.insertBlankKeyframe(); } catch(eKB) { /* некоторые версии требуют convertToKeyframes */ try{ tl.convertToKeyframes(0,0);}catch(_){ log('insert keyframe fallback failed'); } }

  var code = "var domOverlay = document.getElementById(\"dom_overlay_container\");\n"
           + "if (domOverlay){ domOverlay.style.border = '1px solid #666666'; domOverlay.style.boxSizing = 'border-box'; }";

  try {
    var fr = tl.layers[newIndex].frames[0];
    if (fr){
      fr.actionScript = code; // для HTML5 Canvas это JavaScript действий кадра
    } else {
      return writeStatusAndReturn('Кадр не найден на новом слое', logs);
    }
  } catch(eAS){ return writeStatusAndReturn('Не удалось записать Actions: '+eAS, logs); }

  return writeStatusAndReturn('Создан слой "'+layerName+'" с Actions на кадре 0', logs);
}

main();


