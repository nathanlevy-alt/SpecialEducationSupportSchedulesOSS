function colLettersToNumber(letters) {
  let col = 0;
  for (const ch of String(letters || '').toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return col || 1;
}

function numberToColLetters(n) {
  n = Math.max(1, Number(n) || 1);
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseA1(a1, sheet) {
  const s = String(a1 || '').trim().replace(/^.*!/, '');
  const parts = s.split(':');
  const parsePart = (p) => {
    const m = String(p || '').match(/^([A-Z]+)?(\d+)?$/i);
    if (!m) return { col: 1, row: 1, hasCol: false, hasRow: false };
    return {
      col: m[1] ? colLettersToNumber(m[1]) : 1,
      row: m[2] ? parseInt(m[2], 10) : 1,
      hasCol: !!m[1],
      hasRow: !!m[2]
    };
  };
  const a = parsePart(parts[0]);
  const b = parts.length > 1 ? parsePart(parts[1]) : null;
  const maxRows = sheet ? Math.max(sheet.getMaxRows(), sheet.getLastRow(), 1000) : 1000;
  const maxCols = sheet ? Math.max(sheet.getMaxColumns(), sheet.getLastColumn(), 26) : 26;
  if (!b) return { row: a.row || 1, col: a.col || 1, numRows: 1, numCols: 1 };
  const row1 = a.hasRow ? a.row : 1;
  const col1 = a.hasCol ? a.col : 1;
  const row2 = b.hasRow ? b.row : maxRows;
  const col2 = b.hasCol ? b.col : maxCols;
  return {
    row: Math.min(row1, row2),
    col: Math.min(col1, col2),
    numRows: Math.max(1, Math.abs(row2 - row1) + 1),
    numCols: Math.max(1, Math.abs(col2 - col1) + 1)
  };
}

function ensureSize(values, rows, cols) {
  while (values.length < rows) values.push([]);
  for (let r = 0; r < rows; r++) {
    while (values[r].length < cols) values[r].push('');
  }
}

function blankMatrix(rows, cols) {
  return Array.from({ length: Math.max(1, rows || 1) }, () => Array.from({ length: Math.max(1, cols || 1) }, () => ''));
}

function cellValueFromRichText(value) {
  if (value && typeof value.getText === 'function') return value.getText();
  if (value && typeof value.text === 'string') return value.text;
  return value == null ? '' : value;
}

function makeTextFinder(range, pattern) {
  const wanted = String(pattern == null ? '' : pattern);
  let matchCase = false;
  let useRegex = false;
  let matchEntire = false;
  const allCells = () => {
    const values = range.getDisplayValues();
    const out = [];
    for (let r = 0; r < values.length; r++) {
      for (let c = 0; c < values[r].length; c++) {
        out.push({ range: new RedisRange(range.sheet, range.row + r, range.col + c, 1, 1), text: String(values[r][c] || '') });
      }
    }
    return out;
  };
  const test = (text) => {
    const hay = matchCase ? text : text.toLowerCase();
    const needle = matchCase ? wanted : wanted.toLowerCase();
    if (useRegex) {
      try { return new RegExp(wanted, matchCase ? '' : 'i').test(text); } catch { return false; }
    }
    return matchEntire ? hay === needle : hay.indexOf(needle) >= 0;
  };
  return {
    matchCase(v) { matchCase = v !== false; return this; },
    useRegularExpression(v) { useRegex = v !== false; return this; },
    matchEntireCell(v) { matchEntire = v !== false; return this; },
    findNext() { const hit = allCells().find(x => test(x.text)); return hit ? hit.range : null; },
    findAll() { return allCells().filter(x => test(x.text)).map(x => x.range); },
    replaceAllWith(replacement) { let n = 0; allCells().forEach(x => { if (test(x.text)) { x.range.setValue(String(replacement || '')); n++; } }); return n; }
  };
}

class RedisRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = Math.max(1, Number(row) || 1);
    this.col = Math.max(1, Number(col) || 1);
    this.numRows = Math.max(1, Number(numRows) || 1);
    this.numCols = Math.max(1, Number(numCols) || 1);
  }
  getA1Notation() {
    const start = numberToColLetters(this.col) + this.row;
    const end = numberToColLetters(this.col + this.numCols - 1) + (this.row + this.numRows - 1);
    return this.numRows === 1 && this.numCols === 1 ? start : `${start}:${end}`;
  }
  getValues() {
    const out = [];
    const values = this.sheet.values;
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) {
        row.push(((values[this.row - 1 + r] || [])[this.col - 1 + c]) ?? '');
      }
      out.push(row);
    }
    return out;
  }
  setValues(matrix) {
    matrix = Array.isArray(matrix) ? matrix : [[matrix]];
    ensureSize(this.sheet.values, this.row - 1 + this.numRows, this.col - 1 + this.numCols);
    for (let r = 0; r < this.numRows; r++) {
      for (let c = 0; c < this.numCols; c++) {
        this.sheet.values[this.row - 1 + r][this.col - 1 + c] = cellValueFromRichText(((matrix[r] || [])[c]) ?? '');
      }
    }
    this.sheet.persistSoon();
    return this;
  }
  getValue() { return this.getValues()[0][0]; }
  setValue(value) { return this.setValues(Array.from({ length: this.numRows }, () => Array.from({ length: this.numCols }, () => value))); }
  getDisplayValue() { const v = this.getValue(); return v == null ? '' : String(v); }
  getDisplayValues() { return this.getValues().map(row => row.map(v => v == null ? '' : String(v))); }
  getFormulas() { return this.getValues().map(row => row.map(v => (typeof v === 'string' && v.startsWith('=')) ? v : '')); }
  setFormulas(matrix) { return this.setValues(matrix); }
  getFormulasR1C1() { return this.getFormulas(); }
  setFormulasR1C1(matrix) { return this.setFormulas(matrix); }
  getFormula() { const v = this.getValue(); return (typeof v === 'string' && v.startsWith('=')) ? v : ''; }
  setFormula(formula) { return this.setValue(String(formula || '')); }
  getFormulaR1C1() { return this.getFormula(); }
  setFormulaR1C1(formula) { return this.setFormula(formula); }
  setRichTextValue(value) { return this.setValue(cellValueFromRichText(value)); }
  setRichTextValues(matrix) { return this.setValues((matrix || []).map(row => (row || []).map(cellValueFromRichText))); }
  getRichTextValue() { const text = this.getDisplayValue(); return { getText: () => text, getLinkUrl: () => null, copy: () => ({ setText(){return this;}, build(){return { getText: () => text };} }) }; }
  getRichTextValues() { return this.getDisplayValues().map(row => row.map(text => ({ getText: () => text, getLinkUrl: () => null }))); }
  clearContent() { return this.setValues(blankMatrix(this.numRows, this.numCols)); }
  clearContents() { return this.clearContent(); }
  clear() { return this.clearContent(); }
  clearFormat() { return this; }
  clearDataValidations() { return this; }
  setDataValidation() { return this; }
  setDataValidations() { return this; }
  getDataValidation() { return null; }
  getDataValidations() { return Array.from({ length: this.numRows }, () => Array.from({ length: this.numCols }, () => null)); }
  insertCheckboxes() { return this; }
  removeCheckboxes() { return this; }
  check() { return this.setValue(true); }
  uncheck() { return this.setValue(false); }
  isChecked() { const v = this.getValue(); return v === true || /^true$/i.test(String(v)); }
  setBackground() { return this; }
  setBackgrounds() { return this; }
  setFontWeight() { return this; }
  setFontWeights() { return this; }
  setFontColor() { return this; }
  setFontColors() { return this; }
  setFontSize() { return this; }
  setFontSizes() { return this; }
  setFontFamily() { return this; }
  setFontStyle() { return this; }
  setNumberFormat() { return this; }
  setNumberFormats() { return this; }
  setWrap() { return this; }
  setWraps() { return this; }
  setHorizontalAlignment() { return this; }
  setHorizontalAlignments() { return this; }
  setVerticalAlignment() { return this; }
  setVerticalAlignments() { return this; }
  setBorder() { return this; }
  setFontLine() { return this; }
  setFontLines() { return this; }
  setFontStyles() { return this; }
  setFontFamilies() { return this; }
  setTextStyle() { return this; }
  setTextStyles() { return this; }
  setWrapStrategy() { return this; }
  setWrapStrategies() { return this; }
  setBackgroundObject() { return this; }
  setBackgroundObjects() { return this; }
  setNote() { return this; }
  getNote() { return ''; }
  clearNote() { return this; }
  merge() { return this; }
  mergeAcross() { return this; }
  breakApart() { return this; }
  unmerge() { return this; }
  copyTo(target) { if (target && target.setValues) target.setValues(this.getValues()); return target || this; }
  offset(r, c, nr, nc) { return new RedisRange(this.sheet, this.row + (r || 0), this.col + (c || 0), nr || this.numRows, nc || this.numCols); }
  getSheet() { return this.sheet; }
  createTextFinder(pattern) { return makeTextFinder(this, pattern); }
  sort() { return this; }
  getRow() { return this.row; }
  getColumn() { return this.col; }
  getNumRows() { return this.numRows; }
  getNumColumns() { return this.numCols; }
}

