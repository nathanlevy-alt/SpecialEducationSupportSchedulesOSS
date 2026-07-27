/**
 * GA Scheduler - Public Staff Portal (Redis single-app staff route)
 * Version: 1.3.8-column-k-read-write-current
 *
 * Public/no-login staff-only portal. This version is server-rendered so the
 * schedule, header, and navigation work even when client-side JS is restricted.
 *
 * Redis runtime note: staff portal school/token configuration is seeded by the Node server from Redis and environment variables:
 * 1) V5_PUBLIC_STAFF_PORTAL_SCHOOLS_JSON
 *    Example:
 *    {"top":{"name":"Transition Opportunity Program","spreadsheetId":"PASTE_TOP_SCHOOL_SPREADSHEET_ID"}}
 *
 * 2) V5_STAFF_PORTAL_TOKEN_SECRET_V5312
 *    Must exactly match the Admin Portal script property with the same name.
 *
 * V1.2.7: Displays both System Admin global Staff Portal announcements and
 * selected-school Staff Portal announcements when both are present.
 *
 * V1.2.8: Sends absence notification emails through MailApp using the
 * selected school workbook's V5_ABSENCE_NOTIFY_EMAILS setting.
 *
 * V1.3.2: Removes visible diagnostics and improves absence confirmation recap UI.
 *
 * V1.3.3: Adds staff-specific update modal for unique-link staff users.
 * V1.3.4: Current Staff Portal companion for Admin m30 / Connector v1.2; no workflow changes beyond version alignment.
 * V1.3.5: Email-only notification update; the public UI and save path now collect only a notification email.
 * V1.3.6: Renames notification email UI to Email, removes district-email hint, and reads/writes column K exactly.
 * V1.3.7: Keeps the original Notification Email label/hint while preserving exact column K read/write behavior.
 * V1.3.8: Version alignment with Admin m46; no workflow change.
 */

const PUBLIC_STAFF_PORTAL_VERSION = '1.3.8-column-k-read-write-current';
const PUBLIC_STAFF_PORTAL_PROPERTY_SCHOOLS = 'V5_PUBLIC_STAFF_PORTAL_SCHOOLS_JSON';
const PUBLIC_STAFF_PORTAL_PROPERTY_SECRET = 'V5_STAFF_PORTAL_TOKEN_SECRET_V5312';
const PUBLIC_STAFF_PORTAL_PROPERTY_SHEET = '_V5Properties';
const PUBLIC_STAFF_PORTAL_HISTORY_SHEET = '_ScheduleHistory';
const PUBLIC_STAFF_PORTAL_CHUNK_PREFIX = '__V5263_CHUNKED__:';
const PUBLIC_STAFF_PORTAL_CHUNK_MARK = '::chunk::';
const PUBLIC_STAFF_PORTAL_ANNOUNCEMENT_PROP = 'V5_STAFF_PORTAL_ANNOUNCEMENT_JSON';
const PUBLIC_STAFF_PORTAL_GLOBAL_ANNOUNCEMENT_PROP = 'V5_STAFF_PORTAL_GLOBAL_ANNOUNCEMENT_JSON';
const PUBLIC_STAFF_PORTAL_SCHOOL_ANNOUNCEMENT_PROP = 'V5_STAFF_PORTAL_SCHOOL_ANNOUNCEMENT_JSON';



