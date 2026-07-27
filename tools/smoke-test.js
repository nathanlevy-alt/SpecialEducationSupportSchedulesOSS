const { getRedis } = require('../src/redisClient');
const { createRuntime } = require('../src/runtime/appsScriptRuntime');
(async () => {
  process.env.REDIS_URL = process.env.REDIS_URL || 'memory';
  const runtime = await createRuntime(await getRedis());
  const adminFns = runtime.listFunctions('admin').length;
  const staffFns = runtime.listFunctions('staff').length;
  const connectorFns = runtime.listFunctions('connector').length;
  const adminHtml = await runtime.call('admin', 'doGet', [{ parameter: {} }]);
  const staffHtml = await runtime.call('staff', 'renderPublicStaffPortalPage_', [{}, null]);
  if (!String(adminHtml).includes('<!DOCTYPE html') && !String(adminHtml).includes('<!doctype html')) throw new Error('Admin HTML did not render.');
  if (!String(staffHtml).includes('<!doctype html')) throw new Error('Staff HTML did not render.');
  console.log(JSON.stringify({ ok: true, adminFns, staffFns, connectorFns, adminHtmlBytes: String(adminHtml).length, staffHtmlBytes: String(staffHtml).length }, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
