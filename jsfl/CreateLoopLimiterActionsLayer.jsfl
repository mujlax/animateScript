// CreateLoopLimiterActionsLayer.jsfl
// Создаёт новый верхний слой и добавляет в Actions текущего кадра код loopLimiter

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try { var dir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/')); FLfile.write(dir + '/status.txt', text); } catch(e){}
  return text;
}

function uniqueLayerName(tl, base){
  try {
    var used = {}; for (var i=0;i<tl.layers.length;i++){ try{ used[tl.layers[i].name||('Layer '+i)] = true; }catch(_){} }
    if (!used[base]) return base;
    var n=2; while (used[base+" "+n]) n++;
    return base+" "+n;
  } catch(e){ return base; }
}

function main(){
  var dom = fl.getDocumentDOM(); if (!dom) return 'Нет открытого документа';
  var tl = dom.getTimeline(); if (!tl) return 'Нет таймлайна';
  var prevLayerIndex = 0; try { prevLayerIndex = tl.currentLayer|0; } catch(_){}
  var prevFrameIndex = 0; try { prevFrameIndex = tl.currentFrame|0; } catch(_){}
  var frameIndex = prevFrameIndex;

  var logs = []; function log(s){ try{ logs.push(String(s)); }catch(e){} }
  var resultText = null;

  var baseName = 'Loop Limiter';
  var layerName = uniqueLayerName(tl, baseName);
  try {
    try { tl.addNewLayer(layerName); } catch(eAdd){ resultText = writeStatusAndReturn('Не удалось создать слой: '+eAdd, logs); }
    if (!resultText) {
      var newIndex = tl.currentLayer;
      // Переместим слой в самый верх списка (индекс 0)
      try { if (typeof tl.reorderLayer === 'function'){ tl.reorderLayer(newIndex, 0); newIndex = 0; tl.currentLayer = newIndex; } } catch(eRe){ log('reorderLayer->0 error: '+eRe); }

      // Переходим на целевой кадр и создаём пустой ключ
      try { tl.currentFrame = frameIndex; } catch(_cf){}
      // Важно: metka/looptimer должна быть именно на frameIndex.
      // Поэтому ориентируемся на startFrame keyframe, а не на индекс в frames[].
      // Если keyframe на нужном кадре отсутствует — пробуем convertToKeyframes(frameIndex, frameIndex).
      try {
        var hasKey = false;
        try {
          var framesArr0 = tl.layers[newIndex].frames || [];
          for (var chk0 = 0; chk0 < framesArr0.length; chk0++){
            var fchk0 = framesArr0[chk0];
            if (fchk0 && fchk0.startFrame === frameIndex) { hasKey = true; break; }
          }
        } catch(_chk0) {}
        if (!hasKey && typeof tl.convertToKeyframes === 'function') {
          try { tl.convertToKeyframes(frameIndex, frameIndex); } catch(_conv0) {}
        }
      } catch(_ensureKey) {}

      var code = "function loopLimiter(_loops) {\n"
               + "  if (typeof this.loop_counter === 'undefined') {\n"
               + "    this.loop_counter = 0;\n"
               + "  }\n"
               + "  if (this.loop_counter >= _loops) {\n"
               + "    createjs.Ticker.removeAllEventListeners();\n"
               + "    createjs.Tween.removeAllTweens();\n"
               + "  } else {\n"
               + "    this.loop_counter++;\n"
               + "  }\n"
               + "}\n"
               + "loopLimiter(1);";

      try {
        // Запишем actionScript в frame по индексу (без проверки startFrame),
        // чтобы не вызывать операции, которые могут сдвинуть таймлайн.
        try { tl.currentLayer = newIndex; } catch(_cl2){}
        try { tl.currentFrame = frameIndex; } catch(_cf2){}

        var fr = null;
        try {
          var framesArr = tl.layers[newIndex].frames || [];
          for (var fi=0; fi<framesArr.length; fi++){
            var f = framesArr[fi];
            if (f && f.startFrame === frameIndex) { fr = f; break; }
          }
        } catch(_search){}

        // Если keyframe после convertToKeyframes всё равно не появился — повторим convert и попробуем ещё раз.
        if (!fr && typeof tl.convertToKeyframes === 'function') {
          try { tl.convertToKeyframes(frameIndex, frameIndex); } catch(_conv1) {}
          try {
            var framesArr2 = tl.layers[newIndex].frames || [];
            for (var fi2=0; fi2<framesArr2.length; fi2++){
              var f2 = framesArr2[fi2];
              if (f2 && f2.startFrame === frameIndex) { fr = f2; break; }
            }
          } catch(_search2){}
        }

        if (fr && fr.startFrame === frameIndex) { fr.actionScript = code; }
        else { resultText = writeStatusAndReturn('Кадр не найден для записи Actions (target='+frameIndex+')', logs); }
      } catch(eAS){ resultText = writeStatusAndReturn('Не удалось записать Actions: '+eAS, logs); }
    }
  } finally {
    // Восстановим прежние currentLayer/currentFrame, чтобы не "перескакивали" маркеры/выбор пользователя.
    try { tl.currentLayer = prevLayerIndex; } catch(_r1){}
    try { tl.currentFrame = prevFrameIndex; } catch(_r2){}
  }

  if (!resultText) {
    resultText = writeStatusAndReturn('Создан слой "'+layerName+'" и записан loopLimiter в кадр '+frameIndex, logs);
  }
  return resultText;
}

main();