class RedisSheet {
  constructor(spreadsheet, name, values = []) {
    this.spreadsheet = spreadsheet;
    this.name = name;
    this.values = Array.isArray(values) ? values : [];
    this.hidden = false;
  }
  key_() { return `gas:spreadsheet:${this.spreadsheet.id}:sheet:${this.name}:values`; }
  persistSoon() { this.spreadsheet.persistSheet(this); }
  getName() { return this.name; }
  setName(name) { this.spreadsheet.sheets.delete(this.name); this.name = name; this.spreadsheet.sheets.set(name, this); this.persistSoon(); return this; }
  getParent() { return this.spreadsheet; }
  getSheetId() { let h=0; for (const ch of this.name) h=((h<<5)-h)+ch.charCodeAt(0), h|=0; return Math.abs(h); }
  activate() { return this; }
  getLastRow() {
    for (let r = this.values.length - 1; r >= 0; r--) {
      if ((this.values[r] || []).some(v => v !== '' && v != null)) return r + 1;
    }
    return 0;
  }
  getLastColumn() {
    let max = 0;
    this.values.forEach(row => { for (let c = row.length - 1; c >= 0; c--) { if (row[c] !== '' && row[c] != null) { max = Math.max(max, c + 1); break; } } });
    return max;
  }
  getMaxRows() { return Math.max(this.values.length, 1000); }
  getMaxColumns() { return Math.max(this.getLastColumn(), 26); }
  getRange(row, col, numRows, numCols) {
    if (typeof row === 'string') {
      const p = parseA1(row, this);
      return new RedisRange(this, p.row, p.col, p.numRows, p.numCols);
    }
    return new RedisRange(this, row, col, numRows, numCols);
  }
  getDataRange() { return new RedisRange(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getSheetValues(startRow, startColumn, numRows, numColumns) { return this.getRange(startRow, startColumn, numRows, numColumns).getValues(); }
  appendRow(row) { this.values.push(Array.isArray(row) ? row.slice() : [row]); this.persistSoon(); return this; }
  createTextFinder(pattern) { return makeTextFinder(this.getDataRange(), pattern); }
  insertRowBefore(rowPosition) { this.values.splice(Math.max(0, rowPosition - 1), 0, []); this.persistSoon(); return this; }
  insertRowAfter(rowPosition) { this.values.splice(Math.max(0, rowPosition), 0, []); this.persistSoon(); return this; }
  insertRowsAfter(afterPosition, howMany) { const rows = Array.from({ length: howMany || 1 }, () => []); this.values.splice(afterPosition, 0, ...rows); this.persistSoon(); return this; }
  insertRowsBefore(beforePosition, howMany) { const rows = Array.from({ length: howMany || 1 }, () => []); this.values.splice(beforePosition - 1, 0, ...rows); this.persistSoon(); return this; }
  insertColumnAfter(afterPosition) { return this.insertColumnsAfter(afterPosition, 1); }
  insertColumnsAfter(afterPosition, howMany) { const n = howMany || 1; this.values.forEach(row => row.splice(afterPosition, 0, ...Array(n).fill(''))); this.persistSoon(); return this; }
  insertColumnsBefore(beforePosition, howMany) { const n = howMany || 1; this.values.forEach(row => row.splice(beforePosition - 1, 0, ...Array(n).fill(''))); this.persistSoon(); return this; }
  deleteRow(rowPosition) { return this.deleteRows(rowPosition, 1); }
  deleteRows(rowPosition, howMany) { this.values.splice(rowPosition - 1, howMany || 1); this.persistSoon(); return this; }
  deleteColumn(colPosition) { return this.deleteColumns(colPosition, 1); }
  deleteColumns(colPosition, howMany) { const n = howMany || 1; this.values.forEach(row => row.splice(colPosition - 1, n)); this.persistSoon(); return this; }
  clear() { this.values = []; this.persistSoon(); return this; }
  clearContents() { return this.clear(); }
  clearConditionalFormatRules() { return this; }
  getFilter() { return null; }
  hideSheet() { this.hidden = true; return this; }
  showSheet() { this.hidden = false; return this; }
  setFrozenRows() { return this; }
  setFrozenColumns() { return this; }
  autoResizeColumns() { return this; }
  autoResizeColumn() { return this; }
  setColumnWidth() { return this; }
  setColumnWidths() { return this; }
  setRowHeight() { return this; }
  setRowHeights() { return this; }
  hideRows() { return this; }
  showRows() { return this; }
  hideColumns() { return this; }
  showColumns() { return this; }
  sort() { return this; }
  copyTo(spreadsheet) { const copy = new RedisSheet(spreadsheet || this.spreadsheet, this.name + ' Copy', JSON.parse(JSON.stringify(this.values || []))); if (spreadsheet && spreadsheet.sheets) spreadsheet.sheets.set(copy.getName(), copy); return copy; }
  protect() { return { setDescription(){return this;}, addEditor(){return this;}, removeEditors(){return this;}, setWarningOnly(){return this;} }; }
}

class RedisSpreadsheet {
  constructor(service, id) {
    this.service = service;
    this.id = id;
    this.sheets = new Map();
  }
  async hydrate() {
    const redis = this.service.redis;
    if (!redis || !redis.keys) return;
    const keys = await redis.keys(`gas:spreadsheet:${this.id}:sheet:*:values`);
    if (!keys.length) return;
    // PERFORMANCE (Redis round trips): every legacy .gs call re-hydrates the active
    // spreadsheet from scratch (see __setActiveSpreadsheetId in googleServices.js — that
    // per-call refresh is intentional and correct, it's what stops the in-process
    // spreadsheet cache from serving stale data across requests). What was NOT intentional
    // is that this used to fetch each sheet with its own sequential `await redis.get(key)`
    // in a for-loop — for a spreadsheet with N sheets, that's N round trips taken one after
    // another on every single admin/staff request, even when that request only needed one
    // or two of those sheets. Batching via mGet turns N sequential round trips into one,
    // which matters both for latency (each round trip to a hosted Redis like Upstash is
    // real network time, not free) and for cost on providers that bill per command.
    let raws;
    if (typeof redis.mGet === 'function') {
      raws = await redis.mGet(keys);
    } else {
      raws = await Promise.all(keys.map(key => redis.get(key)));
    }
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const name = key.split(':sheet:')[1].replace(/:values$/, '');
      try { this.sheets.set(name, new RedisSheet(this, name, JSON.parse(raws[i] || '[]'))); } catch { this.sheets.set(name, new RedisSheet(this, name, [])); }
    }
  }
  getId() { return this.id; }
  getName() { return this.id; }
  getUrl() { return `redis://spreadsheet/${this.id}`; }
  getSheets() { return [...this.sheets.values()]; }
  getSheetName() { return this.getName(); }
  getActiveSheet() { const sheets=this.getSheets(); return sheets[0] || this.insertSheet('Sheet1'); }
  setActiveSheet(sheet) { return sheet; }
  getSheetByName(name) {
    // Match Google Apps Script behavior: getSheetByName returns null when the
    // sheet does not exist. Older Redis parity builds accidentally auto-created
    // empty sheets here, which caused lookup code that tests candidate sheet
    // names to stop on the first non-existing candidate. In Staff Portal, that
    // meant the legacy emoji staff-sheet candidate was created empty and the
    // real Staff sheet was never read.
    return this.sheets.has(name) ? this.sheets.get(name) : null;
  }
  insertSheet(name) { const s = new RedisSheet(this, name || `Sheet${this.sheets.size + 1}`, []); this.sheets.set(s.getName(), s); s.persistSoon(); return s; }
  deleteSheet(sheet) { if (sheet) { this.sheets.delete(sheet.getName()); const redis = this.service.redis; if (redis && redis.del) this.service.trackWrite(redis.del(sheet.key_()).catch(() => {})); } return this; }
  toast(msg) { console.log('[toast]', msg); }
  addMenu() { return this; }
  updateMenu() { return this; }
  persistSheet(sheet) {
    const redis = this.service.redis;
    if (redis && redis.set) this.service.trackWrite(redis.set(sheet.key_(), JSON.stringify(sheet.values)).catch((err) => console.error('[redis sheet persist]', err.message)));
  }
}

class RedisSpreadsheetApp {
  constructor(redis, options = {}) {
    this.redis = redis;
    this.activeId = options.activeSpreadsheetId || 'default-school';
    this.cache = new Map();
    this.pendingWrites = [];
  }
  trackWrite(promise) { if (promise && typeof promise.then === 'function') this.pendingWrites.push(promise); }
  async flush() {
    const pending = this.pendingWrites.splice(0);
    if (pending.length) await Promise.allSettled(pending);
  }
  async hydrateSpreadsheet(id) {
    const sid = id || this.activeId;
    if (!this.cache.has(sid)) {
      const ss = new RedisSpreadsheet(this, sid);
      await ss.hydrate();
      this.cache.set(sid, ss);
    }
    return this.cache.get(sid);
  }
  async hydrateAll() {
    if (!this.redis || !this.redis.keys) return;
    const keys = await this.redis.keys('gas:spreadsheet:*:sheet:*:values');
    const ids = new Set(keys.map(k => String(k).split(':')[2]).filter(Boolean));
    ids.add(this.activeId);
    for (const id of ids) await this.hydrateSpreadsheet(id);
  }
  openById(id) { if (!this.cache.has(id)) this.cache.set(id, new RedisSpreadsheet(this, id)); return this.cache.get(id); }
  openByUrl(url) { const id = String(url || '').split('/').filter(Boolean).pop() || url || this.activeId; return this.openById(id); }
  getActive() { return this.openById(this.activeId); }
  getActiveSpreadsheet() { return this.getActive(); }
  create(name) { const ss = new RedisSpreadsheet(this, name || `spreadsheet-${Date.now()}`); this.cache.set(ss.getId(), ss); return ss; }
  newDataValidation() { return { requireValueInList(){return this;}, requireValueInRange(){return this;}, requireCheckbox(){return this;}, setAllowInvalid(){return this;}, setHelpText(){return this;}, build(){return {};}}; }
  newRichTextValue() { return { setText(){return this;}, setLinkUrl(){return this;}, setTextStyle(){return this;}, build(){return { getText(){ return ''; } };} }; }
  getUi() { return { alert(){ return null; }, prompt(){ return { getResponseText(){return '';}, getSelectedButton(){return 'OK';} }; }, Button:{OK:'OK',YES:'YES',NO:'NO'}, ButtonSet:{OK:'OK',YES_NO:'YES_NO'} }; }
}


module.exports = { RedisSpreadsheetApp, RedisSpreadsheet, RedisSheet, RedisRange, parseA1, numberToColLetters };
