/**
 * GA Scheduler - Email Communication Connector (standalone deployment)
 * Version: 1.4.3-email-only
 *
 * Purpose:
 * - Receives schedule-notification payloads from the GA Scheduler Admin script.
 * - Sends email notifications through MailApp from the connector owner/deployer.
 * - Email-only connector; no premium workflow dependency.
 *
 * Required Script Properties:
 * - GA_SCHEDULER_COMM_SHARED_SECRET = same shared secret saved in GA Scheduler Admin.
 *
 * Optional Script Properties:
 * - CONNECTOR_TEST_RECIPIENT = your email for local connector tests.
 *
 * Deploy as a Web App:
 * - Execute as: Me / script owner.
 * - Access: Anyone with the link, or domain-only if the Admin script can call it.
 */

const GA_SCHEDULER_COMM_CONNECTOR_VERSION = '1.4.3-email-only';

function doPost(e) {
  try {
    const payload = parseConnectorPayload_(e);
    validateConnectorSecret_(payload);
    const modality = cleanConnector_(payload.modality).toLowerCase();
    if (modality && modality !== 'email' && modality !== 'mail') {
      return connectorJson_({ ok: false, version: GA_SCHEDULER_COMM_CONNECTOR_VERSION, message: 'Unsupported modality in email-only connector: ' + payload.modality });
    }
    return connectorJson_(sendEmailNotification_(payload));
  } catch (err) {
    return connectorJson_({ ok: false, version: GA_SCHEDULER_COMM_CONNECTOR_VERSION, message: String(err && err.message || err) });
  }
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (String(params.setup || '').toLowerCase() === '1') {
    return HtmlService.createHtmlOutput(connectorSetupHtml_()).setTitle('GA Scheduler Email Connector Setup');
  }
  return connectorJson_({ ok: true, version: GA_SCHEDULER_COMM_CONNECTOR_VERSION, message: 'GA Scheduler Email Communication Connector is running. Use POST from the Admin Portal to send messages.', setupPage: 'Add ?setup=1 to this URL for setup guidance.' });
}

function parseConnectorPayload_(e) {
  const text = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!text) throw new Error('Missing POST body.');
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== 'object') throw new Error('POST body was not a JSON object.');
  return obj;
}
function connectorJson_(obj) { return ContentService.createTextOutput(JSON.stringify(obj || {}, null, 2)).setMimeType(ContentService.MimeType.JSON); }
function connectorProps_() { return PropertiesService.getScriptProperties(); }
function connectorProp_(key, fallback) { const v = connectorProps_().getProperty(key); return v == null || v === '' ? fallback : v; }
function cleanConnector_(v) { return String(v == null ? '' : v).trim(); }
function generateConnectorSecret_() { return 'ga-scheduler-comm-' + Utilities.getUuid().replace(/-/g, '').slice(0, 20) + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12); }