function doGet(e) {
  const params = (e && e.parameter) || {};
  return HtmlService.createHtmlOutput(renderPublicStaffPortalPage_(params, null))
    .setTitle('Staff Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  const action = cleanPublic_(params.action || 'submitAbsence');
  let notice = null;
  try {
    if (action === 'saveCommunicationPreferences') {
      const result = savePublicStaffCommunicationPreferences_(params);
      notice = {
        type: 'ok',
        kind: 'prefs',
        text: (result && result.message) || 'Email saved.',
        result: result || {}
      };
      params.view = cleanPublic_(params.returnView || params.view || 'my');
    } else if (action === 'savePublicStaffPhone') {
      const result = savePublicStaffPhone_(params);
      notice = {
        type: 'ok',
        kind: 'phone',
        text: (result && result.message) || 'Phone saved.',
        result: result || {}
      };
      params.view = cleanPublic_(params.returnView || params.view || 'my');
    } else if (action === 'refreshView') {
      // Node has already performed a save directly against the same underlying store this
      // page reads from -- this just re-renders with the outcome Node determined, without
      // performing any save of its own.
      const noticeKind = cleanPublic_(params.noticeKind || 'phone');
      const noticeType = cleanPublic_(params.noticeType || 'ok');
      notice = { type: noticeType, kind: noticeKind, text: cleanPublic_(params.noticeText || ''), result: {} };
      params.view = cleanPublic_(params.returnView || params.view || 'my');
    } else {
      const result = submitStaffAbsencePublic(params);
      notice = {
        type: 'ok',
        kind: 'absence',
        text: (result && result.message) || 'Absence report submitted.',
        result: result || {}
      };
      params.view = 'absence';
    }
  } catch (err) {
    var errKind = action === 'saveCommunicationPreferences' ? 'prefs' : ((action === 'savePublicStaffPhone' || action === 'refreshView') ? 'phone' : 'absence');
    notice = { type: 'err', kind: errKind, text: (err && err.message) ? err.message : String(err || 'Could not process your request.') };
    if (action === 'saveCommunicationPreferences' || action === 'savePublicStaffPhone' || action === 'refreshView') params.view = cleanPublic_(params.returnView || params.view || 'my');
    else params.view = 'absence';
  }
  return HtmlService.createHtmlOutput(renderPublicStaffPortalPage_(params, notice))
    .setTitle('Staff Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function renderPublicStaffPortalPage_(params, notice) {
  params = params || {};
  const rawSchoolId = cleanPublic_(params.school || params.schoolId || params.campus || params.campusId || '');
  const staffName = cleanPublic_(params.staff || params.staffName || params.name || '');
  const staffToken = cleanPublic_(params.staffToken || params.token || '');
  let data;
  try {
    data = getStaffPortalDataPublic({ school: rawSchoolId, staffName: staffName, staffToken: staffToken });
  } catch (err) {
    data = {
      ok: false,
      version: PUBLIC_STAFF_PORTAL_VERSION,
      schoolId: rawSchoolId,
      schoolName: '',
      error: (err && err.message) ? err.message : String(err || 'Could not load Staff Portal.'),
      items: [],
      staffSchedules: [],
      studentSchedules: [],
      breakItems: [],
      activeStaff: [],
      regularSchedule: { displayOnStaffPortal: false, schedules: [] },
      staffIdentity: { valid: false, staffName: '', token: staffToken },
      communicationPreferences: publicDefaultStaffCommunicationPreferences_(),
      announcement: { hidden: true, headline: '', note: '', target: 'staff' },
      announcements: []
    };
  }

  const hasStaffIdentity = !!(data && data.staffIdentity && data.staffIdentity.valid && data.staffIdentity.staffName);
  const regular = (data && data.regularSchedule) || { displayOnStaffPortal: false, schedules: [] };
  const hasRegular = !!(regular.displayOnStaffPortal && regular.schedules && regular.schedules.length);
  let view = cleanPublic_(params.view || '');
  if (!view) view = hasStaffIdentity ? 'my' : 'staff';
  if (view === 'my' && !hasStaffIdentity) view = 'staff';
  if (view === 'regular' && !hasRegular) view = 'staff';
  const schoolId = cleanPublic_(data.schoolId || rawSchoolId || '');
  const title = data.schoolName ? data.schoolName + ' Staff Portal' : 'Staff Portal';
  const subtitle = publicPortalSubtitle_(data);
  const regularIndex = Math.max(0, Number(params.regularIndex || 0) || 0);

  let body = '';
  if (data.error) {
    body += '<div class="configBox"><b>Staff Portal could not load schedule data.</b><br>' + escPublic_(data.error) + '</div>';
  } else if (data.staffIdentity && data.staffIdentity.error) {
    body += '<div class="configBox">' + escPublic_(data.staffIdentity.error) + '</div>';
  }
  if (notice && notice.text) {
    if (data && notice.type === 'ok' && notice.kind === 'absence') {
      data.absenceNotice = notice;
    } else {
      body += '<div class="msg ' + escPublic_(notice.type || 'err') + '">' + escPublic_(notice.text) + '</div>';
    }
  }
  body += renderPublicStaffAnnouncements_(data && (data.announcements || data.announcement));

  body += renderPublicPortalTabs_(view, schoolId, staffName, staffToken, hasStaffIdentity, hasRegular);
  body += renderPublicAllPortalViews_(view, data, schoolId, staffName, staffToken, regularIndex, hasStaffIdentity, hasRegular);

  return '<!doctype html><html><head><title>Staff Portal</title><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">' +
    '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">' +
    '<style>' + publicPortalCss_() + '</style></head><body><div class="wrap">' +
    '<div class="top"><div class="brand"><h1>' + escPublic_(title) + '</h1><div class="sub">' + escPublic_(subtitle) + '</div></div>' +
    '<div class="tools">' +
    '<a class="btn" href="' + escPublic_(publicPortalLink_(schoolId, staffName, staffToken, view, regularIndex)) + '">Refresh</a><button class="btn" onclick="window.print()">Print</button>' +
    (hasStaffIdentity ? renderPublicCommunicationGear_(data, view, schoolId, staffName, staffToken) : '') +
    '</div></div>' +
    body +
    '</div></body></html>';
}

function publicPortalCss_() {
  return ':root{--blue:#2563eb;--text:#0f172a;--muted:#64748b;--line:#dbe3ef;--bg:#f6f8fb;--card:#fff;--green:#166534;--amber:#92400e;--red:#991b1b;--shadow:0 1px 2px rgba(15,23,42,.04)}' +
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.35}.wrap{max-width:none;width:100%;margin:0 auto;padding:14px}.top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.brand h1{font-size:22px;margin:0;font-weight:900}.sub{color:var(--muted);font-size:12px;margin-top:4px}.tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-left:auto;justify-content:flex-end}.tools .gearBtn{order:99}.btn,.tab{display:inline-block;text-decoration:none;border:1px solid #cfd8e6;background:#fff;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer;color:#0f172a;font-family:inherit;line-height:1.1}.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 12px}.tab{border-radius:999px;font-weight:900}.tab.active,.btn.primary{background:var(--blue);border-color:var(--blue);color:#fff}.card{background:linear-gradient(180deg,#fff,#fbfdff);border:1px solid var(--line);border-radius:16px;padding:14px;margin:10px 0;box-shadow:var(--shadow)}h2{font-size:18px;margin:0 0 10px;font-weight:900}h3{font-size:14px;margin:14px 0 8px;font-weight:900}.stamp{color:var(--muted);font-size:12px;font-style:italic;margin-left:6px}.muted{color:var(--muted);font-size:12px;line-height:1.35}.msg{margin-bottom:12px;border-radius:12px;padding:10px;font-weight:700}.msg.ok{background:#ecfdf5;color:var(--green);border:1px solid #bbf7d0}.msg.err{background:#fef2f2;color:var(--red);border:1px solid #fecaca}.staffAnnouncement{border:1px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;border-radius:14px;padding:10px 12px;margin:8px 0 12px}.staffAnnouncement b{font-weight:900}.staffAnnouncement span{color:#334155}.configBox{border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:12px;padding:10px;margin:8px 0}.successPanel{border:2px solid #86efac;background:#ecfdf5;color:#064e3b;border-radius:16px;padding:22px;margin:6px 0 10px}.successPanel .successTitle{display:flex;align-items:center;gap:10px;margin-bottom:12px}.successPanel .bigCheck{font-size:30px;font-weight:900;line-height:1}.successPanel h2{color:#065f46;margin:0;font-size:24px}.successPanel .recap{margin-top:10px;font-size:15px;line-height:1.45}.successPanel .recap b{font-weight:900}.successPanel .actions{margin-top:18px;display:flex;gap:8px;flex-wrap:wrap}.gearBtn{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;font-size:16px}.modalBackdrop{position:fixed;inset:0;background:rgba(15,23,42,.38);z-index:1000;display:none;align-items:center;justify-content:center;padding:16px}.modalBackdrop.open{display:flex}.modalBox{width:min(560px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 24px 80px rgba(15,23,42,.26);padding:18px}.modalHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.modalHead h2{margin:0}.iconClose{border:0;background:#f1f5f9;border-radius:999px;width:34px;height:34px;font-weight:900;cursor:pointer}.commGrid{display:grid;grid-template-columns:1fr;gap:10px}.commGrid .full{grid-column:1/-1}.formHint{margin-top:6px;color:var(--muted);font-size:12px}.modalActions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}@media(max-width:700px){.commGrid{grid-template-columns:1fr}.modalActions{justify-content:stretch}.modalActions .btn{width:100%;text-align:center}.gearBtn{width:38px;height:38px}}.scroll{overflow-x:auto;overflow-y:visible;border:1px solid #e2e8f0;border-radius:16px;background:#fff;width:100%;max-width:100%;-webkit-overflow-scrolling:touch}.scheduleTable{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;font-size:13px;background:#fff}.scheduleTable th,.scheduleTable td{border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:8px 9px;text-align:left;vertical-align:top}.scheduleTable th{background:#f8fafc;font-size:12px;white-space:nowrap;color:#0f172a;text-transform:none;letter-spacing:0}.scheduleTable tr:last-child td{border-bottom:0}.scheduleTable th:last-child,.scheduleTable td:last-child{border-right:0}.scheduleTable th:first-child,.scheduleTable td:first-child{position:sticky;left:0;background:#fff;z-index:1;font-weight:800;min-width:180px}.scheduleTable th:first-child{background:#f8fafc;z-index:2}.free{color:#64748b;font-style:italic}.need{color:#991b1b;font-weight:800}.studentLink{font-weight:400!important;color:#0f172a;text-decoration:none}.studentRoomGroup .studentLink,.mCard .studentLink{font-weight:400!important}.mCard .studentRoomGroup{font-weight:400!important}.studentLink:hover{text-decoration:underline}.studentRoomGroup{margin:0 0 8px 0}.studentRoomGroup:last-child{margin-bottom:0}.rest{border-top:1px solid #edf2f7;margin-top:4px;padding-top:4px;color:#334155;font-size:12px}.cover{display:block;color:#166534;font-weight:800;margin-top:3px}.mCard{border:1px solid var(--line);border-radius:14px;background:#fff;padding:12px;margin:8px 0}.mTitle{font-size:15px;margin-bottom:6px}.blockName{font-weight:900!important}.blockTime{font-weight:400!important;font-style:italic!important;color:#475569!important;margin-left:4px}.mTitle .blockTime{font-size:14px;font-weight:400!important;font-style:italic!important}.mRow{display:grid;grid-template-columns:105px 1fr;gap:8px;border-top:1px solid #f1f5f9;padding:6px 0}.mPeriod{font-weight:800;color:#334155}.formGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.partialGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.hide{display:none!important}.absenceSwitch{display:flex;align-items:center;gap:8px;margin-top:22px;font-size:13px;font-weight:800}.absenceSwitch input{width:auto}.formRow{margin-bottom:10px}label{display:block;font-size:12px;font-weight:900;margin:0 0 4px;color:#0f172a}input,select,textarea{width:100%;box-sizing:border-box;border:1px solid #cfe0f4;border-radius:12px;padding:9px 10px;font:inherit;background:#fff}textarea{min-height:86px}.smallNote{font-size:11px;color:#64748b;margin-top:4px}.mobileCards{display:none}.desktopTable{display:block}.regularPills{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.regularPills .tab{font-size:12px;padding:6px 10px}.hideView{display:none!important}.commPrefOption{display:flex;align-items:center;gap:8px;padding:8px 2px;font-weight:700;font-size:13px;cursor:pointer}.commPrefOption input{width:auto;margin:0}.commPrefOption input:disabled{cursor:not-allowed}.commPrefOption input:disabled+span{color:#94a3b8}' +
    '@media(max-width:760px){.wrap{padding:10px}.top{display:block}.tools{margin-top:8px}.tabs .tab{flex:1 1 auto}.desktopTable{display:block}.mobileCards{display:none}.formGrid{grid-template-columns:1fr}.card{padding:12px}.scheduleTable th:first-child,.scheduleTable td:first-child{position:static}.stamp{display:block;margin-top:3px}}' +
    '@media print{.tabs,.tools{display:none!important}body{background:#fff}.card{box-shadow:none;border:0;padding:0}.scroll{overflow:visible;border:0}.scheduleTable{font-size:11px}.scheduleTable th,.scheduleTable td{padding:5px}.stamp{color:#000}}';
}

function publicPortalSubtitle_(data) {
  const version = data && (data.scheduleVersionLabel || data.versionLabel || (data.scheduleVersion ? 'v' + data.scheduleVersion : '') || (data.publishedVersion ? 'v' + data.publishedVersion : ''));
  return [data && data.date, data && data.scheduleType, version ? 'Schedule ' + version : '', data && data.publishedAt ? 'Published ' + data.publishedAt : ''].filter(Boolean).join(' · ');
}


function renderPublicStaffAnnouncement_(announcement) {
  announcement = announcement || {};
  const target = String(announcement.target || announcement.broadcastTarget || 'staff').toLowerCase();
  const hidden = announcement.hidden === true || String(announcement.hidden || '').toLowerCase() === 'true';
  const headline = cleanPublic_(announcement.headline || announcement.label || '');
  const note = cleanPublic_(announcement.note || '');
  if (hidden || (target !== 'staff' && target !== 'both' && target !== 'admin & staff' && target !== 'admin_staff') || (!headline && !note)) return '';
  return '<div class="staffAnnouncement">' + (headline ? '<b>' + escPublic_(headline) + '</b>' : '<b>Announcement</b>') + (note ? ' <span>' + escPublic_(note) + '</span>' : '') + '</div>';
}


function renderPublicStaffAnnouncements_(announcements) {
  if (!announcements) return '';
  if (!Array.isArray(announcements)) return renderPublicStaffAnnouncement_(announcements);
  return announcements.map(function(a) { return renderPublicStaffAnnouncement_(a); }).join('');
}

function renderPublicCommunicationGear_(data, view, schoolId, staffName, staffToken) {
  const identity = (data && data.staffIdentity) || {};
  const staff = cleanPublic_(identity.staffName || staffName || '');
  if (!(identity.valid && staff && staffToken)) return '';
  const prefs = (data && data.communicationPreferences) || publicDefaultStaffCommunicationPreferences_();
  const locked = !!(prefs && prefs.emailLocked);
  const lockedNote = locked ? '<div class="formHint"><i class="fa-solid fa-lock"></i> This email address is locked by an administrator. Ask an administrator to change it.</div>' : '<div class="formHint">*District email address preferred</div>';
  const inputDisabled = locked ? ' disabled aria-disabled="true"' : '';
  const saveButton = locked ? '<button class="btn primary" type="button" disabled>Locked</button>' : '<button class="btn primary" type="submit">Save Email</button>';
  const actionUrl = publicPortalLink_(schoolId, staff, staffToken, view || 'my', 0);
  return '<button type="button" class="btn gearBtn" title="Notification email" aria-label="Notification email" onclick="publicOpenCommPrefs_()"><i class="fa-solid fa-gear"></i></button>' +
    '<div id="publicCommPrefsModal" class="modalBackdrop" role="dialog" aria-modal="true" aria-labelledby="publicCommPrefsTitle" onclick="if(event.target===this)publicCloseCommPrefs_()">' +
      '<div class="modalBox">' +
        '<div class="modalHead"><h2 id="publicCommPrefsTitle">Notification Email</h2><button type="button" class="iconClose" aria-label="Close" onclick="publicCloseCommPrefs_()">×</button></div>' +
        '<p class="muted">Update the email address used for schedule notifications.</p>' +
        '<form method="post" action="' + escPublicAttr_(actionUrl) + '">' +
          '<input type="hidden" name="action" value="saveCommunicationPreferences">' +
          '<input type="hidden" name="school" value="' + escPublicAttr_(schoolId) + '">' +
          '<input type="hidden" name="staffName" value="' + escPublicAttr_(staff) + '">' +
          '<input type="hidden" name="staffToken" value="' + escPublicAttr_(staffToken) + '">' +
          '<input type="hidden" name="returnView" value="' + escPublicAttr_(view || 'my') + '">' +
          '<div class="commGrid">' +
            '<div class="full"><label>Email address</label><input name="notificationEmail" type="email" value="' + escPublicAttr_(prefs.notificationEmail || '') + '" placeholder="' + escPublicAttr_(prefs.defaultEmail || '') + '"' + inputDisabled + '>' + lockedNote + '</div>' +
          '</div>' +
          '<div class="modalActions"><button type="button" class="btn" onclick="publicCloseCommPrefs_()">Cancel</button>' + saveButton + '</div>' +
        '</form>' +
        '<div class="formDivider" style="margin:16px 0;border-top:1px solid #e5e7eb"></div>' +
        '<h3 style="margin:0 0 4px;font-size:15px">Pair mobile app</h3>' +
        '<p class="muted" style="margin:0 0 10px">Open the app, tap Pair Device, and enter the code shown here. Codes expire after 10 minutes.</p>' +
        '<div id="publicAppPairBox">' +
          '<button type="button" class="btn" id="publicAppPairBtn" onclick="publicGenerateAppPairingCode_()">Generate pairing code</button>' +
          '<div id="publicAppPairResult" style="display:none;margin-top:10px">' +
            '<div id="publicAppPairCode" style="font-size:28px;font-weight:700;letter-spacing:.08em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace"></div>' +
            '<div id="publicAppPairExpiry" class="formHint"></div>' +
          '</div>' +
          '<div id="publicAppPairError" class="formHint" style="color:#b91c1c;display:none"></div>' +
        '</div>' +
        '<div class="formDivider" style="margin:16px 0;border-top:1px solid #e5e7eb"></div>' +
        '<h3 style="margin:0 0 4px;font-size:15px">Phone number</h3>' +
        '<p class="muted" style="margin:0 0 10px">Used for SMS schedule sharing from the admin portal.</p>' +
        '<form method="post" action="' + escPublicAttr_(actionUrl) + '">' +
          '<input type="hidden" name="action" value="savePublicStaffPhone">' +
          '<input type="hidden" name="school" value="' + escPublicAttr_(schoolId) + '">' +
          '<input type="hidden" name="staffName" value="' + escPublicAttr_(staff) + '">' +
          '<input type="hidden" name="staffToken" value="' + escPublicAttr_(staffToken) + '">' +
          '<input type="hidden" name="returnView" value="' + escPublicAttr_(view || 'my') + '">' +
          '<div class="commGrid">' +
            '<div class="full"><label>Phone number</label><input name="phone" type="tel" id="publicStaffPhoneInput" value="' + escPublicAttr_(prefs.phone || '') + '" placeholder="(555) 555-5555" oninput="publicFormatPhone_(this)"></div>' +
          '</div>' +
          '<div class="modalActions"><button class="btn primary" type="submit">Save Phone</button></div>' +
        '</form>' +
        '<div class="formDivider" style="margin:16px 0;border-top:1px solid #e5e7eb"></div>' +
        '<h3 style="margin:0 0 4px;font-size:15px">Notification preference</h3>' +
        '<p class="muted" style="margin:0 0 10px">How should schedule updates and announcements reach you?</p>' +
        '<div id="publicCommPrefBox">' +
          '<label class="commPrefOption"><input type="radio" name="publicCommPref" value="email" checked> <span>Email</span></label>' +
          '<label class="commPrefOption" id="publicCommPrefPushLabel"><input type="radio" name="publicCommPref" value="push" disabled> <span>Push notification <span id="publicCommPrefPushNote" class="formHint" style="display:inline">(pair the app first)</span></span></label>' +
          '<label class="commPrefOption" id="publicCommPrefBothLabel"><input type="radio" name="publicCommPref" value="both" disabled> <span>Both</span></label>' +
          '<div id="publicCommPrefMsg" class="formHint" style="margin-top:6px"></div>' +
        '</div>' +
    '</div></div>' +
    '<script>' +
      'function publicFormatPhone_(input){var digits=String(input.value||"").replace(/\\D/g,"").slice(0,10);var out=digits;if(digits.length>6)out="("+digits.slice(0,3)+") "+digits.slice(3,6)+"-"+digits.slice(6);else if(digits.length>3)out="("+digits.slice(0,3)+") "+digits.slice(3);else if(digits.length>0)out="("+digits;input.value=out;}' +
      'function publicOpenCommPrefs_(){var m=document.getElementById("publicCommPrefsModal");if(m)m.classList.add("open");publicLoadCommPref_();}' +
      'function publicCloseCommPrefs_(){var m=document.getElementById("publicCommPrefsModal");if(m)m.classList.remove("open");}' +
      'document.addEventListener("keydown",function(e){if(e&&e.key==="Escape")publicCloseCommPrefs_();});' +
      'function publicLoadCommPref_(){' +
        'var params=new URLSearchParams({school:' + JSON.stringify(schoolId) + ',staffName:' + JSON.stringify(staff) + ',staffToken:' + JSON.stringify(staffToken) + '});' +
        'fetch("/api/v05418y/comm-preference?"+params.toString())' +
          '.then(function(r){return r.json().then(function(j){if(!r.ok||j.ok===false)throw new Error((j&&j.error)||("HTTP "+r.status));return j;});})' +
          '.then(function(j){' +
            'var pushRadio=document.querySelector(\'input[name="publicCommPref"][value="push"]\');' +
            'var bothRadio=document.querySelector(\'input[name="publicCommPref"][value="both"]\');' +
            'var pushNote=document.getElementById("publicCommPrefPushNote");' +
            'if(j.hasPairedDevice){if(pushRadio)pushRadio.disabled=false;if(bothRadio)bothRadio.disabled=false;if(pushNote)pushNote.style.display="none";}' +
            'var target=document.querySelector(\'input[name="publicCommPref"][value="\'+(j.preference||"email")+\'"]\');' +
            'if(target && !target.disabled)target.checked=true;' +
          '})' +
          '.catch(function(){});' +
      '}' +
      'document.addEventListener("change",function(e){' +
        'if(e.target && e.target.name==="publicCommPref"){' +
          'var msgEl=document.getElementById("publicCommPrefMsg");' +
          'if(msgEl){msgEl.style.color="";msgEl.textContent="Saving…";}' +
          'fetch("/api/v05418y/comm-preference/set",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({school:' + JSON.stringify(schoolId) + ',staffName:' + JSON.stringify(staff) + ',staffToken:' + JSON.stringify(staffToken) + ',preference:e.target.value})})' +
            '.then(function(r){return r.json().then(function(j){if(!r.ok||j.ok===false)throw new Error((j&&j.error)||("HTTP "+r.status));return j;});})' +
            '.then(function(){if(msgEl)msgEl.textContent="Saved.";})' +
            '.catch(function(err){if(msgEl){msgEl.style.color="#b91c1c";msgEl.textContent=(err&&err.message)||"Could not save.";}});' +
        '}' +
      '});' +
      'var __appPairTimer=null;' +
      'function publicGenerateAppPairingCode_(){' +
        'var btn=document.getElementById("publicAppPairBtn"),errEl=document.getElementById("publicAppPairError"),resEl=document.getElementById("publicAppPairResult");' +
        'if(errEl){errEl.style.display="none";errEl.textContent="";}' +
        'if(btn){btn.disabled=true;btn.textContent="Generating…";}' +
        'fetch("/api/v05418y/app-pairing/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({school:' + JSON.stringify(schoolId) + ',staffName:' + JSON.stringify(staff) + ',staffToken:' + JSON.stringify(staffToken) + '})})' +
          '.then(function(r){return r.json().then(function(j){if(!r.ok||j.ok===false)throw new Error((j&&j.error)||("HTTP "+r.status));return j;});})' +
          '.then(function(j){' +
            'if(btn){btn.disabled=false;btn.textContent="Generate new code";}' +
            'if(resEl)resEl.style.display="block";' +
            'var codeEl=document.getElementById("publicAppPairCode");if(codeEl)codeEl.textContent=j.code;' +
            'var secondsLeft=j.expiresInSeconds||600;' +
            'if(__appPairTimer)clearInterval(__appPairTimer);' +
            'function tick(){var m=Math.floor(secondsLeft/60),s=secondsLeft%60;var expEl=document.getElementById("publicAppPairExpiry");if(expEl)expEl.textContent=secondsLeft>0?("Expires in "+m+":"+(s<10?"0":"")+s):"This code has expired — generate a new one.";if(secondsLeft<=0&&__appPairTimer){clearInterval(__appPairTimer);__appPairTimer=null;}secondsLeft--;}' +
            'tick();__appPairTimer=setInterval(tick,1000);' +
          '})' +
          '.catch(function(e){' +
            'if(btn){btn.disabled=false;btn.textContent="Generate pairing code";}' +
            'if(errEl){errEl.style.display="block";errEl.textContent=(e&&e.message)||"Could not generate a code. Try again.";}' +
          '});' +
      '}' +
    '</script>';
}

function renderPublicPortalTabs_(view, schoolId, staffName, staffToken, hasStaffIdentity, hasRegular) {
  const tabs = [];
  if (hasStaffIdentity) tabs.push({ id: 'my', label: 'My Schedule' });
  tabs.push({ id: 'staff', label: 'Staff Schedules' });
  tabs.push({ id: 'students', label: 'Student Schedules' });
  tabs.push({ id: 'breaks', label: 'Break Schedule' });
  if (hasRegular) tabs.push({ id: 'regular', label: 'Regular Schedule' });
  tabs.push({ id: 'absence', label: 'Report Absence' });
  return '<div class="tabs">' + tabs.map(function(t) {
    const cls = 'tab' + (t.id === view ? ' active' : '');
    const href = publicPortalLink_(schoolId, staffName, staffToken, t.id, 0);
    return '<a class="' + cls + '" href="' + escPublic_(href) + '" data-public-tab="' + escPublicAttr_(t.id) + '" data-view="' + escPublicAttr_(t.id) + '">' + escPublic_(t.label) + '</a>';
  }).join('') + '</div>';
}

function renderPublicAllPortalViews_(activeView, data, schoolId, staffName, staffToken, regularIndex, hasStaffIdentity, hasRegular) {
  const sections = [];
  if (hasStaffIdentity) sections.push({ id: 'my', html: renderPublicMyScheduleView_(data) });
  sections.push({ id: 'staff', html: renderPublicStaffView_(data) });
  sections.push({ id: 'students', html: renderPublicStudentsView_(data) });
  sections.push({ id: 'breaks', html: renderPublicBreaksView_(data) });
  if (hasRegular) sections.push({ id: 'regular', html: renderPublicRegularView_(data, schoolId, staffName, staffToken, regularIndex) });
  sections.push({ id: 'absence', html: renderPublicAbsenceView_(data, schoolId, staffName, staffToken) });
  return sections.map(function(sec) {
    const visible = sec.id === activeView;
    return '<section data-public-view="' + escPublicAttr_(sec.id) + '" class="' + (visible ? '' : 'hideView') + '">' + sec.html + '</section>';
  }).join('') + publicPortalSwitchScript_();
}

function publicPortalSwitchScript_() {
  return '<script>' +
    '(function(){' +
    'function showView(id,href){try{var sec=document.querySelector("[data-public-view=\""+id+"\"]");if(!sec)return true;Array.prototype.forEach.call(document.querySelectorAll("[data-public-view]"),function(el){el.classList.toggle("hideView",el.getAttribute("data-public-view")!==id);});Array.prototype.forEach.call(document.querySelectorAll(".tabs .tab"),function(el){el.classList.toggle("active",el.getAttribute("data-view")===id);});try{if(href&&window.history&&window.history.replaceState)window.history.replaceState(null,"",href);}catch(e){}try{window.scrollTo(0,0);}catch(e){}try{if(typeof publicSyncAbsenceForm_==="function")publicSyncAbsenceForm_();}catch(e){}return false;}catch(err){return true;}}' +
    'document.addEventListener("click",function(ev){var t=ev.target;while(t&&t!==document&&!(t.classList&&t.classList.contains("tab")&&t.getAttribute("data-view"))){t=t.parentNode;}if(!t||t===document)return;var id=t.getAttribute("data-view");if(!id)return;var handled=showView(id,t.getAttribute("href"));if(handled===false){ev.preventDefault();ev.stopPropagation();}});' +
    'window.publicPortalSwitchView_=showView;' +
    '})();' +
    '</script>';
}

function publicPortalBaseUrl_() {
  try {
    const url = ScriptApp.getService().getUrl();
    if (url) return String(url).split('?')[0];
  } catch (err) {}
  return '';
}

function publicPortalLink_(schoolId, staffName, staffToken, view, regularIndex) {
  const parts = [];
  if (schoolId) parts.push('school=' + encodeURIComponent(schoolId));
  if (staffName) parts.push('staff=' + encodeURIComponent(staffName));
  if (staffToken) parts.push('staffToken=' + encodeURIComponent(staffToken));
  if (view) parts.push('view=' + encodeURIComponent(view));
  if (view === 'regular' && regularIndex) parts.push('regularIndex=' + encodeURIComponent(String(regularIndex)));
  const query = parts.join('&');
  const base = publicPortalBaseUrl_();
  return (base || '') + (query ? '?' + query : '');
}

function renderPublicPortalView_(view, data, schoolId, staffName, staffToken, regularIndex) {
  if (view === 'my') return renderPublicMyScheduleView_(data);
  if (view === 'students') return renderPublicStudentsView_(data);
  if (view === 'breaks') return renderPublicBreaksView_(data);
  if (view === 'regular') return renderPublicRegularView_(data, schoolId, staffName, staffToken, regularIndex);
  if (view === 'absence') return renderPublicAbsenceView_(data, schoolId, staffName, staffToken);
  return renderPublicStaffView_(data);
}

function renderPublicStaffView_(data) {
  return '<div class="card"><h2>Staff Schedules</h2>' + renderPublicStaffSchedule_(data, 'staff') + '</div>';
}

function renderPublicStudentsView_(data) {
  return '<div class="card"><h2>Student Schedules</h2>' + renderPublicStudentSchedule_(data, 'student') + '</div>';
}

function renderPublicBreaksView_(data) {
  return '<div class="card"><h2>Break Schedule</h2>' + renderPublicBreakSchedule_(data, 'break') + '</div>';
}

function renderPublicMyScheduleView_(data) {
  const staff = data && data.staffIdentity && data.staffIdentity.valid ? data.staffIdentity.staffName : '';
  let html = '<div class="card"><h2>My Schedule <span class="stamp">' + escPublic_(staff) + '</span></h2>';
  html += renderPublicMyRows_(data, staff);
  html += '</div>';
  return html;
}

function renderPublicRegularView_(data, schoolId, staffName, staffToken, regularIndex) {
  const reg = data.regularSchedule || {};
  const schedules = reg.schedules || [];
  if (!(reg.displayOnStaffPortal && schedules.length)) return '<div class="card"><h2>Regular Schedule</h2><p class="muted">No regular schedule is currently published.</p></div>';
  const idx = Math.min(Math.max(0, regularIndex || 0), schedules.length - 1);
  const pills = '<div class="regularPills">' + schedules.map(function(s, i) {
    const cls = 'tab' + (i === idx ? ' active' : '');
    return '<a class="' + cls + '" href="' + escPublic_(publicPortalLink_(schoolId, staffName, staffToken, 'regular', i)) + '">' + escPublic_(s.label || ('Regular ' + (i + 1))) + '</a>';
  }).join('') + '</div>';
  const s = schedules[idx] || schedules[0];
  return '<div class="card"><h2>Regular Schedule</h2>' + pills + renderPublicFullScheduleBlock_(s.views || {}) + '</div>';
}

function renderPublicAbsenceView_(data, schoolId, staffName, staffToken) {
  if (data && data.absenceNotice && data.absenceNotice.type === 'ok') {
    return '<div class="card">' + renderPublicAbsenceSuccessPanel_(data.absenceNotice, schoolId, staffName, staffToken) + '</div>';
  }
  const staff = data && data.staffIdentity && data.staffIdentity.valid ? data.staffIdentity.staffName : '';
  const locked = !!staff;
  let nameField = '';
  const activeStaffOptions = (data.activeStaff || []).slice();
  if (staff && activeStaffOptions.map(normalizePublicName_).indexOf(normalizePublicName_(staff)) < 0 && data && data.staffIdentity && data.staffIdentity.active !== false) activeStaffOptions.unshift(staff);
  if (locked) {
    const opts = activeStaffOptions.map(function(n) { const selected = normalizePublicName_(n) === normalizePublicName_(staff) ? ' selected' : ''; return '<option value="' + escPublicAttr_(n) + '"' + selected + '>' + escPublic_(n) + '</option>'; }).join('');
    nameField = '<input type="hidden" name="staffName" value="' + escPublicAttr_(staff) + '"><select disabled>' + opts + '</select><div class="smallNote">Your name is set by this staff-specific link.</div>';
  } else {
    const opts = ['<option value="">Choose</option>'].concat(activeStaffOptions.map(function(n) { const selected = staffName && normalizePublicName_(n) === normalizePublicName_(staffName) ? ' selected' : ''; return '<option value="' + escPublicAttr_(n) + '"' + selected + '>' + escPublic_(n) + '</option>'; })).join('');
    nameField = '<select name="staffName">' + opts + '</select>';
  }
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const actionUrl = publicPortalLink_(schoolId, staffName, staffToken, 'absence', 0);
  return '<div class="card"><h2>Report an Absence</h2><form method="post" action="' + escPublicAttr_(actionUrl) + '" onsubmit="publicAbsenceBeforeSubmit_(this)">' +
    '<input type="hidden" name="school" value="' + escPublicAttr_(schoolId) + '"><input type="hidden" name="staffToken" value="' + escPublicAttr_(staffToken) + '">' +
    '<div class="formRow"><label>Your name</label>' + nameField + '</div>' +
    '<div class="formGrid"><div><label id="publicAbsenceStartLabel">Absence date</label><input id="publicAbsenceStart" name="startDate" type="date" value="' + today + '" onchange="publicSyncAbsenceForm_()"></div><div id="publicMultiDayBox" class="hide"><label>Last day</label><input id="publicAbsenceEnd" name="endDate" type="date"></div><label class="absenceSwitch"><input id="publicMultiDayToggle" name="multiDay" value="true" type="checkbox" onchange="publicSyncAbsenceForm_()"><span>Multiple days</span></label></div>' +
    '<div id="publicSingleDayBox" class="partialGrid"><div><label>Absence details</label><select id="publicAbsenceDayPart" name="dayPart" onchange="publicTogglePartialFields_()"><option value="full">Full day</option><option value="partial">Partial day</option></select></div><div class="partialOnly hide"><label>I will arrive at...</label><input name="arrivalTime" type="time"></div><div class="partialOnly hide"><label>I will leave at...</label><input name="leaveTime" type="time"></div></div>' +
    '<div class="formRow"><label>Absence reason</label><select name="reason"><option value="">Choose</option><option value="PN = Personal Necessity">PN = Personal Necessity</option><option value="I = Illness">I = Illness</option><option value="V = Vacation">V = Vacation</option><option value="B = Bereavement">B = Bereavement</option><option value="J = Jury Duty">J = Jury Duty</option><option value="P = Personal Reason (you will not be paid)">P = Personal Reason (you will not be paid)</option></select></div>' +
    '<div class="formRow"><label>Notes</label><textarea name="notes" placeholder="Optional details"></textarea></div><button class="btn primary" type="submit">Submit Absence Report</button></form>' +
    '<script>function publicTogglePartialFields_(){var sel=document.getElementById("publicAbsenceDayPart");var show=sel&&sel.value==="partial";Array.prototype.forEach.call(document.querySelectorAll(".partialOnly"),function(el){el.classList.toggle("hide",!show);if(!show){var input=el.querySelector("input");if(input)input.value="";}});}function publicSyncAbsenceForm_(){var multi=document.getElementById("publicMultiDayToggle");var isMulti=!!(multi&&multi.checked);var start=document.getElementById("publicAbsenceStart");var end=document.getElementById("publicAbsenceEnd");var multiBox=document.getElementById("publicMultiDayBox");var single=document.getElementById("publicSingleDayBox");var startLabel=document.getElementById("publicAbsenceStartLabel");if(multiBox)multiBox.classList.toggle("hide",!isMulti);if(single)single.classList.toggle("hide",isMulti);if(startLabel)startLabel.textContent=isMulti?"First day":"Absence date";if(end){if(isMulti&&!end.value&&start)end.value=start.value;if(!isMulti&&start)end.value=start.value;}if(isMulti){var dp=document.getElementById("publicAbsenceDayPart");if(dp)dp.value="full";}publicTogglePartialFields_();}function publicAbsenceBeforeSubmit_(form){publicSyncAbsenceForm_();return true;}publicSyncAbsenceForm_();</script></div>';
}

function renderPublicFullScheduleBlock_(data) {
  return '<h3>Staff Schedule</h3>' + renderPublicStaffSchedule_(data, 'regularStaff') + '<h3>Student Schedule</h3>' + renderPublicStudentSchedule_(data, 'regularStudent') + '<h3>Break Schedule</h3>' + renderPublicBreakSchedule_(data, 'regularBreak');
}

function renderPublicStaffSchedule_(data, prefix) {
  const rows = (data && data.staffSchedules) || [];
  const items = publicItemsFrom_(data);
  if (!rows.length) return '<div class="muted" style="padding:12px">No staff schedule has been published.</div>';
  const desktop = '<div class="scroll desktopTable">' + publicTable_(['Staff'].concat(items.map(publicItemTitle_)), rows.map(function(s) {
    return '<tr><td><b>' + escPublic_(s.staff || s.name || '') + '</b></td>' + items.map(function(it) { return '<td>' + publicStaffCell_(publicFindRow_(s.rows || [], it), data) + '</td>'; }).join('') + '</tr>';
  })) + '</div>';
  const mobile = '<div class="mobileCards">' + rows.map(function(s) {
    return '<div class="mCard"><div class="mTitle">' + escPublic_(s.staff || s.name || '') + '</div>' + items.map(function(it) { return '<div class="mRow"><div class="mPeriod">' + escPublic_(publicItemTitle_(it)) + '</div><div>' + publicStaffCell_(publicFindRow_(s.rows || [], it), data) + '</div></div>'; }).join('') + '</div>';
  }).join('') + '</div>';
  return desktop + mobile;
}

function renderPublicStudentSchedule_(data, prefix) {
  const rows = (data && data.studentSchedules) || [];
  const items = publicItemsFrom_(data);
  if (!rows.length) return '<div class="muted" style="padding:12px">No student schedule has been published.</div>';
  const desktop = '<div class="scroll desktopTable">' + publicTable_(['Student'].concat(items.map(publicItemTitle_)), rows.map(function(s) {
    return '<tr><td>' + publicStudentAnchor_(Object.assign({}, s, { name: s.student || s.name || '' }), data) + '</td>' + items.map(function(it) { return '<td>' + publicStudentCell_(publicFindRow_(s.rows || [], it)) + '</td>'; }).join('') + '</tr>';
  })) + '</div>';
  const mobile = '<div class="mobileCards">' + rows.map(function(s) {
    return '<div class="mCard"><div class="mTitle">' + publicStudentAnchor_(Object.assign({}, s, { name: s.student || s.name || '' }), data) + '</div>' + items.map(function(it) { return '<div class="mRow"><div class="mPeriod">' + escPublic_(publicItemTitle_(it)) + '</div><div>' + publicStudentCell_(publicFindRow_(s.rows || [], it)) + '</div></div>'; }).join('') + '</div>';
  }).join('') + '</div>';
  return desktop + mobile;
}

function renderPublicBreakSchedule_(data, prefix) {
  const rows = normalizePublicBreakItems_((data && data.breakItems) || []);
  if (!rows.length) return '<div class="muted" style="padding:12px">No break schedule has been published.</div>';
  const desktop = '<div class="scroll desktopTable">' + publicTable_(['Time', 'Staff on break', 'Type', 'Covering staff', 'Students / Location'], rows.map(function(b) {
    const students = publicCleanNa_(b.students); const loc = publicCleanNa_(b.location); return '<tr><td>' + escPublic_(publicBreakTime_(b)) + '</td><td>' + escPublic_(b.staffOnBreak || '') + '</td><td>' + escPublic_(b.type || '') + '</td><td>' + escPublic_(b.coveringStaff || '') + '</td><td>' + escPublic_(students) + (loc ? '<div class="muted">' + escPublic_(loc) + '</div>' : '') + '</td></tr>';
  })) + '</div>';
  const mobile = '<div class="mobileCards">' + rows.map(function(b) {
    const students = publicCleanNa_(b.students); const loc = publicCleanNa_(b.location); return '<div class="mCard"><div class="mTitle">' + escPublic_(publicBreakTime_(b)) + '</div><div><b>Staff on break:</b> ' + escPublic_(b.staffOnBreak || '') + '</div><div><b>Type:</b> ' + escPublic_(b.type || '') + '</div><div><b>Coverage:</b> ' + escPublic_(b.coveringStaff || '') + '</div><div class="muted">' + escPublic_([students, loc].filter(Boolean).join(' · ')) + '</div></div>';
  }).join('') + '</div>';
  return desktop + mobile;
}

function renderPublicMyRows_(data, staff) {
  data = data || {};
  const items = publicItemsFrom_(data);
  const match = ((data.staffSchedules || []).filter(function(s) { return normalizePublicName_(s.staff || s.name) === normalizePublicName_(staff); })[0]);
  let html = '';
  if (match) {
    html += items.map(function(it) {
      const title = publicItemTitle_(it);
      const row = publicFindRow_(match.rows || [], it);
      return '<div class="mCard"><div class="mTitle">' + publicBlockTitleHtml_(title) + '</div>' + publicStaffCell_(row, data, { mySchedule: true, itemTitle: title }) + '</div>';
    }).join('');
  } else {
    html += '<div class="mCard muted">No staff schedule row found for ' + escPublic_(staff) + '.</div>';
  }
  const breaks = ((data.breakItems || []).filter(function(b) { return normalizePublicName_([b.staffOnBreak, b.coveringStaff, b.helperStaff, b.helperCoveringFor].join(' ')).indexOf(normalizePublicName_(staff)) >= 0; }));
  if (breaks.length) {
    html += '<h3>Break/Lunch/Coverage</h3>' + breaks.map(function(b) {
      return renderPublicMyBreakCard_(b, staff);
    }).join('');
  }
  return html;
}

function renderPublicMyBreakCard_(b, staff) {
  b = b || {};
  const type = cleanPublic_(b.type || 'Break/Lunch');
  const mineBreak = normalizePublicName_(b.staffOnBreak) === normalizePublicName_(staff);
  const mineCover = normalizePublicName_(b.coveringStaff) === normalizePublicName_(staff) || normalizePublicName_(b.helperStaff) === normalizePublicName_(staff);
  const lines = [];
  if (mineBreak) {
    if (publicCleanNa_(b.coveringStaff)) lines.push('<div><b>Coverage:</b> ' + escPublic_(b.coveringStaff) + '</div>');
  } else if (mineCover) {
    if (publicCleanNa_(b.staffOnBreak)) lines.push('<div><b>Covering:</b> ' + escPublic_(b.staffOnBreak) + '</div>');
  } else if (publicCleanNa_(b.coveringStaff)) {
    lines.push('<div><b>Coverage:</b> ' + escPublic_(b.coveringStaff) + '</div>');
  }
  const meta = [type, publicCleanNa_(b.students), publicCleanNa_(b.location)].filter(Boolean).join(' · ');
  if (meta) lines.push('<div class="muted">' + escPublic_(meta) + '</div>');
  return '<div class="mCard"><div class="mTitle">' + escPublic_(publicBreakTime_(b)) + '</div>' + lines.join('') + '</div>';
}


function publicBlockTitleHtml_(title) {
  const parts = publicSplitBlockTitle_(title);
  const name = '<span class="blockName" style="font-weight:900!important">' + escPublic_(parts.name) + '</span>';
  const time = parts.time ? ' <span class="blockTime" style="font-weight:400!important;font-style:italic!important;color:#475569!important">' + escPublic_(parts.time) + '</span>' : '';
  return name + time;
}

function publicSplitBlockTitle_(title) {
  title = String(title || '').replace(/\u00a0/g, ' ').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  const m = title.match(/^(.*?)(\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))\s*$/i);
  if (m) return { name: m[1].trim(), time: m[2].trim() };
  return { name: title, time: '' };
}

