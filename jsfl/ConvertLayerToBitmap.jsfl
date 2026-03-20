// ConvertLayerToBitmap.jsfl
// Конвертирует ВСЕ ключевые кадры активного слоя в Bitmap (Modify > Convert to Bitmap)

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try {
    var scriptDir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    var statusURI = scriptDir + '/status.txt';
    FLfile.write(statusURI, text);
  } catch(e) {}
  return text;
}

function tryConvertSelectionToBitmap(dom){
  try { if (dom.convertSelectionToBitmap) { dom.convertSelectionToBitmap(); return true; } } catch(e0) {}
  try { if (dom.convertToBitmap) { dom.convertToBitmap(); return true; } } catch(e1) {}
  return false;
}

function main(){
  var dom = fl.getDocumentDOM();
  if (!dom) { return "Нет открытого документа"; }
  var tl = dom.getTimeline(); if (!tl) { return "Нет таймлайна"; }
  var li = tl.currentLayer; var layer = tl.layers[li]; if (!layer) { return "Нет активного слоя"; }

  var logs = []; function log(m){ try{ logs.push(String(m)); }catch(e){} }

  // Заблокируем все остальные слои, чтобы selectAll работал только по текущему
  var origLocked = []; var i;
  try {
    for (i=0;i<tl.layers.length;i++){ origLocked[i] = !!tl.layers[i].locked; if (i !== li) tl.layers[i].locked = true; }
  } catch(eLk) {}

  var converted = 0; var skipped = 0; var errors = 0;
  try {
    for (var f=0; f<layer.frames.length; f++){
      var fr = layer.frames[f];
      if (!fr || fr.startFrame !== f) continue; // только ключи
      try { tl.currentFrame = f; } catch(_cf) {}
      try { dom.selectNone(); } catch(_sn) {}
      // выделяем всё на этом слое в текущем кадре
      try { dom.selectAll(); } catch(_sa) {}
      try {
        if (dom.selection && dom.selection.length){
          // сгруппируем, чтобы превратить всё в один растр
          try { if (dom.group) dom.group(); } catch(_g) {}
          if (tryConvertSelectionToBitmap(dom)) converted++; else { errors++; }
        } else {
          skipped++;
        }
      } catch(eEach){ errors++; log("frame="+f+" error: "+eEach); }
    }
  } finally {
    // восстановим замки
    try { for (i=0;i<origLocked.length;i++){ tl.layers[i].locked = !!origLocked[i]; } } catch(_unlk) {}
  }

  return writeStatusAndReturn("Конвертация в Bitmap завершена. Ключей: "+converted+ (skipped? (", пустых: "+skipped):"") + (errors? (", ошибок: "+errors):""), logs);
}

// Вызов для fl.runScript
main();




