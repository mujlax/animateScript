// SwapLayerInstancesToDuplicate.jsfl
// На активном слое: создаёт один дубликат символа (по первому найденному instance)
// и заменяет ВСЕ инстансы в ключевых кадрах слоя на этот дубликат.
// Предпочтительный метод: el.libraryItem = dup; затем swapSymbol(name); затем dom/el.swapElement.
// Принудительная вставка отключена.

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try {
    var scriptDir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    var statusURI = scriptDir + '/status.txt';
    FLfile.write(statusURI, text);
  } catch(e) {}
  return text;
}

// Возвращает корневое имя без конечного суффикса " copy" или " copy N"
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

function main(){
  var dom = fl.getDocumentDOM();
  if (!dom) { return "Нет открытого документа"; }
  var tl = dom.getTimeline(); if (!tl) { return "Нет таймлайна"; }
  var layer = tl.layers[tl.currentLayer]; if (!layer) { return "Нет активного слоя"; }

  var logs = []; function log(m){ try{ logs.push(String(m)); }catch(e){} }

  // Найдём первый instance на слое, чтобы определить исходный символ
  var frames = layer.frames; var i, j, frame, el, firstInstance = null;
  for (i=0;i<frames.length && !firstInstance;i++){
    frame = frames[i];
    if (frame.startFrame == i) {
      for (j=0;j<frame.elements.length;j++){
        el = frame.elements[j];
        if (el && el.elementType == "instance" && el.libraryItem) { firstInstance = el; break; }
      }
    }
  }
  if (!firstInstance) { return writeStatusAndReturn("На активном слое нет инстансов символов", logs); }

  var sourceItem = firstInstance.libraryItem;
  var lib = dom.library; var base = sourceItem.name; var baseRoot = getRootBaseName(base);

  // Создаём один дубликат (используем фактическое имя copy N)
  var dup = null; var actualName = null;
  try { if (sourceItem.duplicate) { dup = sourceItem.duplicate(); if (dup && dup.name) { actualName = dup.name; log("duplicate() -> "+actualName); } } } catch(e0){ log("duplicate() error: "+e0); }
  if (!actualName) {
    try { lib.duplicateItem(base); log("duplicateItem(base) called"); } catch(e1){ log("duplicateItem(base) error: "+e1); }
    var guess = findLatestCopyName(lib, baseRoot);
    if (guess) { actualName = guess; log("detected latest copy: "+guess); }
  }
  if (!actualName) { return writeStatusAndReturn("Не удалось создать дубликат (не найдено имя copy)", logs); }

  if (!dup && lib && lib.items) {
    try { for (i=0;i<lib.items.length;i++){ if (lib.items[i].name== actualName){ dup = lib.items[i]; break; } } if (dup) log("resolved dup LibraryItem object for "+actualName); }
    catch(e2){ log("resolve dup object error: "+e2); }
  }

  // Обход всех ключей слоя
  var replaced = 0; var keys = 0;
  var prevFrame = tl.currentFrame; var wasLocked = layer.locked; if (wasLocked) layer.locked = false;

  for (i=0;i<frames.length;i++){
    frame = frames[i];
    if (frame.startFrame != i) continue; // только ключи
    keys++;

    tl.currentFrame = i;
    var elems = layer.frames[i].elements;
    for (j=0;j<elems.length;j++){
      el = layer.frames[i].elements[j];
      if (!el || el.elementType != "instance") continue;

      try {
        dom.selectNone(); try { dom.selection = [el]; } catch(eSel){ el.selected = true; }
        var done = false;
        // A) Назначение libraryItem — основной метод
        if (!done && dup) { try { el.libraryItem = dup; done = true; } catch(eLi) { log("frame "+i+" assign libraryItem error: "+eLi); } }
        // B) Имя через swapSymbol
        if (!done) { try { if (el.swapSymbol) { el.swapSymbol(actualName); done = true; } } catch(eSS){ log("frame "+i+" swapSymbol(name) error: "+eSS); } }
        // C) Объект через dom/el.swapElement
        if (!done) { try { if (dup && dom.swapElement) { dom.swapElement(dup); done = true; } } catch(eDE){ log("frame "+i+" dom.swapElement error: "+eDE); } }
        if (!done) { try { if (dup && el.swapElement) { el.swapElement(dup); done = true; } } catch(eEE){ log("frame "+i+" el.swapElement error: "+eEE); } }

        if (!done) { log("frame "+i+" replacement not completed; forced insert disabled"); }
        if (done) replaced++;
      } catch(errEach){ log("frame "+i+" replace error: "+errEach); }
    }
  }

  tl.currentFrame = prevFrame; if (wasLocked) layer.locked = true;

  return writeStatusAndReturn("Заменено инстансов: "+replaced+" на ключах: "+keys+"\nСимвол: "+actualName, logs);
}

// Вызов для fl.runScript
main();