function publicTimeFromBlockTitle_(title) {
  return publicSplitBlockTitle_(title).time || '';
}

function publicTimesMatch_(a, b) {
  function norm(v) { return String(v || '').toLowerCase().replace(/\s+/g, '').replace(/[–—]/g, '-'); }
  return !!(a && b && norm(a) === norm(b));
}


function publicTable_(headers, rows) {
  return '<table class="scheduleTable"><thead><tr>' + headers.map(function(h) { return '<th>' + escPublic_(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
}

function publicItemsFrom_(data) {
  return (data && data.items && data.items.length) ? data.items : [];
}

function publicItemTitle_(it) {
  if (typeof it === 'string') return it;
  return (it && (it.title || it.displayName || it.label || it.key)) || '';
}

function publicItemKey_(it) {
  if (typeof it === 'string') return it;
  return (it && (it.key || it.label || it.period || it.item || it.title || it.displayName)) || '';
}

function publicFindRow_(rows, it) {
  const key = publicItemKey_(it), title = publicItemTitle_(it), display = (it && it.displayName) || '';
  const keys = [key, title, display].map(cleanPublic_).filter(Boolean);
  for (let i = 0; i < (rows || []).length; i++) {
    const p = (rows[i].period || rows[i].item || rows[i].label || rows[i].title || '');
    const pKey = normalizePublicName_(p);
    for (let j = 0; j < keys.length; j++) {
      if (p === keys[j] || pKey === normalizePublicName_(keys[j])) return rows[i];
    }
  }
  return {};
}

function publicStaffCell_(r, data, options) {
  options = options || {};
  r = r || {};
  if (r.hideAssignmentForDesignatedRest) return publicRestHtml_(r.restEvents || [], options);
  let html = '';
  if (r.students && r.students.length) {
    html += publicGroupedStudentRoomHtml_(r.students, r.location, data);
  } else if (r.student) {
    html += publicStudentAnchor_({ name: r.student, url: r.url }, data);
    if (r.location) html += '<div class="muted">' + escPublic_(r.location) + '</div>';
  } else {
    html += '<span class="free">' + escPublic_(publicStaffOpenPeriodText_(r, data)) + '</span>';
  }
  if (r.restEvents && r.restEvents.length) html += publicRestHtml_(r.restEvents, options);
  if (r.coveringFor) html += '<span class="cover">Covering: ' + escPublic_(r.coveringFor) + '</span>';
  return html;
}


function publicStaffOpenPeriodText_(r, data) {
  r = r || {};
  const status = cleanPublic_(r.status || '').toLowerCase();
  if (status === 'timeblocked' || status === 'time blocked' || status === 'blocked') return 'Blocked';
  if (r.seeNotes && r.notes && r.notes.length) return r.notes.join('; ');
  if (r.seeLead || status === 'seelead' || status === 'see lead') return 'See Lead';
  const raw = cleanPublic_(r.freeText || r.assignment || r.note || '');
  if (raw && raw.toLowerCase() !== 'free') return raw;
  const loc = cleanPublic_((data && data.unassignedSupportLocation) || r.location || '');
  return loc ? 'Support ' + loc : 'Support';
}

function publicStudentUrlFromObj_(obj) {
  obj = obj || {};
  return cleanPublic_(obj.url || obj.href || obj.link || obj.dataUrl || obj.dataFileUrl || obj.dataFilesUrl || obj.dataFilesURL || obj.dataFile || obj.dataFiles || obj.publishedDataUrl || obj.publishedDataURL || obj.formUrl || obj.formURL || obj.dataFilesLink || obj.dataFileLink || '');
}

function publicFindStudentUrlByName_(name, data) {
  const key = normalizePublicName_(name);
  if (!key) return '';
  const map = (data && data.studentDataUrls) || {};
  if (map[key]) return map[key];
  const rows = (data && data.studentSchedules) || [];
  for (let i = 0; i < rows.length; i++) {
    if (normalizePublicName_(rows[i].student || rows[i].name) === key) {
      const url = publicStudentUrlFromObj_(rows[i]);
      if (url) return url;
    }
  }
  return '';
}

function publicStudentAnchor_(obj, data) {
  if (!obj) return '';
  const name = obj.name || obj.student || String(obj || '');
  const url = publicStudentUrlFromObj_(obj) || publicFindStudentUrlByName_(name, data) || '';
  return url ? '<a class="studentLink" href="' + escPublic_(url) + '" target="_blank" rel="noopener">' + escPublic_(name) + '</a>' : '<span class="studentLink">' + escPublic_(name) + '</span>';
}

function publicRoomSortKey_(value) {
  value = String(value || '').trim();
  const m = value.match(/^(\d+)/);
  return m ? ('000000' + m[1]).slice(-6) + '|' + value.toLowerCase() : 'zzzzzz|' + value.toLowerCase();
}

function publicGroupedStudentRoomHtml_(students, fallbackLocation, data) {
  students = students || [];
  if (!students.length) return '';
  const groups = [];
  students.forEach(function(st) {
    const loc = String((st && st.location) || fallbackLocation || '').trim();
    const key = loc || '__no_room__';
    let group = groups.filter(function(g) { return g.key === key; })[0];
    if (!group) {
      group = { key: key, location: loc, students: [] };
      groups.push(group);
    }
    group.students.push(st);
  });
  groups.sort(function(a, b) { return publicRoomSortKey_(a.location).localeCompare(publicRoomSortKey_(b.location)); });
  return groups.map(function(group) {
    const names = group.students.map(function(st) { return publicStudentAnchor_(st, data); }).join('<br>');
    return '<div class="studentRoomGroup">' + names + (group.location ? '<div class="muted">' + escPublic_(group.location) + '</div>' : '') + '</div>';
  }).join('');
}

function publicRestHtml_(events, options) {
  options = options || {};
  return (events || []).map(function(ev) {
    ev = ev || {};
    const type = String(ev.type || '').toLowerCase();
    const kind = type.indexOf('lunch') >= 0 ? 'Lunch' : (type.indexOf('break') >= 0 ? 'Break' : 'Rest');
    let who = kind;
    if (ev.role === 'helperCover') who = 'Covering for ' + (ev.helperCoveringFor || ev.coveringStaff || 'staff');
    else if (ev.role === 'cover') who = 'Covering ' + (ev.staffOnBreak || 'staff') + '\'s ' + kind;
    if (ev.role === 'cover' && ev.daisyChain && ev.helperStaff) who = 'Covered by ' + ev.helperStaff + '; ' + who;
    const standalone = (ev.role !== 'cover' && ev.role !== 'helperCover' && (who === 'Break' || who === 'Lunch'));
    const students = publicCleanNa_(ev.students || '');
    const location = publicCleanNa_(ev.location || '');
    let html = '<div class="rest"><b>' + (standalone ? '<span style="background:#fff59d;padding:1px 3px;border-radius:3px">' + escPublic_(who) + '</span>' : escPublic_(who)) + '</b>';
    const sameAsBlockTime = options.mySchedule && publicTimesMatch_(ev.time, publicTimeFromBlockTitle_(options.itemTitle || ''));
    if (ev.time && !sameAsBlockTime) html += '<br>' + escPublic_(ev.time);
    if (students) html += '<br>' + escPublic_(students);
    if (location) html += '<div class="muted">' + escPublic_(location) + '</div>';
    return html + '</div>';
  }).join('');
}

function publicCleanNa_(value) {
  value = String(value || '').trim();
  return (/^(N\/A|NA)$/i.test(value)) ? '' : value;
}


function publicStudentCell_(r) {
  r = r || {};
  const support = String(r.support || r.supportType || '').trim();
  const loc = String(r.location || '').trim();
  const noSupport = !support || /^n\/?a$|^none$|^no support/i.test(support);
  const noLoc = !loc || /^n\/?a$/i.test(loc);
  const hasNeed = !noSupport && !noLoc;
  let html = r.staff ? escPublic_(r.staff) : (r.allowedUnstaffed ? '<span class="need">Allowed unstaffed</span>' : (hasNeed ? '<span class="need">Needs support - unassigned</span>' : '<span class="free">No support needed</span>'));
  const meta = [];
  if (!noLoc) meta.push(loc);
  if (!noSupport) meta.push(support);
  if (meta.length) html += '<div class="muted">' + escPublic_(meta.join(' · ')) + '</div>';
  return html;
}


function publicBreakTime_(b) {
  return (b && b.time) || '';
}

function renderPublicStaffViewTableOnlyV05418Test_(data) {
  return { ok: true, html: renderPublicStaffSchedule_(data || {}, 'staff') };
}
function renderTestSchedulesFromDataV05418Test_(views) {
  views = views || {};
  const html = renderPublicStaffView_(views);
  const bannerText = views.generatedAt ? ('Unpublished draft schedule. Generated ' + views.generatedAt + '.') : 'Unpublished draft schedule.';
  const bannerHtml = '<div class="schedulePublishNote unpublished">' + escPublic_(bannerText) + '</div>';
  return { ok: true, html: html, bannerHtml: bannerHtml, isDraft: true };
}

function getTestSchedulesHtmlV05418Test_(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const views = getPublicPublishedScheduleViews_(ss);
  const html = renderPublicStaffView_(views);
  const label = cleanPublic_(views.scheduleVersionLabel || views.versionLabel || '');
  const publishedAt = views.publishedAt || '';
  const bannerText = publishedAt ? ('Published Schedule' + (label ? ' ' + label : '') + ' \u00b7 Published ' + publishedAt) : 'Never published';
  const bannerHtml = '<div class="schedulePublishNote">' + escPublic_(bannerText) + '</div>';
  return {
    ok: true,
    html: html,
    bannerHtml: bannerHtml,
    publishedAt: publishedAt,
    hasPublished: !!publishedAt,
    scheduleType: views.scheduleType || ''
  };
}

function getStaffPortalDataPublic(payload) {
  payload = payload || {};
  const school = resolvePublicSchool_(payload.school || payload.schoolId || payload.campus || payload.campusId || '');
  const ss = SpreadsheetApp.openById(school.spreadsheetId);
  const views = getPublicPublishedScheduleViews_(ss);
  const identity = resolvePublicStaffIdentity_(school.id, payload.staffName || payload.staff || '', payload.staffToken || payload.token || '', school.spreadsheetId);
  const activeStaff = mergePublicNameLists_(getPublicActiveStaffNames_(ss));
  const activeStaffMap = {};
  activeStaff.forEach(function(n) { activeStaffMap[normalizePublicName_(n)] = n; });
  if (identity.valid && identity.staffName) {
    const identityKey = normalizePublicName_(identity.staffName);
    const canonicalActiveName = activeStaffMap[identityKey] || '';
    if (canonicalActiveName) {
      identity.staffName = canonicalActiveName;
      identity.active = true;
    } else {
      const rowStatus = getPublicStaffStatusForName_(ss, identity.staffName);
      if (rowStatus && rowStatus.exists && rowStatus.active) {
        identity.staffName = rowStatus.name || identity.staffName;
        identity.active = true;
        if (activeStaffMap[normalizePublicName_(identity.staffName)] == null) activeStaff.unshift(identity.staffName);
      } else {
        identity.valid = false;
        identity.active = false;
        identity.staffName = '';
        identity.error = rowStatus && rowStatus.exists
          ? 'This staff-specific link is valid, but this staff member is not currently listed as Active in the current staff sheet. Ask an administrator to confirm the Staff status/code and regenerate the link if the name changed.'
          : 'This staff-specific link is valid, but the staff member could not be found in the current staff sheet. Ask an administrator to regenerate the link.';
      }
    }
  }
  const studentDataUrls = getPublicStudentDataUrlMap_(ss);
  const campusProps = getPublicCampusProps_(ss);
  const announcements = getPublicStaffPortalAnnouncements_(ss, school);
  const announcement = announcements.length ? announcements[0] : { hidden: true, headline: '', note: '', target: 'staff' };
  const periodDisplayNames = getPublicPeriodDisplayNameMap_(ss, views);
  const communicationPreferences = (identity && identity.valid && identity.staffName) ? getPublicStaffCommunicationPreferences_(ss, identity.staffName) : publicDefaultStaffCommunicationPreferences_();
  _filterFreeTimeVisibilityV05418Free_(views, (identity && identity.valid) ? identity.staffName : '');
  return {
    ok: true,
    version: PUBLIC_STAFF_PORTAL_VERSION,
    schoolId: school.id,
    schoolName: school.name || school.id,
    publishedAt: views.publishedAt || '',
    date: views.date || '',
    scheduleType: views.scheduleType || '',
    scheduleVersion: views.scheduleVersion || views.publishedVersion || '',
    scheduleVersionLabel: views.scheduleVersionLabel || views.versionLabel || '',
    publishedVersion: views.publishedVersion || views.scheduleVersion || '',
    versionLabel: views.versionLabel || views.scheduleVersionLabel || '',
    items: views.items || [],
    periodDisplayNames: periodDisplayNames,
    staffSchedules: views.staffSchedules || [],
    studentSchedules: views.studentSchedules || [],
    breakItems: normalizePublicBreakItems_(views.breakItems || []),
    unassignedSupportLocation: views.unassignedSupportLocation || campusProps.V5_UNASSIGNED_SUPPORT_LOCATION || '',
    studentDataUrls: studentDataUrls,
    activeStaff: activeStaff,
    staffIdentity: identity,
    communicationPreferences: communicationPreferences,
    regularSchedule: getPublicRegularScheduleForStaffPortal_(ss),
    announcement: announcement,
    announcements: announcements
  };
}

function submitStaffAbsencePublic(payload) {
  payload = payload || {};
  const school = resolvePublicSchool_(payload.school || payload.schoolId || payload.campus || payload.campusId || '');
  const ss = SpreadsheetApp.openById(school.spreadsheetId);
  const staffName = cleanPublic_(payload.staffName || payload.staff || '');
  if (!staffName) throw new Error('Choose your name.');
  const token = cleanPublic_(payload.staffToken || payload.token || '');
  if (token && !validatePublicStaffPortalToken_(school.id, staffName, token)) throw new Error('This staff link is not valid. Open your current Staff Portal link and try again.');
  const active = getPublicActiveStaffNames_(ss).map(normalizePublicName_);
  if (active.indexOf(normalizePublicName_(staffName)) < 0) throw new Error('Only active staff can submit an absence report.');
  const start = parsePublicIsoDate_(payload.startDate);
  const end = parsePublicIsoDate_(payload.endDate || payload.startDate);
  if (!start || !end) throw new Error('Choose the absence date.');
  if (end.getTime() < start.getTime()) throw new Error('End date cannot be before start date.');
  const reason = cleanPublic_(payload.reason || '');
  if (!reason) throw new Error('Choose a reason for absence.');
  const dayPart = cleanPublic_(payload.dayPart || 'full').toLowerCase() === 'partial' ? 'Partial day' : 'Full day';
  const arrival = cleanPublic_(payload.arrivalTime || '');
  const leave = cleanPublic_(payload.leaveTime || '');
  if (dayPart === 'Partial day' && !arrival && !leave && samePublicDate_(start, end)) throw new Error('For a partial-day absence, enter an arrival time, a leave time, or both.');
  const sheet = ensurePublicAttendanceSheet_(ss);
  const headers = getPublicHeaderMap_(sheet);
  const cols = {
    timestamp: findPublicHeaderCol_(headers, ['timestamp'], 1),
    name: findPublicHeaderCol_(headers, ['name'], 2),
    source: findPublicHeaderCol_(headers, ['source'], 3),
    startDate: findPublicHeaderCol_(headers, ['start date'], 4),
    endDate: findPublicHeaderCol_(headers, ['end date'], 5),
    reason: findPublicHeaderCol_(headers, ['reason'], 6),
    dayPart: findPublicHeaderCol_(headers, ['day part'], 7),
    arrival: findPublicHeaderCol_(headers, ['arrival time'], 8),
    leave: findPublicHeaderCol_(headers, ['leave time'], 9),
    notes: findPublicHeaderCol_(headers, ['notes'], 10),
    status: findPublicHeaderCol_(headers, ['status'], 11)
  };
  const width = Math.max(sheet.getLastColumn(), 11);
  const rows = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor.getTime() <= end.getTime()) {
    const row = new Array(width).fill('');
    row[cols.timestamp - 1] = new Date();
    row[cols.name - 1] = staffName;
    row[cols.source - 1] = 'Public Staff Portal';
    row[cols.startDate - 1] = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    row[cols.endDate - 1] = '';
    row[cols.reason - 1] = reason;
    row[cols.dayPart - 1] = samePublicDate_(start, end) ? dayPart : 'Full day';
    row[cols.arrival - 1] = samePublicDate_(start, end) ? arrival : '';
    row[cols.leave - 1] = samePublicDate_(start, end) ? leave : '';
    row[cols.notes - 1] = cleanPublic_(payload.notes || '');
    row[cols.status - 1] = 'Submitted';
    rows.push(row);
    cursor.setDate(cursor.getDate() + 1);
  }
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, width).setValues(rows);
  let notification = { attempted: false, status: 'not_configured', message: 'No absence notification recipients were found for this public Staff Portal deployment.', recipientCount: 0, recipientsMasked: [] };
  try {
    notification = notifyPublicStaffAbsenceSubmission_(ss, school, payload, staffName, start, end, rows.length) || notification;
  } catch (notifyErr) {
    let emailConfig = null;
    try { emailConfig = getPublicAbsenceNotifyEmails_(ss, school); } catch (configErr) { emailConfig = null; }
    const msg = (notifyErr && notifyErr.message) ? notifyErr.message : String(notifyErr || 'Notification email failed.');
    notification = {
      attempted: true,
      status: 'failed',
      message: msg,
      recipientCount: emailConfig && emailConfig.emails ? emailConfig.emails.length : 0,
      recipientsMasked: emailConfig && emailConfig.emails ? emailConfig.emails.map(maskPublicEmail_) : [],
      sourceHint: emailConfig ? emailConfig.sourceHint : 'unknown',
      workbookHasKey: emailConfig ? emailConfig.workbookHasKey : false,
      publicScriptHasKey: emailConfig ? emailConfig.publicScriptHasKey : false,
      authorizationHint: /permission to call MailApp|script.send_mail|authorization/i.test(msg) ? 'Run authorizePublicStaffPortalMailAppV130_ from the public Staff Portal Apps Script editor as the deployment owner, approve permissions, then redeploy.' : ''
    };
    try { Logger.log('Staff Portal absence notification email failed: ' + notification.message); } catch (logErr) {}
  }
  return {
    ok: true,
    message: rows.length === 1 ? 'Absence report submitted.' : rows.length + ' absence days submitted.',
    rowsSaved: rows.length,
    staffName: staffName,
    dateText: formatPublicDateForEmail_(start) + (samePublicDate_(start, end) ? '' : ' - ' + formatPublicDateForEmail_(end)),
    dayPart: samePublicDate_(start, end) ? dayPart : 'Full day',
    reason: reason,
    arrivalTime: arrival,
    leaveTime: leave,
    notes: cleanPublic_(payload.notes || ''),
    notification: notification,
    version: PUBLIC_STAFF_PORTAL_VERSION
  };
}

function publicDefaultStaffCommunicationPreferences_() {
  return {
    notificationEmail: '',
    defaultEmail: '',
    emailLocked: false
  };
}

function publicStaffCommunicationColumnAliases_() {
  return {
    notificationEmail: ['email', 'notification email', 'schedule notification email', 'communication email'],
    email: ['email', 'email address', 'staff email', 'work email']
  };
}

function ensurePublicStaffCommunicationColumns_(sheet) {
  if (!sheet) throw new Error('Staff sheet was not found.');
  if (sheet.getMaxColumns() < 11) sheet.insertColumnsAfter(sheet.getMaxColumns(), 11 - sheet.getMaxColumns());
  if (sheet.getLastRow() < 1) sheet.getRange(1, 1).setValue('Name').setFontWeight('bold');
  sheet.getRange(1, 11).setValue('Email').setFontWeight('bold');
  try { sheet.getRange(1, 11).setBackground('#c9c9c9').setWrap(true); } catch (err) {}
  return getPublicHeaderMap_(sheet);
}

function getPublicStaffRowInfo_(ss, staffName, shouldEnsureColumns) {
  const sheet = getPublicStaffSheet_(ss);
  if (!sheet || sheet.getLastRow() < 2) throw new Error('Staff sheet was not found or has no staff rows.');
  const headers = shouldEnsureColumns ? ensurePublicStaffCommunicationColumns_(sheet) : getPublicHeaderMap_(sheet);
  const colName = findPublicHeaderCol_(headers, ['name', 'staff', 'staff name', 'staff member', 'employee name'], 1);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), colName)).getDisplayValues();
  const target = normalizePublicName_(staffName);
  for (let i = 0; i < values.length; i++) {
    if (normalizePublicName_(values[i][colName - 1]) === target) {
      return { sheet: sheet, headers: headers, rowNumber: i + 2, rowValues: values[i], colName: colName };
    }
  }
  throw new Error('Could not find your staff record. Ask an administrator to confirm your Staff Manager name.');
}


