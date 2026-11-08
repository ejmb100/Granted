// Receives a staff-approved draft from Tidepath and stores it locally in the
// user's browser. No organization data is sent to a third party by this code.
window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== 'https://tidepath-grant-assistant.vercel.app') return;
  if (event.data?.type !== 'TIDEPATH_APPROVED_DRAFT') return;
  chrome.runtime.sendMessage({ type: 'STORE_APPROVED_DRAFT', payload: event.data.payload });
});
