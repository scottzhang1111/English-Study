const EIKEN_REAL_EXAM_ASSET_BASE = '/api/eiken-real-exams/assets/';

function encodeFileName(fileName) {
  try {
    return encodeURIComponent(decodeURIComponent(fileName));
  } catch (error) {
    return encodeURIComponent(fileName);
  }
}

export function getEikenAssetSrc(path) {
  if (!path) return null;
  const value = String(path).trim();
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  const cleanPath = value
    .split(/[?#]/)[0]
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^public\//, '')
    .replace(/^app\//, '')
    .replace(/^api\/eiken-real-exams\/assets\//, '')
    .replace(/^eiken\/audio\//, '')
    .replace(/^eiken\/images\//, '')
    .replace(/^audio\//, '')
    .replace(/^images\//, '')
    .replace(/^mp3\//, '')
    .replace(/^png\//, '');
  const fileName = cleanPath.split('/').filter(Boolean).pop();
  return fileName ? `${EIKEN_REAL_EXAM_ASSET_BASE}${encodeFileName(fileName)}` : null;
}

export function normalizeEikenMediaHtml(html = '') {
  return String(html).replace(/\b(src)=(["'])([^"']+\.(?:png|gif|jpg|jpeg|mp3|wav|m4a))(?:[?#][^"']*)?\2/gi, (match, attr, quote, value) => {
    const mediaSrc = getEikenAssetSrc(value);
    return mediaSrc ? `${attr}=${quote}${mediaSrc}${quote}` : match;
  });
}