function publicStaffEmailLockKey_(staffName) {
  return normalizePublicName_(staffName || '');
}
function isPublicStaffEmailLocked_(ss, staffName) {
  try {
    const sh = ss && ss.getSheetByName ? ss.getSheetByName('_StaffEmailLocks') : null;
    if (!sh || sh.getLastRow() < 2) return false;
    const values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(4, sh.getLastColumn())).getDisplayValues();
    const target = publicStaffEmailLockKey_(staffName);
    for (let i = 0; i < values.length; i++) {
      const row = values[i] || [];
      const key = publicStaffEmailLockKey_(row[1] || row[0] || '');
      if (target && key === target) return row[3] === true || /^true|1|yes|on|locked$/i.test(String(row[3] || ''));
    }
  } catch (err) {
    try { Logger.log('Could not read staff email lock: ' + ((err && err.message) || err)); } catch (logErr) {}
  }
  return false;
}

function getPublicStaffCommunicationPreferences_(ss, staffName) {
  const prefs = publicDefaultStaffCommunicationPreferences_();
  if (!staffName) return prefs;
  try {
    const info = getPublicStaffRowInfo_(ss, staffName, false);
    const colEmail = 11;
    const colPhone = 12;
    const colDefaultEmail = findPublicHeaderCol_(info.headers, publicStaffCommunicationColumnAliases_().email, 0);
    prefs.notificationEmail = cleanPublic_(info.rowValues[colEmail - 1] || '');
    prefs.phone = cleanPublic_(info.rowValues[colPhone - 1] || '');
    prefs.defaultEmail = colDefaultEmail ? cleanPublic_(info.rowValues[colDefaultEmail - 1]) : '';
    prefs.emailLocked = isPublicStaffEmailLocked_(ss, staffName);
  } catch (err) {
    try { Logger.log('Could not load staff notification email: ' + ((err && err.message) || err)); } catch (logErr) {}
  }
  return prefs;
}

