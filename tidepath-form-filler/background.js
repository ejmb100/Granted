const DRAFT_KEY = 'approvedTidepathDraft';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'STORE_APPROVED_DRAFT') {
    chrome.storage.local.set({ [DRAFT_KEY]: { ...message.payload, savedAt: new Date().toISOString() } })
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'GET_APPROVED_DRAFT') {
    chrome.storage.local.get(DRAFT_KEY)
      .then(result => sendResponse({ ok: true, draft: result[DRAFT_KEY] || null }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'CLEAR_APPROVED_DRAFT') {
    chrome.storage.local.remove(DRAFT_KEY)
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
