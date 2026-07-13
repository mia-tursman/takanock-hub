// Shared helpers used by ChatInterface / ITChat / GISChat / AutomationChat.
// Ported from the vanilla index.html <script> block — same behavior, just
// broken out so it isn't duplicated across every chat component.

// Escape first so raw text can never be interpreted as HTML, then apply a
// small set of markdown conversions on top of the escaped text. Implemented
// as a plain string replace (rather than the original div.textContent trick)
// so it also works during server-side rendering, where document is undefined.
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderMarkdownLite(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
  return html;
}

// Prompts instruct the model to never use markdown, but this strips any
// that leaks through anyway — plain text, no bold/italic/code styling.
export function stripMarkdownForDisplay(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^*]+?)\*\*/g, '$1');
  html = html.replace(/\*([^*]+?)\*/g, '$1');
  html = html.replace(/`([^`]+?)`/g, '$1');
  return html;
}

export function extractReplyText(data) {
  if (!data) return "Sorry, I didn't get a response. Please try again.";
  if (typeof data === 'string') return data;
  if (data.error) {
    const errType = (data.error && data.error.type) || '';
    const errMsg = (data.error && data.error.message) || String(data.error);
    if (errType === 'overloaded_error' || /overloaded/i.test(errMsg)) {
      return "I'm a little overwhelmed right now — please try again in a moment.";
    }
    return 'Error: ' + errMsg;
  }
  if (Array.isArray(data.content)) {
    const text = data.content.filter((c) => c.type === 'text')
      .map((c) => c.text).join('\n').trim();
    return text || "I wasn't able to generate a response.";
  }
  if (data.reply) return data.reply;
  if (data.message) return data.message;
  return "I wasn't able to generate a response.";
}

// Grows a chat input textarea with its content, capped at ~3 lines — reset
// to auto first so shrinking (e.g. after clearing on send) works.
export const TEXTAREA_MAX_HEIGHT = 72;
export function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  const newHeight = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT);
  el.style.height = newHeight + 'px';
  el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
}