function normalizePublicCommunicationPreference_(value) {
  return 'Email';
}

function savePublicStaffCommunicationPreferences_(payload) {
  payload = payload || {};
  const school = resolvePublicSchool_(payload.school || payload.schoolId || payload.campus || payload.campusId || '');
  const ss = SpreadsheetApp.openById(school.spreadsheetId);
  const staffName = cleanPublic_(payload.staffName || payload.staff || '');
  const token = cleanPublic_(payload.staffToken || payload.token || '');
  if (!staffName || !token || !validatePublicStaffPortalToken_(school.id, staffName, token)) throw new Error('This staff link is not valid. Open your current Staff Portal link and try again.');
  const active = getPublicActiveStaffNames_(ss).map(normalizePublicName_);
  if (active.indexOf(normalizePublicName_(staffName)) < 0) throw new Error('Only active staff can update notification email.');
  if (isPublicStaffEmailLocked_(ss, staffName)) throw new Error('This email address is locked by an administrator. Ask an administrator to change it.');
  const info = getPublicStaffRowInfo_(ss, staffName, true);
  const colEmail = 11;
  const email = cleanPublic_(payload.notificationEmail || payload.email || '');
  if (email && !parsePublicEmailList_(email).length) throw new Error('Enter a valid email address.');
  info.sheet.getRange(info.rowNumber, colEmail).setValue(email);
  return { ok: true, message: email ? 'Email saved.' : 'Email cleared.', staffName: staffName, notificationEmail: email };
}
function formatPublicPhone_(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
  if (digits.length === 11 && digits[0] === '1') return '(' + digits.slice(1, 4) + ') ' + digits.slice(4, 7) + '-' + digits.slice(7);
  return digits;
}
function savePublicStaffPhone_(payload) {
  payload = payload || {};
  const school = resolvePublicSchool_(payload.school || payload.schoolId || payload.campus || payload.campusId || '');
  const ss = SpreadsheetApp.openById(school.spreadsheetId);
  const staffName = cleanPublic_(payload.staffName || payload.staff || '');
  const token = cleanPublic_(payload.staffToken || payload.token || '');
  if (!staffName || !token || !validatePublicStaffPortalToken_(school.id, staffName, token)) throw new Error('This staff link is not valid. Open your current Staff Portal link and try again.');
  const active = getPublicActiveStaffNames_(ss).map(normalizePublicName_);
  if (active.indexOf(normalizePublicName_(staffName)) < 0) throw new Error('Only active staff can update phone number.');
  const info = getPublicStaffRowInfo_(ss, staffName, true);
  const colPhone = 12;
  const phone = formatPublicPhone_(payload.phone || '');
  info.sheet.getRange(info.rowNumber, colPhone).setValue(phone);
  return { ok: true, message: phone ? 'Phone saved.' : 'Phone cleared.', staffName: staffName, phone: phone };
}

