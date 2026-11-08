// Tidepath Safe Form Filler: a deliberately conservative, prompt-based mapper.
// It fills only text inputs, textareas, and editable comboboxes after a person
// presses the in-page Fill button. It never clicks, checks, uploads, saves, or
// submits anything on behalf of the user.
const EXTENSION_NAME = 'Tidepath Safe Form Filler';
const FIELD_SELECTORS = 'textarea, input:not([type]), input[type="text"], input[type="email"], input[type="url"], input[type="tel"], [role="textbox"], [contenteditable="true"]';

const normalise = value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
const escapeForSelector = value => (window.CSS?.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&'));
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function visible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

function fieldLabel(field) {
  const parts = [];
  if (field.labels?.length) parts.push(...[...field.labels].map(label => label.innerText));
  if (field.id) {
    const explicit = document.querySelector(`label[for="${escapeForSelector(field.id)}"]`);
    if (explicit) parts.push(explicit.innerText);
  }
  const container = field.closest('fieldset, .field, .form-group, [data-field], li, section, div');
  if (container) parts.push(container.innerText?.slice(0, 600));
  parts.push(field.getAttribute('aria-label'), field.placeholder, field.name, field.id);
  return normalise(parts.filter(Boolean).join(' '));
}

function score(label, terms) {
  return terms.reduce((total, term) => total + (label.includes(term) ? 1 : 0), 0);
}

function getDraft() {
  return new Promise(resolve => chrome.runtime.sendMessage({ type: 'GET_APPROVED_DRAFT' }, response => resolve(response?.draft || null)));
}

function answerSet(draft) {
  return [
    { key: 'name', value: draft.name, terms: ['your name', 'full name', 'contact name', 'applicant name'] },
    { key: 'email', value: draft.email, terms: ['email', 'e-mail'] },
    { key: 'organization', value: draft.organization, terms: ['organization', 'organisation', 'nonprofit', 'applicant organization'] },
    { key: 'title', value: draft.title, terms: ['project title', 'proposal title', 'title of project'] },
    { key: 'project', value: draft.project, terms: ['tell us about your project', 'project description', 'describe your project', 'proposal narrative', 'project narrative'] },
    { key: 'money', value: draft.money, terms: ['how will you use the money', 'use of funds', 'how will funds be used', 'budget narrative', 'use grant funds'] },
    { key: 'about', value: draft.about, terms: ['tell us a little about your organization', 'about your organization', 'organizational background', 'organisation background'] },
    { key: 'miami', value: draft.miami, terms: ['impact greater miami', 'greater miami impact', 'local impact', 'community impact'] }
  ].filter(answer => answer.value);
}

function chooseField(answer, fields, used) {
  const candidates = fields
    .filter(field => !used.has(field))
    .map(field => ({ field, score: score(fieldLabel(field), answer.terms) }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.field || null;
}

function writeValue(field, value) {
  // Submit controls, checkboxes, radio buttons, file inputs, and buttons are
  // deliberately excluded by FIELD_SELECTORS and never manipulated here.
  if (field.matches('[contenteditable="true"]')) field.textContent = value;
  else field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  field.dispatchEvent(new Event('blur', { bubbles: true }));
}

function limitFor(field) {
  const maxlength = Number(field.getAttribute('maxlength'));
  return Number.isFinite(maxlength) && maxlength > 0 ? maxlength : null;
}

function createPanel() {
  if (document.getElementById('tidepath-safe-filler')) return document.getElementById('tidepath-safe-filler');
  const host = document.createElement('aside');
  host.id = 'tidepath-safe-filler';
  host.setAttribute('aria-label', EXTENSION_NAME);
  host.innerHTML = `
    <div class="tp-head"><strong>Tidepath</strong><span>Safe form filler</span></div>
    <p class="tp-status" id="tp-status">Looking for an approved Tidepath draft…</p>
    <div class="tp-actions"><button type="button" id="tp-fill" disabled>Fill approved answers</button><button type="button" id="tp-clear">Clear local draft</button></div>
    <p class="tp-rule"><b>Never submits.</b> You review, edit, and submit on this portal.</p>
    <div class="tp-results" id="tp-results"></div>`;
  const style = document.createElement('style');
  style.textContent = `#tidepath-safe-filler{position:fixed;z-index:2147483647;right:18px;bottom:18px;width:320px;padding:16px;border:1px solid #b8d8cb;border-radius:12px;background:#fff;color:#17362d;box-shadow:0 14px 40px rgba(9,53,42,.2);font:13px/1.4 Inter,system-ui,sans-serif}#tidepath-safe-filler .tp-head{display:flex;justify-content:space-between;gap:8px;align-items:baseline}#tidepath-safe-filler .tp-head strong{font-size:16px}#tidepath-safe-filler .tp-head span{color:#527368;font-size:11px;font-weight:700}#tidepath-safe-filler p{margin:10px 0;color:#4e6d62}#tidepath-safe-filler .tp-actions{display:flex;gap:8px}#tidepath-safe-filler button{border:1px solid #0d806b;border-radius:7px;padding:9px 10px;background:#07856f;color:#fff;font:700 12px/1.2 inherit;cursor:pointer}#tidepath-safe-filler button:disabled{cursor:not-allowed;opacity:.5}#tidepath-safe-filler #tp-clear{border-color:#bad7cb;background:#fff;color:#087560}#tidepath-safe-filler .tp-rule{padding:9px;border-radius:7px;background:#fff2d8;color:#765419;font-size:11px}#tidepath-safe-filler .tp-results{max-height:180px;overflow:auto;font-size:11px}#tidepath-safe-filler .tp-result{padding:7px 0;border-top:1px solid #edf2ef}#tidepath-safe-filler .tp-result strong{display:block;color:#1b5545}`;
  document.documentElement.append(style, host);
  return host;
}

async function setup() {
  const panel = createPanel();
  const status = panel.querySelector('#tp-status');
  const fill = panel.querySelector('#tp-fill');
  const results = panel.querySelector('#tp-results');
  let draft = await getDraft();

  if (!draft) {
    status.textContent = 'No approved Tidepath draft is stored in this browser.';
    return;
  }

  status.textContent = `Approved draft ready · ${new Date(draft.savedAt).toLocaleString()}`;
  fill.disabled = false;
  fill.addEventListener('click', () => {
    const fields = [...document.querySelectorAll(FIELD_SELECTORS)].filter(visible);
    const used = new Set();
    const outcomes = [];
    for (const answer of answerSet(draft)) {
      const field = chooseField(answer, fields, used);
      if (!field) { outcomes.push({ key: answer.key, state: 'Could not match a portal field.' }); continue; }
      const limit = limitFor(field);
      if (limit && answer.value.length > limit) { outcomes.push({ key: answer.key, state: `Not filled: answer is ${answer.value.length}/${limit} characters.`, warning: true }); continue; }
      writeValue(field, answer.value);
      used.add(field);
      outcomes.push({ key: answer.key, state: 'Filled from approved Tidepath draft.', generated: draft.generatedFields?.includes(answer.key), matchedPrompt: fieldLabel(field).slice(0, 110) });
    }
    results.innerHTML = outcomes.map(item => `<div class="tp-result"><strong>${escapeHtml(item.key)}</strong>${escapeHtml(item.state)}${item.generated ? '<br><em>Tidepath-generated wording · review required</em>' : ''}${item.matchedPrompt ? `<br><span>Matched: ${escapeHtml(item.matchedPrompt)}</span>` : ''}<br><span>Sources: ${escapeHtml((draft.sources || []).join(' · ') || 'Approved Tidepath draft')}</span></div>`).join('');
    status.textContent = 'Fill complete. Review every answer in this portal.';
    fill.disabled = true;
  });
  panel.querySelector('#tp-clear').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_APPROVED_DRAFT' }, () => {
      draft = null;
      status.textContent = 'Local approved draft cleared.';
      fill.disabled = true;
      results.innerHTML = '';
    });
  });
}

setup();
