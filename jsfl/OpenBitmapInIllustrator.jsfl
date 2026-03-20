// OpenBitmapInIllustrator.jsfl
// Открывает выделенный bitmap (PNG/JPG и т.п.) в Adobe Illustrator.
// Если bitmap embedded, временно экспортирует его в PNG и открывает файл.

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try { var dir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/')); FLfile.write(dir + '/status.txt', text); } catch(e){}
  return text;
}

function isBitmapElement(el){
  try { if (!el) return false; if (el.elementType === 'bitmap') return true; } catch(_){}
  try { if (el.elementType === 'instance' && el.libraryItem && el.libraryItem.itemType === 'bitmap') return true; } catch(_){}
  return false;
}

function getFirstBitmapOnCurrentKey(dom, tl, layer){
  var cf = tl.currentFrame|0; var fr = layer.frames[cf];
  if (!fr || fr.startFrame !== cf){ var k=cf; while (k>0 && layer.frames[k] && layer.frames[k].startFrame !== k){ k--; } fr = layer.frames[k]; }
  if (!fr) return null;
  var els = fr.elements||[];
  for (var i=0;i<els.length;i++){ if (isBitmapElement(els[i])) return els[i]; }
  return null;
}

function toPlatformPath(uri){
  try { if (FLfile.uriToPlatformPath) return FLfile.uriToPlatformPath(uri); } catch(e){}
  return uri.replace(/^file:\/\//, '');
}

function isAbsolutePath(p){
  try {
    if (!p) return false;
    if (p.indexOf(':/') > 0) return true; // Windows C:/...
    if (p.indexOf(':\\') > 0) return true; // Windows C:\...
    return (p.charAt(0) === '/');
  } catch(_){ return false; }
}

function baseName(p){
  try {
    if (!p) return '';
    var s = p.replace(/\\/g, '/');
    var i = s.lastIndexOf('/');
    return (i >= 0) ? s.substring(i+1) : s;
  } catch(_) { return String(p); }
}

function cleanTempExports(){
  try {
    var dir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    var files = FLfile.listFolder(dir, 'files') || [];
    for (var i=0;i<files.length;i++){
      var nm = files[i] || '';
      if (/^__temp_export_\d+\.(png|jpg|jpeg)$/i.test(nm)){
        try { FLfile.remove(dir + '/' + nm); } catch(_e){}
      }
    }
  } catch(_){ }
}

function main(){
  var dom = fl.getDocumentDOM(); if (!dom) return 'Нет открытого документа';
  var tl = dom.getTimeline(); if (!tl) return 'Нет таймлайна';
  var layer = tl.layers[tl.currentLayer]; if (!layer) return 'Нет активного слоя';

  var logs = []; function log(s){ try{ logs.push(String(s)); }catch(e){} }

  // Чистим временные экспортированные файлы предыдущих запусков
  cleanTempExports();

  var el = getFirstBitmapOnCurrentKey(dom, tl, layer);
  if (!el){ return writeStatusAndReturn('На текущем ключе нет bitmap-элемента', logs); }

  var item = null; var src = null;
  try { item = el.libraryItem || null; } catch(_){}
  if (item){ try { src = item.sourceFilePath || null; } catch(_){}
  }

  var openPath = null; // platform path
  if (src && src.length){
    if (/^file:\/\//i.test(src)) { openPath = toPlatformPath(src); }
    else if (isAbsolutePath(src)) { openPath = src; }
  }
  if ((!openPath || !FLfile.exists(openPath)) && item) {
    // export to temp PNG near script dir
    try {
      var dir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
      var tmpURI = dir + '/__temp_export_' + (new Date().getTime()) + '.png';
      if (FLfile.exists(tmpURI)) { try { FLfile.remove(tmpURI); } catch(_rm){} }
      if (item.exportToFile) { item.exportToFile(tmpURI); }
      openPath = toPlatformPath(tmpURI);
      log('exported to: '+openPath);
    } catch(eExp){ return writeStatusAndReturn('Экспорт embedded bitmap не удался: '+eExp, logs); }
  }

  if (!openPath){ return writeStatusAndReturn('Не удалось определить файл bitmap', []); }

  // macOS: открыть в Illustrator через командную строку
  try {
    var cmd = '/usr/bin/open -a "Adobe Illustrator" "' + openPath.replace(/"/g, '\\"') + '"';
    FLfile.runCommandLine(cmd);
  } catch(eSys){ return writeStatusAndReturn('Не удалось запустить Illustrator', []); }

  return writeStatusAndReturn('Открыто в Illustrator: '+baseName(openPath), []);
}

main();