function validateConnectorSecret_(payload) {
  const expected = cleanConnector_(connectorProp_('GA_SCHEDULER_COMM_SHARED_SECRET', ''));
  if (!expected) throw new Error('GA_SCHEDULER_COMM_SHARED_SECRET is not configured in connector Script Properties.');
  const received = cleanConnector_(payload.sharedSecret || '');
  if (!received || received !== expected) throw new Error('Shared secret mismatch.');
  return true;
}
function connectorEmailList_(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  return raw.split(/[\s,;]+/).map(cleanConnector_).filter(function(e){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }).filter(function(e,i,a){ return a.indexOf(e) === i; });
}
function sendEmailNotification_(payload) {
  const recipients = connectorEmailList_(payload.recipients || payload.recipient || payload.to || '');
  if (!recipients.length) throw new Error('No valid email recipient was provided.');
  const subject = cleanConnector_(payload.subject || 'Schedule update');
  const body = cleanConnector_(payload.body || payload.text || 'A schedule update is available.');
  const fromName = cleanConnector_(payload.fromName || 'Support Schedules Schedule Update');
  MailApp.sendEmail({ to: recipients.join(','), subject: subject, body: body, name: fromName });
  return { ok: true, version: GA_SCHEDULER_COMM_CONNECTOR_VERSION, modality: 'email', recipients: recipients, message: 'Email sent by connector deployment.' };
}
function getConnectorSetupInfo() {
  const props = connectorProps_();
  const secret = cleanConnector_(props.getProperty('GA_SCHEDULER_COMM_SHARED_SECRET') || '');
  const testRecipient = cleanConnector_(props.getProperty('CONNECTOR_TEST_RECIPIENT') || '');
  let activeUser = '';
  try { activeUser = Session.getActiveUser().getEmail() || ''; } catch (err) {}
  return { ok: true, version: GA_SCHEDULER_COMM_CONNECTOR_VERSION, sharedSecretConfigured: !!secret, sharedSecretPreview: secret ? (secret.slice(0, 18) + '...' + secret.slice(-6)) : '', testRecipientConfigured: !!testRecipient, testRecipient: testRecipient, activeUser: activeUser };
}
function setupConnectorTemplate() {
  const props = connectorProps_();
  let secret = cleanConnector_(props.getProperty('GA_SCHEDULER_COMM_SHARED_SECRET') || '');
  if (!secret) { secret = generateConnectorSecret_(); props.setProperty('GA_SCHEDULER_COMM_SHARED_SECRET', secret); }
  let testRecipient = cleanConnector_(props.getProperty('CONNECTOR_TEST_RECIPIENT') || '');
  if (!testRecipient) { try { testRecipient = Session.getActiveUser().getEmail() || ''; } catch (err) { testRecipient = ''; } if (testRecipient) props.setProperty('CONNECTOR_TEST_RECIPIENT', testRecipient); }
  Logger.log('GA Scheduler Email Connector setup complete.');
  Logger.log('Copy this shared secret into the Admin Portal Communication card:');
  Logger.log(secret);
  const info = getConnectorSetupInfo();
  info.sharedSecret = secret;
  info.message = 'Connector setup complete. Copy sharedSecret into the Admin Portal Communication card.';
  return info;
}
function authorizeAllConnectorServices() { return authorizeEmailConnector(); }
function authorizeEmailConnector() { const remaining = MailApp.getRemainingDailyQuota(); Logger.log('Email connector authorized. Remaining daily recipient quota: ' + remaining); return { ok: true, version: GA_SCHEDULER_COMM_CONNECTOR_VERSION, remainingMailQuota: remaining }; }
function testEmailConnector() {
  const recipient = cleanConnector_(connectorProp_('CONNECTOR_TEST_RECIPIENT', ''));
  if (!recipient) throw new Error('Set Script Property CONNECTOR_TEST_RECIPIENT first.');
  return sendEmailNotification_({ recipient: recipient, subject: 'Support Schedules email connector test', body: 'If you received this, the Support Schedules Email Communication Connector can send email from this connector deployment.', fromName: 'Support Schedules Schedule Update' });
}
function connectorSetupHtml_() {
  const info = getConnectorSetupInfo();
  const esc = function(v) { return String(v == null ? '' : v).replace(/[&<>\"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]; }); };
  return '<!doctype html><html><head><base target="_top"><style>body{font-family:Arial,Helvetica,sans-serif;margin:24px;background:#f8fafc;color:#0f172a}.card{max-width:780px;margin:0 auto;background:#fff;border:1px solid #dbe5f3;border-radius:18px;padding:20px;box-shadow:0 8px 24px rgba(15,23,42,.08)}h1{margin:0 0 8px;font-size:24px}.pill{display:inline-block;padding:4px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-weight:800;font-size:12px}.warn{background:#fff7ed;color:#9a3412}.steps{line-height:1.55}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1f5f9;border-radius:8px;padding:2px 6px}.status{display:grid;grid-template-columns:220px 1fr;gap:8px;margin:14px 0}.muted{color:#64748b;font-size:13px}</style></head><body><div class="card"><h1>GA Scheduler Email Connector</h1><div class="muted">Version ' + esc(GA_SCHEDULER_COMM_CONNECTOR_VERSION) + '</div><div class="status"><strong>Shared secret</strong><span class="pill ' + (info.sharedSecretConfigured ? '' : 'warn') + '">' + (info.sharedSecretConfigured ? 'Configured' : 'Missing') + '</span><strong>Active user</strong><span>' + esc(info.activeUser || 'Unknown') + '</span><strong>Test recipient</strong><span>' + esc(info.testRecipient || 'Not set') + '</span></div><ol class="steps"><li>Run <span class="mono">setupConnectorTemplate()</span>.</li><li>Run <span class="mono">authorizeAllConnectorServices()</span>.</li><li>Deploy as Web App, Execute as Me.</li><li>Paste this Web App URL into GA Scheduler Admin Communication Beta as the Email connector URL.</li><li>Paste the same shared secret into the Email shared secret field.</li></ol><p class="muted">This connector is email-only.</p></div></body></html>';
}
