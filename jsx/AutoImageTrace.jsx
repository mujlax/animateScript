// AutoImageTrace.jsx (Illustrator ExtendScript)
// Установка/снятие нотифаеров и ручной запуск трейсинга

function _ai_log(msg) {
    try { $.writeln('[AutoImageTrace] ' + msg); } catch (e) {}
}

function _ai_safe(fn) {
    try { return fn(); } catch (e) { _ai_log('error: ' + e); return null; }
}

function AutoImageTrace_install(handlerFsPath) {
    if (!app || !app.notifiers) return 'notifiers unavailable';
    // Очистим прежние нотифаеры этого типа
    _ai_safe(function(){ AutoImageTrace_uninstall(); });

    var handlerFile = new File(handlerFsPath);
    if (!handlerFile || !handlerFile.exists) {
        return 'handler file not found: ' + handlerFsPath;
    }

    // Собития: открытие документа и размещение файла
    // 'Opn ' — документ открыт
    // 'Plc ' — Place
    var added = 0;
    _ai_safe(function(){ app.notifiers.add('Opn ', handlerFile); added++; });
    _ai_safe(function(){ app.notifiers.add('Plc ', handlerFile); added++; });

    return 'AutoImageTrace enabled (' + added + ' notifiers)';
}

function AutoImageTrace_uninstall() {
    if (!app || !app.notifiers) return 'notifiers unavailable';
    var i;
    for (i = app.notifiers.length - 1; i >= 0; i--) {
        var n = app.notifiers[i];
        try {
            // фильтруем по событиям, которые мы добавляли
            if (n.eventFile && (n.event === 'Opn ' || n.event === 'Plc ')) {
                app.notifiers.remove(n);
            }
        } catch (_) {}
    }
    return 'AutoImageTrace disabled';
}

// Сужение (Offset Path) результата трассировки на активном документе
function AutoImageTrace_shrinkTraceLayer(offset) {
    try {
        if (!app.documents.length) return 'no document';
        var doc = app.activeDocument;
        if (offset == null) offset = -1;
        // пытаемся найти верхний слой, созданный нами (по суффиксу "(trace)")
        var layer = null; var i;
        for (i = 0; i < doc.layers.length; i++) {
            try { if (String(doc.layers[i].name).toLowerCase().indexOf('(trace)') >= 0) { layer = doc.layers[i]; break; } } catch(_n) {}
        }
        if (!layer) layer = doc.activeLayer;
        if (!layer) return 'no layer';
        // собираем все path/compound внутри слоя
        function collect(items, out){
            try {
                var i2; for (i2=0;i2<items.length;i2++){
                    var it = items[i2];
                    try {
                        var t = it.typename;
                        if (t === 'PathItem') out.push(it);
                        else if (t === 'CompoundPathItem') out.push(it);
                        else if (t === 'GroupItem') collect(it.pageItems, out);
                    } catch(_ie) {}
                }
            } catch(_c) {}
        }
        var targets = [];
        try { collect(layer.pageItems, targets); } catch(_cl) {}
        if (!targets.length) return 'no paths to offset';
        // применяем Live Effect "Adobe Offset Path" к каждому элементу и разворачиваем
        function applyOffset(item, amt){
            try {
                var fx = '<LiveEffect name="Adobe Offset Path"><Dict data="R mlim 4 I jntp 0 R ofst ' + amt + ' "/></LiveEffect>';
                item.applyEffect(fx);
            } catch(_fx) {}
        }
        for (var ti=0; ti<targets.length; ti++) applyOffset(targets[ti], offset);
        // расширяем appearance
        try { doc.selection = targets; } catch(_sel2) {}
        try { app.executeMenuCommand('expandStyle'); } catch(_ex) {}
        return 'shrink offset applied: ' + offset;
    } catch(e) {
        return 'shrink error: ' + e;
    }
}

// Выполнить трейс через экшен (Actions). Если набор не загружен — попробуем загрузить .aia и повторить
function AutoImageTrace_runAction(actionName, setName, actionFileFsPath) {
    try {
        function hasSet(name){
            try {
                var sets = app.actionSets; var i; for (i=0;i<sets.length;i++){ if (String(sets[i].name) === String(name)) return true; }
            } catch(_e){}
            return false;
        }
        var triedLoad = false;
        if (!hasSet(setName) && actionFileFsPath) {
            try { var f = new File(actionFileFsPath); if (f && f.exists) { app.loadAction(f); triedLoad = true; } } catch(_l){}
        }
        try { app.doScript(actionName, setName); return 'trace via Action: ' + setName + ' / ' + actionName + (triedLoad ? ' (loaded .aia)' : ''); }
        catch(e1){ return 'action failed: ' + e1; }
    } catch(e) { return 'action error: ' + e; }
}

