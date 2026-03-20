// AutoImageTraceHandler.jsx
// Обработчик нотифаеров Illustrator: при открытии/размещении — пробуем применить Image Trace

try {
    if (app && app.documents.length) {
        var doc = app.activeDocument;
        var target = null;
        if (doc.selection && doc.selection.length > 0) {
            target = doc.selection[0];
        } else if (doc.placedItems && doc.placedItems.length > 0) {
            target = doc.placedItems[doc.placedItems.length - 1];
        } else if (doc.rasterItems && doc.rasterItems.length > 0) {
            target = doc.rasterItems[doc.rasterItems.length - 1];
        }
        if (target) {
            // Если PlacedItem — встраиваем, чтобы получить RasterItem
            try {
                if (target.typename === 'PlacedItem' && target.embed) {
                    target.embed();
                    if (doc.rasterItems && doc.rasterItems.length > 0) {
                        target = doc.rasterItems[doc.rasterItems.length - 1];
                    }
                }
            } catch (_emb) {}
            // Требуется RasterItem
            if (target && target.typename === 'RasterItem') {
                doc.selection = [target];
                var cmds = ['Tracing Make', 'Image Trace', 'Live Trace'];
                for (var i = 0; i < cmds.length; i++) {
                    try { app.executeMenuCommand(cmds[i]); break; } catch (e) {}
                }
            }
        }
    }
} catch (e) {
    // ignore
}


