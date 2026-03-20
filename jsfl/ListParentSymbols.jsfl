// ListParentSymbols.jsfl
// Показывает цепочку вложенности символов для текущего контекста редактирования
// и выбранного экземпляра (instance) на сцене.

function writeStatusAndReturn(title, lines){
  var text = title + (lines && lines.length ? "\n" + lines.join('\n') : "");
  try {
    var scriptDir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    var statusURI = scriptDir + '/status.txt';
    FLfile.write(statusURI, text);
  } catch(e) {}
  return text;
}

function main(){
  var dom = fl.getDocumentDOM();
  if (!dom) { return "Нет открытого документа"; }

  var lines = []; function log(s){ try{ lines.push(String(s)); }catch(e){} }

  // 1) Путь редактирования (вложенность открытых символов)
  var editPathNames = []; var i;
  // Надёжный способ: временно выходим из режима редактирования до сцены, запоминая цепочку, затем восстанавливаем
  try {
    var namesStack = [];
    var safety = 0;
    while (dom.editingLibraryItem && safety < 20){
      try { namesStack.unshift(dom.editingLibraryItem.name); } catch(eN) {}
      try { dom.exitEditMode(); } catch(eExit) { break; }
      dom = fl.getDocumentDOM();
      safety++;
    }
    // После выхода: мы на сцене. Цепочка записана в namesStack в порядке сверху-вниз
    editPathNames = namesStack.slice(0);
    // Восстановление контекста
    for (i=0;i<namesStack.length;i++){
      try { dom.library.editItem(namesStack[i]); dom = fl.getDocumentDOM(); } catch(eRe) { break; }
    }
  } catch(eEP) {}

  if (editPathNames.length){
    log("Контекст редактирования:");
    for (i=0;i<editPathNames.length;i++){ log("  - " + editPathNames[i]); }
  } else {
    log("Контекст редактирования: Сцена (главная)");
  }

  // 2) Инфо о выделенном экземпляре
  var sel = null; try { sel = dom.selection && dom.selection.length ? dom.selection[0] : null; } catch(eS) {}
  if (!sel){ return writeStatusAndReturn("Нет выделения", lines); }

  var isInstance = false; var liName = null; var instName = null; var instType = null;
  try { isInstance = (sel.elementType === 'instance'); } catch(eEI) {}
  try { instName = sel.name || ""; } catch(eIN) {}
  try { if (sel.libraryItem){ liName = sel.libraryItem.name || null; instType = sel.libraryItem.itemType || null; } } catch(eLI) {}

  if (!isInstance || !liName){
    return writeStatusAndReturn("Выделите экземпляр символа (instance)", lines);
  }

  log("Выделенный экземпляр:");
  log("  symbol: " + liName + (instType ? " ("+instType+")" : ""));
  if (instName){ log("  instance name: " + instName); }

  // 3) Итоговая цепочка: [контекст ...] > [выделенный символ]
  var chain = (editPathNames.length ? editPathNames.join(" > ") + " > " : "") + liName;
  log("");
  log("Цепочка вложенности:");
  log("  " + chain);

  // 3.1) Цепочка со scale для каждого узла (от верхнего к выделенному)
  function fmtPct(v){ try { return (Math.round((v||0)*1000)/10) + "%"; } catch(e){ return String(v); } }
  var chainWithScales = null;
  try {
    var savedDom = dom; // будет перезаписываться при exit/edit, но ссылка актуальна для fl.getDocumentDOM()
    // Собираем снизу-вверх: выбранный instance и далее его контейнеры через последовательные exitEditMode()
    var parts = [];
    var stepGuard = 0;
    // 0) выбранный
    try {
      var selectedEl = null; try { selectedEl = (dom.selection && dom.selection.length) ? dom.selection[0] : null; } catch(eSel0) {}
      if (selectedEl && selectedEl.elementType === 'instance'){
        var m0 = getMatrix(selectedEl); var sc0 = m0 ? scaleFromMatrix(m0) : {x:NaN,y:NaN};
        var nm0 = ""; try { nm0 = selectedEl.libraryItem ? selectedEl.libraryItem.name : ""; } catch(_nm0) {}
        parts.push({ name: nm0, sx: sc0.x, sy: sc0.y });
      }
    } catch(eS0) {}
    // 1+) поднимаемся вверх, полагаясь на то, что после exitEditMode() выбранным становится экземпляр контейнера
    while (dom.editingLibraryItem && stepGuard < 20){
      var parentName = null; try { parentName = dom.editingLibraryItem.name; } catch(ePN) {}
      try { dom.exitEditMode(); } catch(eEx) { break; }
      dom = fl.getDocumentDOM();
      var el = null; try { el = (dom.selection && dom.selection.length) ? dom.selection[0] : null; } catch(eSel) {}
      var sc = {x:NaN,y:NaN}; if (el && el.elementType === 'instance'){ var mm = getMatrix(el); if (mm) sc = scaleFromMatrix(mm); }
      if (!parentName){ try { parentName = el && el.libraryItem ? el.libraryItem.name : null; } catch(_p) {}
      }
      if (parentName){ parts.push({ name: parentName, sx: sc.x, sy: sc.y }); }
      stepGuard++;
    }
    // parts: снизу->вверх. Сформируем строку сверху->вниз с процентами
    if (parts.length){
      var out = [];
      for (var pi = parts.length - 1; pi >= 0; pi--) {
        var it = parts[pi];
        out.push(it.name + " (" + fmtPct(it.sx) + ", " + fmtPct(it.sy) + ")");
      }
      chainWithScales = out.join(" > ");
      log("");
      log("Цепочка (со scale):");
      log("  " + chainWithScales);
    }
    // попытка восстановить исходный контекст: открываем символ из начальной edit-цепочки, если был
    try {
      // мы уже на сцене; вернёмся по ранее вычисленной editPathNames (если есть)
      if (editPathNames && editPathNames.length){
        for (var ri=0; ri<editPathNames.length; ri++){ try { dom.library.editItem(editPathNames[ri]); dom = fl.getDocumentDOM(); } catch(eRe){ break; } }
      }
    } catch(eRestore) {}
  } catch(eChainScale){ log("chain scale error: "+eChainScale); }

  // 4) Скейл всех элементов на текущем таймлайне в текущем кадре (по слоям)
  function getMatrix(el){
    try { if (el.getMatrix) return el.getMatrix(); } catch(e0) {}
    try { if (el.matrix) return el.matrix; } catch(e1) {}
    return null;
  }
  function scaleFromMatrix(m){
    try {
      var sx = Math.sqrt((m.a||0)*(m.a||0) + (m.b||0)*(m.b||0));
      var sy = Math.sqrt((m.c||0)*(m.c||0) + (m.d||0)*(m.d||0));
      return { x: sx, y: sy };
    } catch(e){ return { x: NaN, y: NaN }; }
  }
  try {
    var tl = dom.getTimeline();
    if (tl){
      var cf = tl.currentFrame;
      log("");
      log("Скейл по слоям (текущий кадр: " + cf + "):");
      for (var li=0; li<tl.layers.length; li++){
        var layer = tl.layers[li];
        var lname = ""; try { lname = layer.name || ("Layer " + li); } catch(eLN) {}
        var f = null; try { f = layer.frames[cf]; } catch(eLF) {}
        if (!f){ log("  ["+li+"] "+lname+": нет кадра"); continue; }
        var elems = []; try { elems = f.elements || []; } catch(eFE) {}
        if (!elems.length){ log("  ["+li+"] "+lname+": нет элементов"); continue; }
        for (var ei=0; ei<elems.length; ei++){
          var el = elems[ei]; if (!el) continue;
          var et = ""; try { et = el.elementType || ""; } catch(_et) {}
          var lib = ""; try { lib = (el.libraryItem && el.libraryItem.name) ? el.libraryItem.name : ""; } catch(_li) {}
          var inst = ""; try { inst = el.name || ""; } catch(_in) {}
          var m = getMatrix(el); var sc = m ? scaleFromMatrix(m) : {x:NaN,y:NaN};
          log("  ["+li+"] "+lname+" :: el#"+ei+ (lib? (" lib="+lib):"") + (inst? (" name="+inst):"") + (et? (" type="+et):"") + " scale=("+ (sc.x.toFixed? sc.x.toFixed(3):sc.x) + ", " + (sc.y.toFixed? sc.y.toFixed(3):sc.y) + ")");
        }
      }
    }
  } catch(eScale) { log("scale error: "+eScale); }

  // Если контекст пуст (мы на сцене) — строим ВСЕ возможные пути по библиотеке
  if (!editPathNames.length){
    log("");
    log("Пути по библиотеке (все варианты):");
    try {
      var parentMap = {};
      var lib = dom.library;
      var items = lib ? lib.items : null;
      function addParent(child, parent){
        if (!child || !parent) return;
        if (!parentMap[child]) parentMap[child] = [];
        var arr = parentMap[child]; var exists = false;
        for (var a=0;a<arr.length;a++){ if (arr[a] === parent){ exists = true; break; } }
        if (!exists) arr.push(parent);
      }
      function collectChildren(item){
        var result = [];
        try {
          if (!item || (item.itemType !== 'movie clip' && item.itemType !== 'graphic')) return result;
          lib.editItem(item.name);
          var inner = fl.getDocumentDOM(); var t = inner.getTimeline();
          for (var lii=0; lii<t.layers.length; lii++){
            var layer = t.layers[lii];
            for (var fii=0; fii<layer.frames.length; fii++){
              var fr = layer.frames[fii];
              for (var eii=0; eii<fr.elements.length; eii++){
                var el = fr.elements[eii];
                try { if (el && el.elementType === 'instance' && el.libraryItem && el.libraryItem.name){ result.push(el.libraryItem.name); } } catch(eEl) {}
              }
            }
          }
        } catch(eCh) {}
        // вернуться на сцену перед следующим item
        try { var back = fl.getDocumentDOM(); while (back && back.editingLibraryItem){ back.exitEditMode(); back = fl.getDocumentDOM(); } } catch(eBk) {}
        return result;
      }
      var i2;
      if (items && items.length){
        for (i2=0;i2<items.length;i2++){
          var it = items[i2];
          try {
            var children = collectChildren(it);
            for (var ci=0; ci<children.length; ci++) addParent(children[ci], it.name);
          } catch(eEach) {}
        }
      }

      function collectPaths(name, path, guard){
        if (!path) path = [];
        if ((guard|0) > 20) return [];
        var parents = parentMap[name];
        if (!parents || !parents.length){
          return [ path.concat([name]) ];
        }
        var out = [];
        for (var pi=0; pi<parents.length; pi++){
          var p = parents[pi];
          var sub = collectPaths(p, path.concat([name]), (guard|0)+1);
          for (var s=0; s<sub.length; s++) out.push(sub[s]);
          if (out.length > 100) break; // ограничение на взрыв путей
        }
        return out;
      }
      var paths = collectPaths(liName, [], 0);
      // Упорядочим по длине и уберём дубликаты
      var seen = {}; var uniquePaths = [];
      for (var pidx=0; pidx<paths.length; pidx++){
        var str = paths[pidx].join(" > ");
        if (!seen[str]){ seen[str] = true; uniquePaths.push(paths[pidx]); }
      }
      uniquePaths.sort(function(a,b){ return a.length - b.length; });

      // Хелперы для скейла
      function fmtPct(v){ try { return (Math.round((v||0)*1000)/10) + "%"; } catch(e){ return String(v); } }
      function findChildScaleInsideParent(parentName, childName){
        var sc = {x:NaN, y:NaN};
        try {
          lib.editItem(parentName);
          var inner = fl.getDocumentDOM(); var t = inner.getTimeline();
          outer: for (var li3=0; li3<t.layers.length; li3++){
            var layer3 = t.layers[li3];
            for (var fi3=0; fi3<layer3.frames.length; fi3++){
              var fr3 = layer3.frames[fi3];
              for (var ei3=0; ei3<fr3.elements.length; ei3++){
                var el3 = fr3.elements[ei3];
                try {
                  if (el3 && el3.elementType === 'instance' && el3.libraryItem && el3.libraryItem.name === childName){
                    try { t.currentFrame = fi3; } catch(_cf) {}
                    try { inner.selectNone(); } catch(_sn) {}
                    try { inner.selection = [el3]; } catch(_ss) { try { el3.selected = true; } catch(_sel) {} }
                    var m3 = getMatrix(el3); if (m3){ var s3 = scaleFromMatrix(m3); sc = s3; }
                    break outer;
                  }
                } catch(eEl3) {}
              }
            }
          }
        } catch(eFindSc) {}
        // вернуться на сцену
        try { var back3 = fl.getDocumentDOM(); while (back3 && back3.editingLibraryItem){ back3.exitEditMode(); back3 = fl.getDocumentDOM(); } } catch(eBk3) {}
        return sc;
      }

      if (uniquePaths.length){
        for (var upi=0; upi<uniquePaths.length; upi++){
          var path = uniquePaths[upi]; // формат: root -> ... -> child
          // Выводим в порядке child -> ... -> root со скейлом у каждой пары child-in-parent
          var partsStr = [];
          for (var idx=path.length-1; idx>=0; idx--){
            var nameCur = path[idx];
            var scaleStr = "";
            if (idx-1 >= 0){
              var parentN = path[idx-1];
              var scp = findChildScaleInsideParent(parentN, nameCur);
              scaleStr = " (" + fmtPct(scp.x) + ", " + fmtPct(scp.y) + ")";
            } else {
              scaleStr = " (—)";
            }
            partsStr.push(nameCur + scaleStr);
          }
          log("  " + partsStr.join(" > "));
        }
        // как итоговую цепочку берём самую длинную строку
        var lastPath = uniquePaths[uniquePaths.length - 1];
        chain = lastPath.join(" > ");
      } else {
        log("  Пути не найдены");
      }
    } catch(eFB) { log("fallback error: "+eFB); }
  }

  return writeStatusAndReturn("Иерархия символов получена", lines);
}

// Вызов для fl.runScript
main();