function parsePublicEmailList_(text) {
  const seen = {};
  return String(text || '')
    .split(/[\s,;]+/)
    .map(function(e) { return cleanPublic_(e); })
    .filter(function(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); })
    .filter(function(e) {
      const key = e.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
}

function maskPublicEmail_(email) {
  email = cleanPublic_(email);
  const parts = email.split('@');
  if (parts.length !== 2) return email ? 'configured-recipient' : '';
  const local = parts[0], domain = parts[1];
  const localMasked = local.length <= 2 ? local.charAt(0) + '*' : local.charAt(0) + '***' + local.charAt(local.length - 1);
  return localMasked + '@' + domain;
}

function getPublicAbsenceNotifyEmails_(ss, school) {
  const props = getPublicCampusProps_(ss);
  const scriptProps = PropertiesService.getScriptProperties();
  const schoolId = cleanPublic_((school && school.id) || '');
  const candidates = [];

  // Preferred: school workbook _V5Properties. Admin Portal can sync here in a future build.
  candidates.push(props.V5_ABSENCE_NOTIFY_EMAILS || '');
  candidates.push(props.V5_PUBLIC_ABSENCE_NOTIFY_EMAILS || '');

  // Temporary/public-portal troubleshooting fallback: set in the public Staff Portal Apps Script project.
  candidates.push(scriptProps.getProperty('V5_ABSENCE_NOTIFY_EMAILS') || '');
  candidates.push(scriptProps.getProperty('V5_PUBLIC_ABSENCE_NOTIFY_EMAILS') || '');

  // Optional per-school JSON in public Staff Portal script properties:
  // {"myschool":"email1@example.org,email2@example.org"}
  try {
    const rawJson = scriptProps.getProperty('V5_PUBLIC_ABSENCE_NOTIFY_EMAILS_JSON') || '';
    if (rawJson) {
      const obj = JSON.parse(rawJson) || {};
      candidates.push(obj[schoolId] || obj[schoolId.toLowerCase()] || obj.default || '');
    }
  } catch (jsonErr) {}

  const emails = [];
  const seen = {};
  candidates.forEach(function(raw) {
    parsePublicEmailList_(raw).forEach(function(email) {
      const key = email.toLowerCase();
      if (!seen[key]) {
        seen[key] = true;
        emails.push(email);
      }
    });
  });
  return {
    emails: emails,
    sourceHint: emails.length ? 'workbook-or-public-script-property' : 'none-found',
    workbookHasKey: !!cleanPublic_(props.V5_ABSENCE_NOTIFY_EMAILS || props.V5_PUBLIC_ABSENCE_NOTIFY_EMAILS || ''),
    publicScriptHasKey: !!cleanPublic_(scriptProps.getProperty('V5_ABSENCE_NOTIFY_EMAILS') || scriptProps.getProperty('V5_PUBLIC_ABSENCE_NOTIFY_EMAILS') || scriptProps.getProperty('V5_PUBLIC_ABSENCE_NOTIFY_EMAILS_JSON') || '')
  };
}

function notifyPublicStaffAbsenceSubmission_(ss, school, payload, staffName, startDate, endDate, rowsSaved) {
  const emailConfig = getPublicAbsenceNotifyEmails_(ss, school);
  const emails = emailConfig.emails || [];
  const masked = emails.map(maskPublicEmail_);
  if (!emails.length) {
    return {
      attempted: false,
      status: 'not_configured',
      message: 'No notification recipients found. The Admin Portal setting may be stored in the Admin script properties and not yet synced to this public Staff Portal deployment.',
      recipientCount: 0,
      recipientsMasked: [],
      sourceHint: emailConfig.sourceHint,
      workbookHasKey: emailConfig.workbookHasKey,
      publicScriptHasKey: emailConfig.publicScriptHasKey
    };
  }
  const singleDay = samePublicDate_(startDate, endDate);
  const dayPart = cleanPublic_(payload.dayPart || 'full').toLowerCase() === 'partial' ? 'Partial day' : 'Full day';
  const schoolName = cleanPublic_((school && school.name) || (school && school.id) || 'Staff Portal');
  const dateText = formatPublicDateForEmail_(startDate) + (singleDay ? '' : ' - ' + formatPublicDateForEmail_(endDate));
  const subject = schoolName + ' absence report: ' + staffName;
  const body = [
    'A staff absence report was submitted through the Staff Portal.',
    '',
    'School: ' + schoolName,
    'Staff: ' + staffName,
    'Date: ' + dateText,
    'Rows saved: ' + rowsSaved,
    'Reason: ' + (cleanPublic_(payload.reason) || 'N/A'),
    'Day part: ' + dayPart,
    'Arrival time: ' + (cleanPublic_(payload.arrivalTime) || 'N/A'),
    'Leave time: ' + (cleanPublic_(payload.leaveTime) || 'N/A'),
    'Notes: ' + (cleanPublic_(payload.notes) || 'N/A')
  ].join('\n');
  MailApp.sendEmail({
    to: emails.join(','),
    subject: subject,
    body: body,
    name: 'Staff Absence Notification'
  });
  return {
    attempted: true,
    status: 'sent',
    message: 'Notification email sent to ' + emails.length + ' recipient' + (emails.length === 1 ? '' : 's') + '.',
    recipientCount: emails.length,
    recipientsMasked: masked,
    sourceHint: emailConfig.sourceHint,
    workbookHasKey: emailConfig.workbookHasKey,
    publicScriptHasKey: emailConfig.publicScriptHasKey,
    remainingDailyQuota: getPublicMailQuotaSafe_()
  };
}

function getPublicMailQuotaSafe_() {
  try { return MailApp.getRemainingDailyQuota(); } catch (err) { return ''; }
}

function formatPublicDateForEmail_(date) {
  if (!date) return '';
  try { return Utilities.formatDate(date, Session.getScriptTimeZone(), 'M/d/yyyy'); } catch (err) {}
  try { return String(date); } catch (err2) { return ''; }
}

function renderPublicAbsenceSuccessPanel_(notice, schoolId, staffName, staffToken) {
  notice = notice || {};
  const result = notice.result || {};
  const anotherHref = publicPortalLink_(schoolId, staffName, staffToken, 'absence', 0);
  const staff = cleanPublic_(result.staffName || staffName || '');
  const dateText = cleanPublic_(result.dateText || '');
  const reason = cleanPublic_(result.reason || '');
  const dayPart = cleanPublic_(result.dayPart || '');
  const arrival = cleanPublic_(result.arrivalTime || '');
  const leave = cleanPublic_(result.leaveTime || '');
  const timeParts = [];
  if (arrival) timeParts.push('arrive at ' + arrival);
  if (leave) timeParts.push('leave at ' + leave);
  const details = [];
  if (staff) details.push('<div class="recap"><b>Staff:</b> ' + escPublic_(staff) + '</div>');
  if (dateText) details.push('<div class="recap"><b>Date' + (dateText.indexOf(' - ') >= 0 ? 's' : '') + ':</b> ' + escPublic_(dateText) + '</div>');
  if (dayPart) details.push('<div class="recap"><b>Absence details:</b> ' + escPublic_(dayPart + (timeParts.length ? ' (' + timeParts.join(', ') + ')' : '')) + '</div>');
  if (reason) details.push('<div class="recap"><b>Reason:</b> ' + escPublic_(reason) + '</div>');
  return '<div class="successPanel">' +
    '<div class="successTitle"><div class="bigCheck">✓</div><h2>Absence Report Submitted</h2></div>' +
    details.join('') +
    '<div class="actions"><a class="btn primary" href="' + escPublic_(anotherHref) + '">Submit Another Absence</a></div>' +
    '</div>';
}

function normalizePublicAnnouncementV127_(obj, scope) {
  obj = obj || {};
  const target = String(obj.target || obj.broadcastTarget || 'staff').toLowerCase();
  const headline = cleanPublic_(obj.headline || obj.label || '');
  const note = cleanPublic_(obj.note || '');
  const campusId = cleanPublic_(obj.campusId || obj.schoolId || obj.siteId || '');
  const campusName = cleanPublic_(obj.campusName || obj.schoolName || obj.siteName || '');
  return {
    headline: headline,
    label: headline,
    note: note,
    hidden: obj.hidden === true || String(obj.hidden || '').toLowerCase() === 'true',
    target: target || 'staff',
    broadcastTarget: target || 'staff',
    scope: cleanPublic_(scope || obj.scope || ''),
    campusId: campusId,
    schoolId: cleanPublic_(obj.schoolId || campusId),
    siteId: cleanPublic_(obj.siteId || campusId),
    campusName: campusName,
    schoolName: cleanPublic_(obj.schoolName || campusName),
    updatedAt: cleanPublic_(obj.updatedAt || '')
  };
}

function publicAnnouncementRenderableV127_(a) {
  if (!a) return false;
  const target = String(a.target || a.broadcastTarget || 'staff').toLowerCase();
  const hidden = a.hidden === true || String(a.hidden || '').toLowerCase() === 'true';
  const headline = cleanPublic_(a.headline || a.label || '');
  const note = cleanPublic_(a.note || '');
  return !hidden && (target === 'staff' || target === 'both' || target === 'admin & staff' || target === 'admin_staff') && !!(headline || note);
}

function parsePublicAnnouncementPropV127_(props, key, scope) {
  try {
    const raw = props[key] || '';
    if (!raw) return null;
    return normalizePublicAnnouncementV127_(JSON.parse(raw) || {}, scope);
  } catch (err) {
    return null;
  }
}

function publicAnnouncementSchoolKeyV05418I_(value) {
  return normalizePublicName_(value || '');
}

function publicAnnouncementMatchesSchoolV05418I_(announcement, school) {
  announcement = announcement || {};
  const stamped = publicAnnouncementSchoolKeyV05418I_(announcement.campusId || announcement.schoolId || announcement.siteId || '');
  if (!stamped) return true;
  const expected = publicAnnouncementSchoolKeyV05418I_((school && (school.id || school.schoolId || school.campusId || school.siteId)) || '');
  return !!expected && stamped === expected;
}

function getPublicStaffPortalAnnouncements_(ss, school) {
  let props = {};
  try { props = getPublicCampusProps_(ss); } catch (err) { props = {}; }
  const legacy = parsePublicAnnouncementPropV127_(props, PUBLIC_STAFF_PORTAL_ANNOUNCEMENT_PROP, '');
  let globalAnnouncement = parsePublicAnnouncementPropV127_(props, PUBLIC_STAFF_PORTAL_GLOBAL_ANNOUNCEMENT_PROP, 'global');
  let schoolAnnouncement = parsePublicAnnouncementPropV127_(props, PUBLIC_STAFF_PORTAL_SCHOOL_ANNOUNCEMENT_PROP, 'school');

  if (legacy && !globalAnnouncement && String(legacy.scope || '').toLowerCase() === 'global') globalAnnouncement = normalizePublicAnnouncementV127_(legacy, 'global');
  if (legacy && !schoolAnnouncement && String(legacy.scope || '').toLowerCase() !== 'global') schoolAnnouncement = normalizePublicAnnouncementV127_(legacy, 'school');

  if (schoolAnnouncement && !publicAnnouncementMatchesSchoolV05418I_(schoolAnnouncement, school)) schoolAnnouncement = null;

  const out = [];
  if (publicAnnouncementRenderableV127_(globalAnnouncement)) out.push(globalAnnouncement);
  if (publicAnnouncementRenderableV127_(schoolAnnouncement)) out.push(schoolAnnouncement);
  return out;
}

function getPublicStaffPortalAnnouncement_(ss, school) {
  const list = getPublicStaffPortalAnnouncements_(ss, school);
  return list.length ? list[0] : { hidden: true, headline: '', note: '', target: 'staff' };
}


function getPublicSchoolsConfig_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PUBLIC_STAFF_PORTAL_PROPERTY_SCHOOLS) || '';
  if (!raw) return {};
  let obj = {};
  try {
    obj = JSON.parse(raw) || {};
  } catch (e) {
    throw new Error('Invalid ' + PUBLIC_STAFF_PORTAL_PROPERTY_SCHOOLS + ' JSON. Copy the exact Public Staff Portal school config from Admin Portal > System Admin > Staff Portal and paste it into this public script property.');
  }
  const out = {};
  Object.keys(obj || {}).forEach(function(k) {
    const key = cleanPublic_(k);
    if (key) out[key] = obj[k];
  });
  return out;
}

function diagnosePublicStaffPortalConfigV112_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(PUBLIC_STAFF_PORTAL_PROPERTY_SCHOOLS) || '';
  const secret = props.getProperty(PUBLIC_STAFF_PORTAL_PROPERTY_SECRET) || '';
  let keys = [];
  let validJson = false;
  try {
    const obj = raw ? JSON.parse(raw) : {};
    validJson = !!raw;
    keys = Object.keys(obj || {});
  } catch (e) {
    validJson = false;
  }
  return {
    schoolsProperty: PUBLIC_STAFF_PORTAL_PROPERTY_SCHOOLS,
    hasSchoolsJson: !!raw,
    schoolsJsonValid: validJson,
    configuredSchoolKeys: keys,
    tokenSecretProperty: PUBLIC_STAFF_PORTAL_PROPERTY_SECRET,
    hasTokenSecret: !!secret
  };
}

function resolvePublicSchool_(schoolId) {
  const schools = getPublicSchoolsConfig_();
  const keys = Object.keys(schools);
  let requested = cleanPublic_(schoolId || '');
  let resolvedKey = requested;
  if (!resolvedKey && keys.length === 1) resolvedKey = keys[0];
  if (resolvedKey && !schools[resolvedKey]) {
    const lower = resolvedKey.toLowerCase();
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const school = schools[k] || {};
      if (k.toLowerCase() === lower || cleanPublic_(school.name).toLowerCase() === lower || cleanPublic_(school.id).toLowerCase() === lower) {
        resolvedKey = k;
        break;
      }
    }
  }
  const school = schools[resolvedKey];
  if (!school || !school.spreadsheetId) {
    throw new Error('Staff Portal school is not configured. The link requested school "' + (requested || '(blank)') + '". Configured school keys: ' + (keys.join(', ') || '(none)') + '. In the Redis deployment, check /api/staff-portal/config and confirm the requested school key is listed. Existing links using numeric school short codes such as school=1 are supported when _CampusRegistry is present.');
  }
  return { id: resolvedKey, name: cleanPublic_(school.name || resolvedKey), spreadsheetId: cleanPublic_(school.spreadsheetId) };
}

function getPublicPublishedScheduleViews_(ss) {
  const props = getPublicCampusProps_(ss);
  const json = props.V5_PUBLISHED_SCHEDULE_JSON || '';
  if (!json) return normalizePublicScheduleViews_({ publishedAt: '', items: [], staffSchedules: [], studentSchedules: [], breakItems: [] }, ss);
  const views = JSON.parse(json);
  views.publishedAt = props.V5_PUBLISHED_AT || views.publishedAt || '';
  const versionCount = cleanPublic_(props.V5_PUBLISHED_VERSION_COUNT || '');
  const versionLabel = cleanPublic_(props.V5_PUBLISHED_VERSION_LABEL || (versionCount ? 'v' + versionCount : ''));
  if (!views.scheduleVersion && versionCount) views.scheduleVersion = versionCount;
  if (!views.publishedVersion && versionCount) views.publishedVersion = versionCount;
  if (!views.scheduleVersionLabel && versionLabel) views.scheduleVersionLabel = versionLabel;
  if (!views.versionLabel && versionLabel) views.versionLabel = versionLabel;
  views.unassignedSupportLocation = views.unassignedSupportLocation || props.V5_UNASSIGNED_SUPPORT_LOCATION || '';
  return normalizePublicScheduleViews_(views, ss);
}

function getPublicRegularScheduleForStaffPortal_(ss) {
  const props = getPublicCampusProps_(ss);
  const display = String(props.V5_DISPLAY_REGULAR_ON_STAFF_PORTAL || '').toLowerCase() === 'true';
  const ids = String(props.V5_REGULAR_HISTORY_IDS || props.V5_REGULAR_HISTORY_ID || '').split(',').map(function(x) { return cleanPublic_(x); }).filter(Boolean);
  if (!display || !ids.length) return { displayOnStaffPortal: display, schedules: [] };
  const rows = getPublicScheduleHistoryRows_(ss);
  const schedules = ids.map(function(id) {
    const found = rows.filter(function(r) { return r.id === id; })[0];
    if (!found || !found.chunks) return null;
    let views = {};
    try { views = JSON.parse(found.chunks || '{}') || {}; } catch (e) { views = {}; }
    views = normalizePublicScheduleViews_(views, ss);
    return { id: id, label: publicRegularScheduleLabel_(found), publishedAt: found.publishedAt, summary: found.summary, views: views };
  }).filter(Boolean);
  return { displayOnStaffPortal: display, schedules: schedules, views: schedules[0] ? schedules[0].views : null };
}

function getPublicScheduleHistoryRows_(ss) {
  const sh = ss.getSheetByName(PUBLIC_STAFF_PORTAL_HISTORY_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(7, sh.getLastColumn())).getValues();
  return values.map(function(r) {
    return { id: String(r[0] || ''), publishedAt: String(r[1] || ''), starred: r[2] === true || String(r[2]).toLowerCase() === 'true', notes: String(r[3] || ''), hash: String(r[4] || ''), summary: String(r[5] || ''), chunks: r.slice(6).map(String).join('') };
  }).filter(function(r) { return r.id; });
}


function normalizePublicScheduleViews_(views, ss) {
  views = views || {};
  const displayMap = getPublicPeriodDisplayNameMap_(ss, views);
  views.periodDisplayNames = displayMap;
  views.items = normalizePublicScheduleItems_(views.items || [], displayMap);
  _injectFreeTimeIntoPublicViewsV05418Free_(views, ss);
  return views;
}

// ===================================================================================
// Free Time Assignment injection (v05418free), staff-portal side. See
// admin_portal_current_m46.gs for the full read/write/computation logic this mirrors --
// this is a read-only copy scoped to what the staff portal needs to display.
// ===================================================================================
function _readTodaysFreeTimeAssignmentsPublicV05418Free_(ss) {
  try {
    const sh = ss.getSheetByName('_FreeTimeAssignments');
    if (!sh) return [];
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return [];
    const todayKey = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd');
    const values = sh.getRange(2, 1, lastRow - 1, 11).getValues();
    const out = [];
    values.forEach(function(row) {
      if (cleanPublic_(row[1]) !== todayKey) return;
      if (!cleanPublic_(row[0])) return;
      out.push({ staff: cleanPublic_(row[2]), period: cleanPublic_(row[3]), startMinutes: Number(row[4]), endMinutes: Number(row[5]), type: cleanPublic_(row[6]), detail: cleanPublic_(row[7]), visibility: cleanPublic_(row[8]) || (cleanPublic_(row[6]) === 'comp-time' ? 'admin-only' : 'general') });
    });
    return out;
  } catch (e) { return []; }
}
// Overlaps at least half the assignment's window against the row's period, since the
// published views' items array has each period's own start/end and a single row can only
// belong to one period -- this just confirms the assignment's period key matches the row.
function _freeTimeLabelForTypeV05418Free_(a) {
  if (a.type === 'overlap') return 'Overlapping with ' + a.detail;
  if (a.type === 'comp-time') return 'Comp Time';
  if (a.type === 'other') return a.detail || 'Other';
  return 'Support' + (a.detail ? ' ' + a.detail : ''); // 'support' and 'confirmed-default'
}
function _injectFreeTimeIntoPublicViewsV05418Free_(views, ss) {
  try {
    const assignments = _readTodaysFreeTimeAssignmentsPublicV05418Free_(ss);
    if (!assignments.length) return;
    const byStaffPeriod = {};
    assignments.forEach(function(a) { (byStaffPeriod[a.staff + '||' + a.period] = byStaffPeriod[a.staff + '||' + a.period] || []).push(a); });
    (views.staffSchedules || []).forEach(function(s) {
      (s.rows || []).forEach(function(row) {
        const key = s.staff + '||' + row.period;
        const mine = byStaffPeriod[key];
        if (mine && mine.length) {
          row.freeTimeAssignments = mine.map(function(a) { return { type: a.type, detail: a.detail, visibility: a.visibility, label: _freeTimeLabelForTypeV05418Free_(a), startMinutes: a.startMinutes, endMinutes: a.endMinutes }; });
        }
      });
    });
    // Overlap also shows on the *other* staff member's row for that period, so they know
    // someone is joining them -- not just visible to the person who initiated the overlap.
    assignments.forEach(function(a) {
      if (a.type !== 'overlap' || !a.detail) return;
      (views.staffSchedules || []).forEach(function(s) {
        if (s.staff !== a.detail) return;
        (s.rows || []).forEach(function(row) {
          if (row.period !== a.period) return;
          row.freeTimeOverlapFrom = row.freeTimeOverlapFrom || [];
          row.freeTimeOverlapFrom.push({ staff: a.staff, startMinutes: a.startMinutes, endMinutes: a.endMinutes });
        });
      });
    });
  } catch (e) { /* never let a display enhancement break the whole portal */ }
}

