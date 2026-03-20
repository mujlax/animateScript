// ToggleTextCase.jsfl
// Меняет регистр у выделенных текстовых объектов (Animate/FLPR).
// Режим переключается циклически и сохраняется в файле text_case_mode.txt рядом со скриптом.

function writeStatusAndReturn(title, logs){
  var text = title + (logs && logs.length ? "\n" + logs.join('\n') : "");
  try {
    var scriptDir = fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/'));
    var statusURI = scriptDir + '/status.txt';
    FLfile.write(statusURI, text);
  } catch(e) {}
  return text;
}

function trimString(s){
  try { return String(s).replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, ''); } catch(e){ return String(s); }
}

function scriptDirURI(){
  try { return fl.scriptURI.substr(0, fl.scriptURI.lastIndexOf('/')); } catch(e){ return ''; }
}

function readMode(){
  try {
    var uri = scriptDirURI() + '/text_case_mode.txt';
    if (uri && FLfile.exists(uri)) {
      var t = FLfile.read(uri);
      var s = trimString(t || '');
      // Обратная совместимость: раньше режим назывался "title", теперь это "sentence"
      if (s === 'title') return 'sentence';
      if (s) return s;
    }
  } catch(e) {}
  return 'lower';
}

function writeMode(mode){
  try {
    var uri = scriptDirURI() + '/text_case_mode.txt';
    if (uri) FLfile.write(uri, String(mode || ''));
  } catch(e) {}
}

function nextMode(mode){
  var modes = ['lower', 'upper', 'sentence'];
  var i = -1;
  try {
    for (var k=0;k<modes.length;k++){ if (modes[k] === mode) { i = k; break; } }
  } catch(e) {}
  return modes[(i >= 0 ? (i + 1) : 0) % modes.length];
}

function toSentenceCase(s){
  // "Sentence case": заглавная только у первой буквы строки и после . ! ?
  // Совместимо со старым JS-движком: без Unicode property escapes.
  // Поддерживает латиницу и кириллицу; сохраняет разделители.
  try { s = String(s); } catch(e) { return s; }
  var lower = '';
  try { lower = s.toLowerCase(); } catch(e0) { lower = s; }
  // Первая буква строки
  var out = lower.replace(/^([^A-Za-z\u0400-\u04FF]*)([A-Za-z\u0400-\u04FF])/, function(m, p1, p2){
    try { return p1 + String(p2).toUpperCase(); } catch(e1) { return m; }
  });
  // Первая буква после . ! ? (допуская пробелы/переносы/кавычки/скобки)
  return out.replace(/([.!?]+[\s\u00A0\r\n]+[\(\[\{\"'«„“”‘’]*)([A-Za-z\u0400-\u04FF])/g, function(m, p1, p2){
    try { return p1 + String(p2).toUpperCase(); } catch(e2) { return m; }
  });
}

function transformText(text, mode){
  try { text = String(text); } catch(e) { return text; }
  if (mode === 'upper') { try { return text.toUpperCase(); } catch(e0) { return text; } }
  if (mode === 'sentence') { return toSentenceCase(text); }
  // lower (default)
  try { return text.toLowerCase(); } catch(e1) { return text; }
}

function isTextLikeElement(el){
  try {
    if (!el) return false;
    if (el.elementType === 'text') return true;
    // На разных версиях Animate могут отличаться типы, поэтому проверяем методы
    if (typeof el.getTextString === 'function' && typeof el.setTextString === 'function') return true;
  } catch(e) {}
  return false;
}

function getText(el){
  try {
    if (el && typeof el.getTextString === 'function') return el.getTextString();
  } catch(e0) {}
  try {
    if (el && typeof el.textString === 'string') return el.textString;
  } catch(e1) {}
  return null;
}

function setText(el, s){
  try {
    if (el && typeof el.setTextString === 'function') { el.setTextString(String(s)); return true; }
  } catch(e0) {}
  try {
    if (el && typeof el.textString === 'string') { el.textString = String(s); return true; }
  } catch(e1) {}
  return false;
}

function modeLabel(mode){
  if (mode === 'upper') return 'UPPERCASE';
  if (mode === 'sentence') return 'Sentence case';
  return 'lowercase';
}

function main(){
  var dom = fl.getDocumentDOM();
  if (!dom) { return "Нет открытого документа"; }

  var logs = []; function log(m){ try{ logs.push(String(m)); }catch(e){} }

  var current = readMode();
  var mode = nextMode(current);

  var sel = [];
  try { sel = dom.selection || []; } catch(eSel) { sel = []; }
  if (!sel || !sel.length) {
    writeMode(mode);
    return writeStatusAndReturn("Нет выделения. Режим переключён → " + modeLabel(mode), logs);
  }

  var changed = 0;
  var skipped = 0;
  for (var i=0;i<sel.length;i++){
    var el = sel[i];
    if (!isTextLikeElement(el)) { skipped++; continue; }
    var t = getText(el);
    if (t == null) { skipped++; continue; }
    var nt = transformText(t, mode);
    if (nt === t) { skipped++; continue; }
    if (setText(el, nt)) changed++; else skipped++;
  }

  writeMode(mode);
  return writeStatusAndReturn("Регистр: " + modeLabel(mode) + ". Изменено: " + changed + ", пропущено: " + skipped, logs);
}

// Вызов для fl.runScript
main();

