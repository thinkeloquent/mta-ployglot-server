const MD_REF = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;
const MEDIA_HINT = /\.(png|jpe?g|gif|webp|mp4|mov|webm|pdf|zip|log|txt)(\?|$)|\/user-attachments\//i;

/**
 * @param {string} text
 * @returns {{ url: string, alt: string, isImage: boolean }[]}
 */
export function parseAttachmentRefs(text) {
  const out = [];
  if (!text) return out;
  for (const m of text.matchAll(MD_REF)) {
    const [, bang, alt, url] = m;
    if (!MEDIA_HINT.test(url)) continue;
    out.push({ url, alt, isImage: bang === '!' });
  }
  return out;
}
