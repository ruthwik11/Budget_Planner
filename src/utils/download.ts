/** Trigger a client-side file download from in-memory content (Blob URL, revoked after use). */
export function downloadFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const safeName = filename.replace(/[^\w.\- ]+/g, '_');
  const blob = new Blob([mime.startsWith('text/csv') ? '﻿' + content : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read a user-selected file as text with a size cap (default 5 MB). */
export function readFileText(file: File, maxBytes = 5 * 1024 * 1024): Promise<string> {
  if (file.size > maxBytes) return Promise.reject(new Error('File is larger than 5 MB.'));
  return file.text();
}
