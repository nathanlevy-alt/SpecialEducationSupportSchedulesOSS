const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const files = {
  admin: path.join(root, 'legacy', 'admin_portal_current_m46.gs'),
  staff: path.join(root, 'legacy', 'staff_portal_current_1_3_8.gs'),
  connector: path.join(root, 'legacy', 'email_connector_current_1_4_3.gs')
};
function functions(src) {
  const set = new Set();
  for (const m of src.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)) set.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?function\s*\(/g)) set.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g)) set.add(m[1]);
  return [...set].sort();
}
const out = {};
for (const [name, file] of Object.entries(files)) {
  const src = fs.readFileSync(file, 'utf8');
  out[name] = { file: path.relative(root, file), bytes: src.length, functions: functions(src) };
}
fs.writeFileSync(path.join(root, 'docs', 'function_inventory.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k,v]) => [k, { bytes: v.bytes, functionCount: v.functions.length }])) , null, 2));
