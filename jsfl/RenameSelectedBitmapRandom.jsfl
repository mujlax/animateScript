// RenameSelectedBitmapRandom.jsfl
// Переименовывает библиотечный элемент Bitmap, соответствующий выделенному объекту,
// добавляя к базе имени случайный суффикс из 6 заглавных букв.
// Работает в Adobe Animate (JSFL).

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try {
    var scriptDir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    var statusURI = scriptDir + '/status.txt';
    FLfile.write(statusURI, text);
  } catch(e) {}
  return text;
}

function generateRandomLetters(n){
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var out = "";
  for (var i = 0; i < n; i++){
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

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

function tryRenameLibraryItem(lib, item, newName){
  var result = { ok:false, oldName:"", finalName:"", target:newName };
  try { result.oldName = item && item.name ? String(item.name) : ""; } catch(_o) {}
  try {
    if (typeof lib.renameItem === 'function' && result.oldName){
      lib.renameItem(result.oldName, newName);
    }
  } catch(_r0) {}
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
  if (!result.ok) {
    try { item.name = newName; } catch(_set) {}
  }
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

function isBitmapElement(el){
  try { if (!el) return false; if (el.elementType === 'bitmap') return true; } catch(_){}
  try { if (el.elementType === 'instance' && el.libraryItem && el.libraryItem.itemType === 'bitmap') return true; } catch(_){}
  return false;
}

// Пере-выделяем и пытаемся найти bitmap/instance с libraryItem
function getBitmapLibraryItemFromStage(dom){
  try {
    var sel = null;
    try { sel = dom.selection || []; } catch(_s) { sel = []; }
    for (var i=0; i<(sel?sel.length:0); i++){
      var el = sel[i];
      try { if (isBitmapElement(el) && el.libraryItem) return el.libraryItem; } catch(_e) {}
    }
    try { dom.selectNone(); } catch(_n){}
    try { dom.selectAll(); } catch(_a){}
    try { sel = dom.selection || []; } catch(_s2) { sel = []; }
    for (var j=0; j<(sel?sel.length:0); j++){
      var el2 = sel[j];
      try { if (isBitmapElement(el2) && el2.libraryItem) return el2.libraryItem; } catch(_e2) {}
    }
  } catch(_all){}
  return null;
}

function main(){
  var dom = fl.getDocumentDOM();
  if (!dom) { return "Нет открытого документа"; }
  var lib = dom.library;
  if (!lib) { return "Библиотека недоступна"; }

  var logs = []; function log(s){ try{ logs.push(String(s)); }catch(e){} }

  // Берём первый подходящий элемент из текущего выделения
  var sel = null;
  try { sel = dom.selection || []; } catch(_) { sel = []; }
  var target = null;
  for (var i=0; i < (sel ? sel.length : 0); i++){
    var el = sel[i];
    if (isBitmapElement(el)) { target = el; break; }
  }
  if (!target) { return writeStatusAndReturn("Нет выделенного Bitmap/instance Bitmap", logs); }

  var item = null;
  try { item = target.libraryItem || null; } catch(_li) {}
  if (!item) {
    item = getBitmapLibraryItemFromStage(dom);
  }
  if (!item) { return writeStatusAndReturn("Не удалось получить libraryItem для выделенного объекта", logs); }

  var oldName = ""; try { oldName = item.name || ""; } catch(_on) {}
  if (!oldName) { return writeStatusAndReturn("У libraryItem нет имени", logs); }

  // Новое требование: только 6 заглавных букв
  var newName = generateRandomLetters(6);
  var guard = 0;
  while (libraryItemExists(lib, newName) && guard++ < 50){
    newName = generateRandomLetters(6);
  }
  try {
    var rr = tryRenameLibraryItem(lib, item, newName);
    log("Переименование Bitmap: old='" + (rr.oldName||"") + "' → target='" + (rr.target||"") + "', final='" + (rr.finalName||"") + "', ok=" + rr.ok);
    return writeStatusAndReturn(rr.ok ? ("Bitmap переименован: " + (rr.finalName||rr.target)) : "Не удалось переименовать Bitmap", logs);
  } catch(eRen){
    log("Ошибка переименования (исключение): " + eRen);
    return writeStatusAndReturn("Ошибка переименования (исключение): " + eRen, logs);
  }
}

// Вызов для fl.runScript
main();

