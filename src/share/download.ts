/** Save bytes or text as a file (browser download; Electron shows a save dialog). */
export function download(name: string, data: Uint8Array | string, type: string) {
  const blob = new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File-system-safe song name. */
export const fileName = (title: string) => title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'song';