// Strips admin-only (Comp Time) free-time entries from anyone else's row -- called with
// the viewing staff member's own verified name, or '' for the general/unauthenticated view
// (which should never see anyone's Comp Time).
function _filterFreeTimeVisibilityV05418Free_(views, viewingStaffName) {
  try {
    (views.staffSchedules || []).forEach(function(s) {
      const isOwnRow = viewingStaffName && s.staff === viewingStaffName;
      (s.rows || []).forEach(function(row) {
        if (Array.isArray(row.freeTimeAssignments)) {
          row.freeTimeAssignments = row.freeTimeAssignments.filter(function(a) { return a.visibility !== 'admin-only' || isOwnRow; });
          if (!row.freeTimeAssignments.length) delete row.freeTimeAssignments;
        }
      });
    });
  } catch (e) { /* never let a display enhancement break the whole portal */ }
}


function normalizePublicScheduleItems_(items, displayMap) {
  displayMap = displayMap || {};
  return (items || []).map(function(it) {
    if (typeof it === 'string') {
      const key = cleanPublic_(it);
      const display = publicDisplayNameForPeriod_(key, displayMap, key);
      return { key: key, label: key, displayName: display, title: display };
    }
    it = it || {};
    const key = cleanPublic_(it.key || it.label || it.period || it.item || it.title || it.displayName || '');
    const existingTitle = cleanPublic_(it.title || '');
    const titleParts = publicSplitBlockTitle_(existingTitle);
    const fallbackName = cleanPublic_(it.displayName || titleParts.name || it.label || it.key || key);
    const display = publicDisplayNameForPeriod_(key, displayMap, fallbackName);
    const time = cleanPublic_(it.time || it.timeLabel || publicTimeFromBlockTitle_(existingTitle) || ((it.startMinutes != null && it.endMinutes != null) ? (formatPublicMinutes_(it.startMinutes) + ' - ' + formatPublicMinutes_(it.endMinutes)) : ''));
    const copy = {};
    Object.keys(it).forEach(function(k) { copy[k] = it[k]; });
    copy.key = key || display;
    copy.label = cleanPublic_(it.label || key || display);
    copy.displayName = display || copy.label;
    copy.title = (copy.displayName || copy.label) + (time ? '\n' + time : '');
    if (time) copy.timeLabel = time;
    return copy;
  });
}

function getPublicPeriodDisplayNameMap_(ss, views) {
  const out = {};
  function put(key, display) {
    key = cleanPublic_(key || '');
    display = cleanPublic_(display || key);
    if (key) out[key] = display || key;
  }
  const existing = (views && views.periodDisplayNames) || {};
  Object.keys(existing || {}).forEach(function(k) { put(k, existing[k]); });
  const props = ss ? getPublicCampusProps_(ss) : {};
  const raw = props.V5_PERIOD_META_JSON || '';
  if (raw) {
    try {
      (JSON.parse(raw) || []).forEach(function(row) {
        row = row || {};
        put(row.key || row.label || row.item, row.displayName || row.title || row.name);
      });
    } catch (e) {}
  }
  put('Break', out.Break || 'Break');
  put('Lunch', out.Lunch || 'Lunch');
  return out;
}

function publicDisplayNameForPeriod_(key, displayMap, fallback) {
  key = cleanPublic_(key || '');
  displayMap = displayMap || {};
  if (key && displayMap[key]) return cleanPublic_(displayMap[key]);
  const wanted = normalizePublicName_(key);
  for (const k in displayMap) {
    if (normalizePublicName_(k) === wanted) return cleanPublic_(displayMap[k]);
  }
  return cleanPublic_(fallback || key);
}

function publicRegularScheduleLabel_(r) {
  const note = cleanPublic_((r && r.notes) || '');
  if (note) return note.split('/')[0].trim() || note.substring(0, 24);
  return String((r && r.summary) || 'Regular Schedule').split(' - ')[0] || 'Regular Schedule';
}

function getPublicCampusProps_(ss) {
  const sheet = ss.getSheetByName(PUBLIC_STAFF_PORTAL_PROPERTY_SHEET);
  const raw = {};
  if (sheet && sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(2, sheet.getLastColumn())).getDisplayValues();
    values.forEach(function(r) { const key = cleanPublic_(r[0]); if (key) raw[key] = String(r[1] || ''); });
  }
  const map = {};
  Object.keys(raw).forEach(function(key) {
    if (key.indexOf(PUBLIC_STAFF_PORTAL_CHUNK_MARK) >= 0) return;
    const val = raw[key] || '';
    if (val.indexOf(PUBLIC_STAFF_PORTAL_CHUNK_PREFIX) === 0) {
      const count = Number(val.substring(PUBLIC_STAFF_PORTAL_CHUNK_PREFIX.length)) || 0;
      let combined = '';
      for (let i = 0; i < count; i++) combined += raw[key + PUBLIC_STAFF_PORTAL_CHUNK_MARK + ('0000' + i).slice(-4)] || '';
      map[key] = combined;
    } else {
      map[key] = val;
    }
  });
  return map;
}

function getPublicStaffSheet_(ss) {
  if (!ss) return null;
  const legacyEmojiStaffSheet = '\uD83D\uDC68\uD83C\uDFFB\uD83D\uDC69\uD83C\uDFFB';
  const candidates = [legacyEmojiStaffSheet, 'Staff', 'Staff Manager', 'StaffData', 'Staff Data'];
  for (let i = 0; i < candidates.length; i++) {
    try {
      const sheet = ss.getSheetByName(candidates[i]);
      if (sheet) return sheet;
    } catch (e) {}
  }
  const sheets = ss.getSheets ? ss.getSheets() : [];
  for (let j = 0; j < sheets.length; j++) {
    const name = cleanPublic_(sheets[j].getName && sheets[j].getName());
    const key = normalizePublicName_(name);
    if (key === 'staff' || key === 'staff manager' || key.indexOf('staff') >= 0) return sheets[j];
  }
  return null;
}

function publicStaffStatusColumnAliases_() {
  return ['status', 'status code', 'staff status', 'employee status', 'employment status', 'active status', 'active'];
}

function isPublicActiveStaffStatus_(status) {
  const s = normalizePublicName_(status || '');
  if (!s) return true;
  return s === 'active' || s === 'a' || s === 'yes' || s === 'y' || s === 'true' || s === '1' || s === 'lead' || s.indexOf('active') === 0;
}

function getPublicActiveStaffNames_(ss) {
  const sheet = getPublicStaffSheet_(ss);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = getPublicHeaderMap_(sheet);
  const colName = findPublicHeaderCol_(headers, ['name', 'staff', 'staff name', 'staff member', 'employee name'], 1);
  const colStatus = findPublicHeaderCol_(headers, publicStaffStatusColumnAliases_(), 0);
  const display = sheet.getDataRange().getDisplayValues();
  const names = [];
  const fallbackNames = [];
  const seen = {};
  for (let r = 1; r < display.length; r++) {
    const name = cleanPublic_(display[r][colName - 1]);
    if (!name || /^vacancy/i.test(name)) continue;
    const key = normalizePublicName_(name);
    if (!seen[key]) { seen[key] = true; fallbackNames.push(name); }
    const status = colStatus ? cleanPublic_(display[r][colStatus - 1]) : '';
    if (!isPublicActiveStaffStatus_(status)) continue;
    if (names.map(normalizePublicName_).indexOf(key) < 0) names.push(name);
  }
  // In the Redis migration some test/imported staff sheets may not have a fully
  // normalized Status column yet. If no active names can be derived but staff rows
  // exist, fall back to non-vacancy staff names so Report an Absence is still usable.
  const out = names.length ? names : fallbackNames;
  return out.sort(function(a, b) { return a.localeCompare(b); });
}

function getPublicStaffStatusForName_(ss, staffName) {
  const sheet = getPublicStaffSheet_(ss);
  if (!sheet || sheet.getLastRow() < 2) return { exists: false, active: false, name: '', status: '' };
  const headers = getPublicHeaderMap_(sheet);
  const colName = findPublicHeaderCol_(headers, ['name', 'staff', 'staff name', 'staff member', 'employee name'], 1);
  const colStatus = findPublicHeaderCol_(headers, publicStaffStatusColumnAliases_(), 0);
  const display = sheet.getDataRange().getDisplayValues();
  const target = normalizePublicName_(staffName);
  for (let r = 1; r < display.length; r++) {
    const name = cleanPublic_(display[r][colName - 1]);
    if (!name || normalizePublicName_(name) !== target) continue;
    const status = colStatus ? cleanPublic_(display[r][colStatus - 1]) : '';
    return { exists: true, active: isPublicActiveStaffStatus_(status), name: name, status: status };
  }
  return { exists: false, active: false, name: '', status: '' };
}


function getPublicStaffNamesFromViews_(views) {
  const names = [];
  ((views && views.staffSchedules) || []).forEach(function(s) {
    const n = cleanPublic_(s.staff || s.staffName || s.name || s.displayName || s.label || '');
    if (n && !/^vacancy/i.test(n)) names.push(n);
  });
  return names;
}

function mergePublicNameLists_() {
  const seen = {};
  const out = [];
  for (let a = 0; a < arguments.length; a++) {
    (arguments[a] || []).forEach(function(n) {
      n = cleanPublic_(n);
      const key = normalizePublicName_(n);
      if (!n || !key || /^vacancy/i.test(n) || seen[key]) return;
      seen[key] = true;
      out.push(n);
    });
  }
  return out.sort(function(a, b) { return a.localeCompare(b); });
}

function getPublicStudentDataUrlMap_(ss) {
  const candidates = ['Students', 'Student Manager', 'StudentData', 'Student Data'];
  let sheet = null;
  for (let i = 0; i < candidates.length; i++) {
    sheet = ss.getSheetByName(candidates[i]);
    if (sheet) break;
  }
  if (!sheet || sheet.getLastRow() < 2) return {};
  const headers = getPublicHeaderMap_(sheet);
  const nameCol = findPublicHeaderCol_(headers, ['name', 'student', 'student name'], 1);
  const urlCol = findPublicHeaderCol_(headers, ['data files url', 'data file url', 'datafilesurl', 'data files', 'data file', 'form url', 'data url', 'url', 'published data url'], 0);
  if (!urlCol) return {};
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), nameCol, urlCol)).getDisplayValues();
  const map = {};
  values.forEach(function(r) {
    const name = cleanPublic_(r[nameCol - 1]);
    const url = cleanPublic_(r[urlCol - 1]);
    const key = normalizePublicName_(name);
    if (key && url) map[key] = url;
  });
  return map;
}

function ensurePublicAttendanceSheet_(ss) {
  const desired = ['Timestamp', 'Name', 'Source', 'Start Date', 'End Date', 'Reason', 'Day Part', 'Arrival Time', 'Leave Time', 'Notes', 'Status'];
  const sheet = ss.getSheetByName('Attendance') || ss.insertSheet('Attendance');
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, desired.length).setValues([desired]).setFontWeight('bold');
    return sheet;
  }
  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), desired.length)).getDisplayValues()[0].map(cleanPublic_);
  desired.forEach(function(h) {
    if (existing.map(function(x) { return x.toLowerCase(); }).indexOf(h.toLowerCase()) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h).setFontWeight('bold');
      existing.push(h);
    }
  });
  return sheet;
}

function getPublicHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0];
  const map = {};
  headers.forEach(function(h, i) { const k = cleanPublic_(h).toLowerCase(); if (k) map[k] = i + 1; });
  return map;
}

function findPublicHeaderCol_(map, names, fallback) {
  for (let i = 0; i < names.length; i++) {
    const k = cleanPublic_(names[i]).toLowerCase();
    if (map[k]) return map[k];
  }
  return fallback;
}

function resolvePublicStaffIdentity_(schoolId, staffName, token, spreadsheetId) {
  staffName = cleanPublic_(staffName || '');
  token = cleanPublic_(token || '');
  if (!staffName || !token) return { valid: false, staffName: '', token: token };
  const secret = cleanPublic_(PropertiesService.getScriptProperties().getProperty(PUBLIC_STAFF_PORTAL_PROPERTY_SECRET) || '');
  if (!secret) return { valid: false, staffName: '', token: token, error: 'Staff-specific links are not fully configured. Add V5_STAFF_PORTAL_TOKEN_SECRET_V5312 to the public Staff Portal script properties.' };
  const valid = validatePublicStaffPortalToken_(schoolId, staffName, token, spreadsheetId);
  return { valid: valid, staffName: valid ? staffName : '', token: token, error: valid ? '' : 'This staff-specific link could not be validated. My Schedule and locked staff name are hidden until the token secret matches the Admin Portal.' };
}

function validatePublicStaffPortalToken_(schoolId, staffName, token, spreadsheetId) {
  return cleanPublic_(token) === makePublicStaffPortalToken_(schoolId, staffName, spreadsheetId);
}

// V05421: this file's own normalizePublicName_ (used widely elsewhere for matching staff
// names against schedule data) collapses any run of non-alphanumeric characters -- including
// a hyphen -- to a single space. That's fine for schedule-name matching, but the token here
// has to byte-for-byte match what the Node server and the admin-portal script both compute,
// and both of those preserve a hyphen as a hyphen. Using normalizePublicName_ here meant
// every hyphenated staff name's token silently failed to validate. This normalizer mirrors
// normalizeStaffPortalName in src/server.js exactly, for this token check only.
function normalizeStaffPortalTokenName_(v) {
  v = String(v == null ? '' : v);
  if (v.normalize) v = v.normalize('NFKC');
  return v
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// V05421: mirrors getStaffTokenVersionV05421_ in admin_portal_current_m46.gs -- reads the
// same _StaffTokenVersions sheet (bumped by the Node-side revoke action), so a revoke
// invalidates the token here too, not just in the admin portal's own displayed link.
function getStaffTokenVersionV05421Public_(spreadsheetId, staffName) {
  try {
    if (!spreadsheetId) return 0;
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName('_StaffTokenVersions');
    if (!sheet) return 0;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return 0;
    const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const key = normalizeStaffPortalTokenName_(staffName);
    for (let i = 0; i < values.length; i++) {
      if (String((values[i] && values[i][0]) || '').trim().toLowerCase() === key) return Number(values[i][1] || 0) || 0;
    }
    return 0;
  } catch (e) { return 0; }
}

function makePublicStaffPortalToken_(schoolId, staffName, spreadsheetId) {
  const secret = cleanPublic_(PropertiesService.getScriptProperties().getProperty(PUBLIC_STAFF_PORTAL_PROPERTY_SECRET) || '');
  if (!secret) return '';
  const version = getStaffTokenVersionV05421Public_(spreadsheetId, staffName);
  const raw = cleanPublic_(schoolId || 'default') + '|' + normalizeStaffPortalTokenName_(staffName) + '|' + version;
  const sig = Utilities.computeHmacSha256Signature(raw, secret);
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '').slice(0, 24);
}

