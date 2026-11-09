/**
 * Share links: the whole song, compressed into the URL fragment. Nothing is uploaded;
 * the fragment never reaches a server. Opening the link adds the song to My songs.
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { migrateSong, type Song } from '../song/song';

/** Where share links open: the published web app, or this page when served over http(s). */
export const shareBase = () => {
  const configured = import.meta.env.VITE_PUBLIC_URL as string | undefined;
  if (configured) return configured;
  return location.protocol.startsWith('http') ? `${location.origin}${location.pathname}` : 'https://jb-612.github.io/guitar-cords/';
};

export const songToLink = (song: Song, base = shareBase()) => `${base.split('#')[0]}#song=${compressToEncodedURIComponent(JSON.stringify(song))}`;

function unpack(packed: string): Song | null {
  try {
    return migrateSong(JSON.parse(decompressFromEncodedURIComponent(packed) ?? ''));
  } catch {
    return null;
  }
}

/** The song in a share link (with a fresh id), or null. */
export function songFromLink(url: string): Song | null {
  const packed = /#song=([^&]+)/.exec(url)?.[1];
  const song = packed ? unpack(packed) : null;
  return song && { ...song, id: crypto.randomUUID(), updatedAt: Date.now() };
}