function AutoImageTrace_traceNow(threshold, cleanWhite) {
    try {
        if (!app.documents.length) return 'no document';
        var doc = app.activeDocument;
        var target = null;

        if (doc.selection && doc.selection.length > 0) {
            target = doc.selection[0];
        } else if (doc.placedItems && doc.placedItems.length > 0) {
            target = doc.placedItems[doc.placedItems.length - 1];
        } else if (doc.rasterItems && doc.rasterItems.length > 0) {
            target = doc.rasterItems[doc.rasterItems.length - 1];
        }

        if (!target) return 'nothing to trace';

        // 0) Дублируем ОБЪЕКТ на новый слой (над исходным), исходный слой скрываем/блокируем
        try {
            var srcLayer = null; try { srcLayer = target.layer; } catch(_ly) { srcLayer = null; }
            if (srcLayer && srcLayer.typename === 'Layer') {
                // Создаём новый слой над исходным
                var newLayer = null;
                try {
                    newLayer = doc.layers.add();
                    try { newLayer.name = srcLayer.name + ' (trace)'; } catch(_rn) {}
                    try { newLayer.move(srcLayer, ElementPlacement.PLACEAFTER); } catch(_mv) {}
                    try { newLayer.locked = false; } catch(_lk0) {}
                    try { newLayer.visible = true; } catch(_vs0) {}
                } catch(_add) {}
                // Дублируем сам объект на новый слой
                if (newLayer) {
                    try {
                        var dupItem = target.duplicate(newLayer, ElementPlacement.PLACEATBEGINNING);
                        if (dupItem) { target = dupItem; try { doc.selection = [target]; } catch(_sel) {} }
                    } catch(_di) {}
                    // Делаем новый слой активным
                    try { doc.activeLayer = newLayer; } catch(_al) {}
                }
                // Вместо скрытия — уменьшаем непрозрачность исходного слоя до 30%
                function setOpacityDeep(container, value){
                    try {
                        if (container.pageItems && container.pageItems.length){
                            for (var i=0;i<container.pageItems.length;i++){
                                var it = container.pageItems[i];
                                try { if (it.opacity != null) it.opacity = value; } catch(_oi) {}
                                // Рекурсия внутрь групп/compound/pathItems
                                try { if (it.pageItems && it.pageItems.length) setOpacityDeep(it, value); } catch(_ri) {}
                            }
                        }
                    } catch(_all) {}
                }
                try { srcLayer.locked = false; } catch(_uk) {}
                try { srcLayer.visible = true; } catch(_vis0) {}
                try { setOpacityDeep(srcLayer, 30); } catch(_op) {}
                // Блокируем после изменения, чтобы не трогать оригинал
                try { srcLayer.locked = true; } catch(_lk1) {}
            }
        } catch(_layerDup) {}

        function typenameOf(o){ try { return o.typename || ''; } catch(_) { return ''; } }
        function findRasterDeep(it){
            try {
                if (!it) return null;
                var t = typenameOf(it);
                if (t === 'RasterItem') return it;
                if (t === 'PlacedItem') {
                    try { if (it.embed) it.embed(); } catch(_e){}
                    try { if (doc.rasterItems && doc.rasterItems.length) return doc.rasterItems[doc.rasterItems.length - 1]; } catch(_r){}
                }
                if (t === 'GroupItem' || t === 'Layer' || t === 'PageItem') {
                    try {
                        var kids = it.pageItems || it;
                        var i; for (i=0; i<kids.length; i++){
                            var got = findRasterDeep(kids[i]); if (got) return got;
                        }
                    } catch(_k){}
                }
                try { if (doc.rasterItems && doc.rasterItems.length) return doc.rasterItems[doc.rasterItems.length - 1]; } catch(_rr){}
            } catch(_all){}
            return null;
        }

        // Если это PlacedItem (линк), попробуем embed -> RasterItem
        try {
            if (target.typename === 'PlacedItem' && target.embed) {
                target.embed();
                // После embed попробуем взять последний RasterItem
                if (doc.rasterItems && doc.rasterItems.length > 0) {
                    target = doc.rasterItems[doc.rasterItems.length - 1];
                }
            }
        } catch (_emb) {}

        // Требуется RasterItem для трейсинга
        var isRaster = false;
        try { isRaster = (target.typename === 'RasterItem'); } catch(_t) {}
        if (!isRaster) {
            // Иногда selection пустая или это группа — попробуем найти растр вглубь
            var deep = findRasterDeep(target);
            if (deep) { target = deep; isRaster = true; }
            else if (doc.rasterItems && doc.rasterItems.length > 0) {
                target = doc.rasterItems[doc.rasterItems.length - 1];
                isRaster = true;
            }
        }
        if (!isRaster) return 'no raster to trace';

        doc.selection = [target];

        // Вариант А: через DOM Tracing API / trace() как в примере Adobe (см. imageTracing.jsx)
        try {
            var traced = null;
            // Предпочтительно вызвать trace() у выбранного объекта (PlacedItem/RasterItem)
            try { if (target && target.trace) { traced = target.trace(); } } catch(_t0) { traced = null; }

            var tr = null;
            if (traced) { try { tr = traced.tracing || null; } catch(_t1) { tr = null; } }
            if (!tr && target) { try { tr = target.tracing || null; } catch(_t2) { tr = null; } }

            if (tr) {
                var presetName = '';
                try {
                    var presets = null; try { presets = app.tracingPresetsList; } catch(_pl) { presets = null; }
                    if (presets && presets.length && tr.tracingOptions && tr.tracingOptions.loadFromPreset) {
                        // Выбираем разумный пресет: Default если есть, иначе первый
                        var chosen = presets[0];
                        for (var pi=0; pi<presets.length; pi++){
                            if (String(presets[pi]).toLowerCase().indexOf('default') >= 0) { chosen = presets[pi]; break; }
                        }
                        presetName = String(chosen);
                        try { tr.tracingOptions.loadFromPreset(chosen); } catch(_lp) {}
                    }
                } catch(_pres) {}
                // Если пришёл threshold — принудительно используем B/W режим и применим порог
                try {
                    if (typeof threshold === 'number' && !isNaN(threshold)) {
                        tr.tracingOptions.tracingMode = TracingModeType.TRACINGMODEBLACKANDWHITE;
                        tr.tracingOptions.threshold = Math.max(0, Math.min(255, threshold|0));
                    }
                } catch(_th) {}
                try { if (tr.make) tr.make(); } catch(_mk) {}
                try { if (tr.expandTracing) tr.expandTracing(); } catch(_ex) {}

                // Очистка: удалить белые заливки внутри слоя с результатом (только если включено)
                if (cleanWhite === true) {
                try {
                    var traceLayer = null; try { traceLayer = target.layer; } catch(_tl) { traceLayer = null; }
                    function isWhiteColor(col){
                        try {
                            if (!col) return false;
                            var tn = col.typename || '';
                            if (tn === 'RGBColor') {
                                return (col.red >= 250 && col.green >= 250 && col.blue >= 250);
                            }
                            if (tn === 'GrayColor') {
                                // В Illustrator: 0 = белый, 100 = чёрный
                                return (col.gray <= 5); // считаем белым только очень светлые
                            }
                            if (tn === 'CMYKColor') {
                                return (col.cyan <= 1 && col.magenta <= 1 && col.yellow <= 1 && col.black <= 5);
                            }
                        } catch(_c) {}
                        return false;
                    }
                    // Всегда удаляем только БЕЛЫЕ заливки; чёрные и другие цвета не трогаем
                    var deleteWhite = true;
                    function cleanContainer(cont){
                        try {
                            // идём с конца, чтобы безопасно удалять
                            if (cont.pageItems && cont.pageItems.length){
                                for (var i = cont.pageItems.length - 1; i >= 0; i--){
                                    var it = cont.pageItems[i];
                                    try {
                                        var t = it.typename;
                                        if (t === 'PathItem') {
                                            var remove = false;
                                            try {
                                                // удаляем только белые заливки без обводки
                                                var isBg = deleteWhite ? isWhiteColor(it.fillColor) : false;
                                                if (it.filled === true && isBg && (!it.stroked || it.strokeWidth === 0)) {
                                                    remove = true;
                                                }
                                            } catch(_fi) {}
                                            if (remove) { try { it.remove(); } catch(_rm) {} }
                                        } else if (t === 'CompoundPathItem') {
                                            // Удаляем только белые дочерние path внутри compound, сам compound не трогаем
                                            try {
                                                for (var cp = it.pathItems.length - 1; cp >= 0; cp--) {
                                                    var sub = it.pathItems[cp];
                                                    try {
                                                        if (sub.filled === true && isWhiteColor(sub.fillColor) && (!sub.stroked || sub.strokeWidth === 0)) {
                                                            sub.remove();
                                                        }
                                                    } catch(_sub) {}
                                                }
                                            } catch(_cperr) {}
                                        } else if (t === 'GroupItem') {
                                            cleanContainer(it);
                                            try { if (!it.pageItems.length) it.remove(); } catch(_rg) {}
                                        }
                                    } catch(_each) {}
                                }
                            }
                        } catch(_walk) {}
                    }
                    if (traceLayer) cleanContainer(traceLayer);
                } catch(_cleanup) {}
                }

                return 'tracing via trace() API' + (presetName ? (' preset='+presetName) : '') + '; target=' + typenameOf(target);
            }
        } catch(_domAll) { /* ignore */ }

        return 'trace command not available via API/trace(); target=' + typenameOf(target);
    } catch (e) {
        return 'trace error: ' + e;
    }
}