function normalizePublicBreakItems_(rows) {
  return (rows || []).map(function(b) {
    const copy = {};
    Object.keys(b || {}).forEach(function(k) { copy[k] = b[k]; });
    if (!copy.time && copy.startMinutes != null && copy.endMinutes != null) copy.time = formatPublicMinutes_(copy.startMinutes) + ' - ' + formatPublicMinutes_(copy.endMinutes);
    return copy;
  });
}

function formatPublicMinutes_(m) {
  m = Number(m);
  if (!isFinite(m)) return '';
  const h = Math.floor(m / 60), min = m % 60, ap = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return hh + ':' + String(min).padStart(2, '0') + ' ' + ap;
}

function parsePublicIsoDate_(v) {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function samePublicDate_(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function escPublic_(v) {
  return String(v == null ? '' : v).replace(/[&<>\"]/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] || c; });
}

function escPublicAttr_(v) {
  return escPublic_(v).replace(/'/g, '&#39;');
}

function cleanPublic_(v) {
  return String(v == null ? '' : v).trim();
}

function normalizePublicName_(v) {
  return cleanPublic_(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// =====================================================================================
// Redis parity v0.19: Staff Portal regular schedule bridge.
// Reads _ScheduleHistoryLocks as the primary lock source so locked Historical Schedules
// appear in the Staff Portal when the Regular Schedule display toggle is enabled.
// =====================================================================================
function getPublicRegularLockIdsRedisV019_(ss) {
  const sh = ss && ss.getSheetByName ? ss.getSheetByName('_ScheduleHistoryLocks') : null;
  const ids = [];
  if (!sh || sh.getLastRow() < 2) return ids;
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(2, sh.getLastColumn())).getValues();
  values.forEach(function(row) {
    const id = cleanPublic_(row[0] || '');
    if (!id) return;
    const locked = row[1] === true || /^true|1|yes|locked$/i.test(String(row[1] || ''));
    if (locked && ids.indexOf(id) < 0) ids.push(id);
  });
  return ids;
}
function getPublicRegularScheduleForStaffPortal_(ss) {
  const props = getPublicCampusProps_(ss);
  const display = String(props.V5_DISPLAY_REGULAR_ON_STAFF_PORTAL || '').toLowerCase() === 'true';
  let ids = getPublicRegularLockIdsRedisV019_(ss);
  // Redis v0.22: Regular Schedule is driven only by explicit Historical Schedule locks.
  // Do not fall back to old V5_REGULAR_HISTORY_IDS values, because those stale legacy
  // properties can show unlocked schedules in the Staff Portal.
  if (!display || !ids.length) return { displayOnStaffPortal: display, schedules: [] };
  const rows = getPublicScheduleHistoryRows_(ss);
  const schedules = ids.map(function(id) {
    const found = rows.filter(function(r) { return r.id === id; })[0];
    if (!found || !found.chunks) return null;
    let views = {};
    try { views = JSON.parse(found.chunks || '{}') || {}; } catch (e) { views = {}; }
    views = normalizePublicScheduleViews_(views, ss);
    return { id: id, label: publicRegularScheduleLabel_(found), publishedAt: found.publishedAt, summary: found.summary, views: views };
  }).filter(Boolean);
  return { displayOnStaffPortal: display, schedules: schedules, views: schedules[0] ? schedules[0].views : null };
}

// =====================================================================================
// V0.54.18ED Staff Portal split-period support display.
// Shows split-period support as an actual time window and marks unused outside time free
// when the row contains only split support and no break/lunch/coverage event.
// =====================================================================================
(function(){
  function cleanED_(v){ return String(v == null ? '' : v).trim(); }
  function normED_(v){ return cleanED_(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
  function numED_(v){ if(v===0)return 0; if(v==null||v==='')return null; var n=Number(v); return isFinite(n)?n:null; }
  function fmtED_(m){ try { return formatPublicMinutes_(m); } catch(e) {} m=Number(m); if(!isFinite(m)) return ''; var h=Math.floor(m/60), mi=m%60, ap=h>=12?'PM':'AM', hh=h%12; if(!hh)hh=12; return hh+':'+String(mi).padStart(2,'0')+' '+ap; }
  function rangeED_(s,e){ return fmtED_(s)+' - '+fmtED_(e); }
  function splitLabelED_(o){ o=o||{}; var cap=cleanED_(o.splitWindowCaption||o.splitCaption||''); var raw=cleanED_(o.splitWindowLabel||o.splitLabel||o.splitTimeLabel||o.supportWindow||o.timeWindow||''); if(cap&&raw)return cap+' · '+raw; if(cap)return cap; if(raw)return raw; var s=numED_(o.splitStartMinutes), e=numED_(o.splitEndMinutes); return (s!=null&&e!=null&&e>s)?rangeED_(s,e):''; }
  function withSplitNameED_(obj){ obj=obj||{}; var name=cleanED_(obj.displayName||obj.baseName||obj.name||obj.student||''); var sp=splitLabelED_(obj); if(sp && name.indexOf(sp)<0) name += ' ('+sp+')'; var out={}; Object.keys(obj).forEach(function(k){out[k]=obj[k];}); out.name=name; out.student=name; return out; }
  function mergeIntervalsED_(arr){ arr=(arr||[]).filter(function(x){return x&&x.start!=null&&x.end!=null&&x.end>x.start;}).sort(function(a,b){return a.start-b.start||a.end-b.end;}); var out=[]; arr.forEach(function(x){ if(!out.length||x.start>out[out.length-1].end)out.push({start:x.start,end:x.end}); else out[out.length-1].end=Math.max(out[out.length-1].end,x.end); }); return out; }
  function freeSegmentsED_(row,busy){ var ps=numED_(row&&row.startMinutes), pe=numED_(row&&row.endMinutes); if(ps==null||pe==null||pe<=ps)return []; var cur=ps,out=[]; mergeIntervalsED_(busy).forEach(function(b){ if(b.start>cur)out.push({start:cur,end:b.start}); cur=Math.max(cur,b.end); }); if(cur<pe)out.push({start:cur,end:pe}); return out.filter(function(x){return x.end>x.start;}); }
  var baseStudentAnchorED_ = (typeof publicStudentAnchor_ === 'function') ? publicStudentAnchor_ : null;
  publicStudentAnchor_ = function(obj,data){ return baseStudentAnchorED_ ? baseStudentAnchorED_(withSplitNameED_(obj||{}), data) : escPublic_(withSplitNameED_(obj||{}).name||''); };
  publicGroupedStudentRoomHtml_ = function(students,fallbackLocation,data){
    students=students||[]; if(!students.length)return '';
    var groups=[];
    students.forEach(function(st){ var loc=cleanED_((st&&st.location)||fallbackLocation||''); var key=loc||'__no_room__'; var group=groups.filter(function(g){return g.key===key;})[0]; if(!group){group={key:key,location:loc,students:[]};groups.push(group);} group.students.push(st); });
    groups.sort(function(a,b){ return publicRoomSortKey_(a.location).localeCompare(publicRoomSortKey_(b.location)); });
    return groups.map(function(group){ var names=group.students.map(function(st){ return publicStudentAnchor_(st,data); }).join('<br>'); return '<div class="studentRoomGroup">'+names+(group.location?'<div class="muted">'+escPublic_(group.location)+'</div>':'')+'</div>'; }).join('');
  };
  var baseRestED_ = (typeof publicRestHtml_ === 'function') ? publicRestHtml_ : null;
  publicStaffCell_ = function(r,data,options){
    options=options||{}; r=r||{};
    if(r.hideAssignmentForDesignatedRest) return baseRestED_ ? baseRestED_(r.restEvents||[],options) : '';
    var students=r.students||[];
    var rest=(r.restEvents&&r.restEvents.length&&baseRestED_)?baseRestED_(r.restEvents,options):'';
    var splitStudents=students.filter(function(st){return !!splitLabelED_(st);});
    var allSplit=students.length && splitStudents.length===students.length && numED_(r.startMinutes)!=null && numED_(r.endMinutes)!=null;
    if(allSplit){
      var busy=[];
      var supportHtml=splitStudents.map(function(st){ var s=numED_(st.splitStartMinutes), e=numED_(st.splitEndMinutes); if(s==null||e==null||e<=s)return ''; busy.push({start:s,end:e}); var loc=cleanED_(st.location||r.location||''); return '<div class="studentRoomGroup splitSupportBlock"><b>'+escPublic_(rangeED_(s,e))+'</b><br>'+publicStudentAnchor_(st,data)+(loc?'<div class="muted">'+escPublic_(loc)+'</div>':'')+'</div>'; }).join('');
      var freeHtml = rest ? '' : freeSegmentsED_(r,busy).map(function(f){return '<div class="free splitFreeBlock"><b>'+escPublic_(rangeED_(f.start,f.end))+'</b><br>Free</div>';}).join('');
      return supportHtml + freeHtml + rest;
    }
    var html='';
    if(students.length) html+=publicGroupedStudentRoomHtml_(students,r.location,data);
    else if(r.student){ html+=publicStudentAnchor_({name:r.student,url:r.url},data); if(r.location)html+='<div class="muted">'+escPublic_(r.location)+'</div>'; }
    else html+='<span class="free">'+escPublic_(publicStaffOpenPeriodText_(r,data))+'</span>';
    if(rest)html+=rest;
    if(r.coveringFor)html+='<span class="cover">Covering: '+escPublic_(r.coveringFor)+'</span>';
    return html;
  };
  var baseStudentCellED_ = (typeof publicStudentCell_ === 'function') ? publicStudentCell_ : null;
  publicStudentCell_ = function(r){
    r=r||{}; var sp=splitLabelED_(r); if(sp){ var copy={}; Object.keys(r).forEach(function(k){copy[k]=r[k];}); var support=cleanED_(copy.support||copy.supportType||''); if(support && support.indexOf(sp)<0) copy.support=support+' ('+sp+')'; return baseStudentCellED_ ? baseStudentCellED_(copy) : ''; }
    return baseStudentCellED_ ? baseStudentCellED_(r) : '';
  };
  var baseNormalizeED_ = (typeof normalizePublicScheduleViews_ === 'function') ? normalizePublicScheduleViews_ : null;
  if(baseNormalizeED_){
    normalizePublicScheduleViews_ = function(views,ss){
      views=baseNormalizeED_(views,ss)||{}; var by={};
      (views.items||[]).forEach(function(it){ [it.key,it.label,it.period,it.item,it.title,it.displayName].forEach(function(k){k=cleanED_(k); if(k)by[normED_(k)]=it;}); });
      function add(row){ row=row||{}; var it=by[normED_(row.period||row.label||row.title||row.item)]; if(!it)return; var s=numED_(it.startMinutes), e=numED_(it.endMinutes); if(s!=null&&e!=null&&e>s){ row.startMinutes=s; row.endMinutes=e; row.timeLabel=row.timeLabel||rangeED_(s,e); } }
      (views.staffSchedules||[]).forEach(function(sr){ (sr.rows||[]).forEach(add); });
      (views.studentSchedules||[]).forEach(function(st){ (st.rows||[]).forEach(add); });
      views._splitPeriodDisplayV05418ED=true;
      return views;
    };
  }
})();

// =====================================================================================
// V0.54.18EH Staff Portal break/lunch card display cleanup.
// - My Schedule separates Break and Lunch entries instead of one repeated Break/Lunch area.
// - N/A values are suppressed from staff-facing break/lunch cards.
// =====================================================================================
(function(){
  function rootEH_(){ return (typeof globalThis !== 'undefined') ? globalThis : this; }
  function cleanEH_(v){ return String(v == null ? '' : v).trim(); }
  function normEH_(v){ return cleanEH_(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
  function isNaEH_(v){ return /^(n\/?a|na)$/i.test(cleanEH_(v)); }
  function cleanNaEH_(v){ var s=cleanEH_(v); return isNaEH_(s)?'':s; }
  var root = rootEH_();
  try {
    root.renderPublicMyBreakCard_ = function(b, staff){
      b = b || {};
      var type = cleanNaEH_(b.type || '');
      if(!type) type = 'Break';
      var mineBreak = normEH_(b.staffOnBreak) === normEH_(staff);
      var mineCover = normEH_(b.coveringStaff) === normEH_(staff) || normEH_(b.helperStaff) === normEH_(staff);
      var lines = [];
      if(mineBreak) {
        if(cleanNaEH_(b.coveringStaff)) lines.push('<div><b>Coverage:</b> ' + escPublic_(cleanNaEH_(b.coveringStaff)) + '</div>');
      } else if(mineCover) {
        if(cleanNaEH_(b.staffOnBreak)) lines.push('<div><b>Covering:</b> ' + escPublic_(cleanNaEH_(b.staffOnBreak)) + '</div>');
      } else if(cleanNaEH_(b.coveringStaff)) {
        lines.push('<div><b>Coverage:</b> ' + escPublic_(cleanNaEH_(b.coveringStaff)) + '</div>');
      }
      var meta = [type, cleanNaEH_(b.students), cleanNaEH_(b.location)].filter(Boolean).join(' · ');
      if(meta) lines.push('<div class="muted">' + escPublic_(meta) + '</div>');
      return '<div class="mCard"><div class="mTitle">' + escPublic_(publicBreakTime_(b)) + '</div>' + lines.join('') + '</div>';
    };
    try{ renderPublicMyBreakCard_ = root.renderPublicMyBreakCard_; }catch(e0){}
  } catch(e1) {}
  try {
    root.renderPublicMyRows_ = function(data, staff){
      data = data || {};
      var items = publicItemsFrom_(data);
      var match = ((data.staffSchedules || []).filter(function(s){ return normalizePublicName_(s.staff || s.name) === normalizePublicName_(staff); })[0]);
      var html = '';
      if(match){
        html += items.map(function(it){
          var title = publicItemTitle_(it);
          var row = publicFindRow_(match.rows || [], it);
          return '<div class="mCard"><div class="mTitle">' + publicBlockTitleHtml_(title) + '</div>' + publicStaffCell_(row, data, { mySchedule:true, itemTitle:title }) + '</div>';
        }).join('');
      } else {
        html += '<div class="mCard muted">No staff schedule row found for ' + escPublic_(staff) + '.</div>';
      }
      var breaks = ((data.breakItems || []).filter(function(b){ return normalizePublicName_([b.staffOnBreak, b.coveringStaff, b.helperStaff, b.helperCoveringFor].join(' ')).indexOf(normalizePublicName_(staff)) >= 0; }));
      var breakRows = [], lunchRows = [], otherRows = [];
      breaks.forEach(function(b){ var t = normEH_(b && b.type); if(t.indexOf('lunch') >= 0) lunchRows.push(b); else if(t.indexOf('break') >= 0 || !t || t === 'n a') breakRows.push(b); else otherRows.push(b); });
      if(breakRows.length) html += '<h3>Break</h3>' + breakRows.map(function(b){ return renderPublicMyBreakCard_(b, staff); }).join('');
      if(lunchRows.length) html += '<h3>Lunch</h3>' + lunchRows.map(function(b){ return renderPublicMyBreakCard_(b, staff); }).join('');
      if(otherRows.length) html += '<h3>Coverage</h3>' + otherRows.map(function(b){ return renderPublicMyBreakCard_(b, staff); }).join('');
      return html;
    };
    try{ renderPublicMyRows_ = root.renderPublicMyRows_; }catch(e2){}
  } catch(e3) {}
})();
