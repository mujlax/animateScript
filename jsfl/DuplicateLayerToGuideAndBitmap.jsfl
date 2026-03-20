// DuplicateLayerToGuideAndBitmap.jsfl
// Дублирует активный слой; оригинал переводит в guide (видимость не меняем);
// дубликат конвертирует в bitmap на выбранном ключевом кадре.

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try {
    var scriptDir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    var statusURI = scriptDir + '/status.txt';
    FLfile.write(statusURI, text);
  } catch(e) {}
  return text;
}

function convertSelToBitmap(dom){
  try { if (dom.convertSelectionToBitmap) { dom.convertSelectionToBitmap(); return true; } } catch(e0) {}
  try { if (dom.convertToBitmap) { dom.convertToBitmap(); return true; } } catch(e1) {}
  return false;
}

// Генерация случайной строки из заглавных латинских букв (A–Z)
function generateRandomLetters(n){
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var out = "";
  for (var i = 0; i < n; i++){
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

// Проверка существования элемента библиотеки по имени
function libraryItemExists(lib, name){
  try { if (lib && typeof lib.itemExists === 'function') return !!lib.itemExists(name); } catch(_ie) {}
  try {
    var items = (lib && lib.items) ? lib.items : [];
    for (var i = 0; i < items.length; i++){
      try { if (items[i] && items[i].name === name) return true; } catch(_n) {}
    }
  } catch(_li) {}
  return false;
}

// Переименование libraryItem с верификацией
function tryRenameLibraryItem(lib, item, newName){
  var result = { ok:false, oldName:"", finalName:"", target:newName };
  try { result.oldName = item && item.name ? String(item.name) : ""; } catch(_o) {}
  // 1) Основной способ
  try {
    if (typeof lib.renameItem === 'function' && result.oldName){
      lib.renameItem(result.oldName, newName);
    }
  } catch(_r0) {}
  // 2) Фоллбек через select
  try {
    if (typeof lib.itemExists === 'function' && lib.itemExists(newName)) {
      result.ok = true;
    } else {
      if (typeof lib.selectItem === 'function' && result.oldName) { try { lib.selectItem(result.oldName); } catch(_s0) {} }
      if (typeof lib.renameItem === 'function' && result.oldName) { try { lib.renameItem(result.oldName, newName); } catch(_r1) {} }
      if (typeof lib.itemExists === 'function' && lib.itemExists(newName)) {
        result.ok = true;
      }
    }
  } catch(_rsel) {}
  // 3) Фоллбек — прямое присвоение
  if (!result.ok) {
    try { item.name = newName; } catch(_set) {}
  }
  // Проверим финальное имя
  try { result.finalName = item && item.name ? String(item.name) : ""; } catch(_f) {}
  try {
    if (!result.finalName && typeof lib.itemExists === 'function' && lib.itemExists(newName)) {
      result.finalName = newName;
      result.ok = true;
    }
  } catch(_fe) {}
  if (!result.ok && result.finalName === newName) result.ok = true;
  return result;
}

// Пытаемся получить libraryItem Bitmap из текущего выделения на сцене
function getBitmapLibraryItemFromStage(dom){
  try {
    var sel = null;
    try { sel = dom.selection || []; } catch(_s) { sel = []; }
    // 1) Прямо из текущего выделения
    for (var i=0; i<(sel?sel.length:0); i++){
      var el = sel[i];
      try {
        if (el && (el.elementType === 'bitmap' || el.elementType === 'instance') && el.libraryItem){
          return el.libraryItem;
        }
      } catch(_e){}
    }
    // 2) Пере-выделим всё на кадре и попробуем ещё раз
    try { dom.selectNone(); } catch(_n){}
    try { dom.selectAll(); } catch(_a){}
    try { sel = dom.selection || []; } catch(_s2) { sel = []; }
    for (var j=0; j<(sel?sel.length:0); j++){
      var el2 = sel[j];
      try {
        if (el2 && (el2.elementType === 'bitmap' || el2.elementType === 'instance') && el2.libraryItem){
          return el2.libraryItem;
        }
      } catch(_e2){}
    }
  } catch(_all){}
  return null;
}

function main(){
  var dom = fl.getDocumentDOM();
  if (!dom) { return "Нет открытого документа"; }
  var tl = dom.getTimeline(); if (!tl) { return "Нет таймлайна"; }
  var cur = tl.currentLayer; var layer = tl.layers[cur]; if (!layer) { return "Нет активного слоя"; }
  var origName = ""; try { origName = layer.name || ("Layer "+cur); } catch(_n) {}
  var curFrame = tl.currentFrame|0; // запоминаем выбранный ключ

  var logs = []; function log(s){ try{ logs.push(String(s)); }catch(e){} }

  // 1) Дублируем активный слой: сначала пробуем API duplicateLayer, затем фоллбек на copy/paste
  var framesLen = 0; try { framesLen = layer.frames.length; } catch(eFL) {}
  if (!framesLen) { return writeStatusAndReturn("Слой пуст: нет кадров", logs); }

  var newLayerIndex = -1;
  try {
    // duplicateLayer работает от текущего активного слоя
    tl.currentLayer = cur;
    if (typeof tl.duplicateLayer === 'function') {
      tl.duplicateLayer(cur);
      newLayerIndex = tl.currentLayer;
    }
  } catch(eDupApi) { log("duplicateLayer api error: "+eDupApi); }

  if (newLayerIndex < 0) {
    // fallback: copy/paste в новый слой
    try { tl.currentLayer = cur; } catch(_cl) {}
    try { tl.copyFrames(0, framesLen - 1); } catch(eCF) { log("copyFrames error: "+eCF); }
    try { tl.addNewLayer(layer.name + " bitmap"); newLayerIndex = tl.currentLayer; } catch(eANL) { log("addNewLayer error: "+eANL); }
    try { tl.pasteFrames(0); } catch(ePF) { log("pasteFrames error: "+ePF); }
  }

  if (newLayerIndex < 0 || !tl.layers[newLayerIndex]){
    return writeStatusAndReturn("Не удалось создать дубликат слоя", logs);
  }
  // Переименуем дубликат, чтобы однозначно отличать слои
  try { tl.layers[newLayerIndex].name = origName + " bitmap"; } catch(_rn) {}
  // Найдём индекс оригинала по имени (после переименования дубликата оригинал единственный с origName)
  var origIndex = cur;
  try {
    for (var si=0; si<tl.layers.length; si++){
      if (tl.layers[si] && tl.layers[si].name === origName) { origIndex = si; break; }
    }
  } catch(_find) {}

  // 2) Конвертацию на дубликате делаем ПЕРЕД тем как менять тип/видимость оригинала

  // 3) На дубликате конвертируем ТОЛЬКО выбранный ключевой кадр в bitmap (логика как в ConvertLayerToBitmap)
  var convertedKeys = 0; var errors = 0;
  try {
    tl.currentLayer = newLayerIndex;
    var dLayer = tl.layers[newLayerIndex];
    // Временно блокируем остальные слои, чтобы selectAll работал только по текущему (как в ConvertLayerToBitmap)
    var lockStates = []; var li;
    try { for (li=0; li<tl.layers.length; li++){ lockStates[li] = !!tl.layers[li].locked; if (li !== newLayerIndex) tl.layers[li].locked = true; } } catch(_lk) {}
    var fr = dLayer.frames[curFrame];
    if (!fr || fr.startFrame !== curFrame){
      // если не ключ, найдём ближайший предыдущий ключ
      var prevKey = curFrame; while (prevKey>0 && dLayer.frames[prevKey] && dLayer.frames[prevKey].startFrame !== prevKey){ prevKey--; }
      fr = dLayer.frames[prevKey]; curFrame = prevKey;
    }
    if (fr){
      try { tl.currentFrame = curFrame; } catch(_cf) {}
      try { dom.selectNone(); } catch(_sn) {}
      // выделяем всё на этом слое в текущем кадре
      try { dom.selectAll(); } catch(_sa) {}
      try {
        if (dom.selection && dom.selection.length){
          // сгруппируем, чтобы превратить всё в один растр (как в ConvertLayerToBitmap)
          try { if (dom.group) dom.group(); } catch(_g) {}
          if (convertSelToBitmap(dom)) {
            convertedKeys++;
            // Переименовать созданный Bitmap-элемент библиотеки: только 6 случайных заглавных букв
            try {
              var lib = dom.library;
              var bmpItem = getBitmapLibraryItemFromStage(dom);
              if (lib && bmpItem) {
                var newName = generateRandomLetters(6);
                var guard = 0;
                while (libraryItemExists(lib, newName) && guard++ < 50){
                  newName = generateRandomLetters(6);
                }
                var rr = tryRenameLibraryItem(lib, bmpItem, newName);
                log("Переименование Bitmap: old='" + (rr.oldName||"") + "' → target='" + (rr.target||"") + "', final='" + (rr.finalName||"") + "', ok=" + rr.ok);
              } else {
                log("Bitmap создан, но libraryItem не найден в выделении");
              }
            } catch(eRn){ log("rename block error: " + eRn); }
          } else { errors++; }
        }
      } catch(eEach){ errors++; log("convert error: "+eEach); }
    } else { errors++; }
    // Возвращаем lock-состояния
    try { for (var l2=0; l2<lockStates.length; l2++){ tl.layers[l2].locked = !!lockStates[l2]; } } catch(_unlk) {}
  } catch(eDup){ log("duplicate layer convert loop error: "+eDup); }

  // 4) Теперь переводим исходный слой в guide и выключаем видимость
  try { tl.layers[origIndex].layerType = 'guide'; } catch(eLT) { log("set layerType error: "+eLT); }
  try { tl.layers[origIndex].visible = false; } catch(eVis) { log("set visible=false (orig guide) error: "+eVis); }

  return writeStatusAndReturn("Создан дубликат слоя. Оригинал: guide. На дубликате выбранный ключ → Bitmap: "+convertedKeys+ (errors? (", ошибок: "+errors):""), logs);
}

// Вызов для fl.runScript
main();




