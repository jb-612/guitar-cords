// Runs the packaged app (release/) in self-test mode and reports PASS/FAIL.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const candidates = {
  darwin: ['release/mac-arm64/Guitar Cords.app/Contents/MacOS/Guitar Cords', 'release/mac/Guitar Cords.app/Contents/MacOS/Guitar Cords'],
  win32: ['release/win-unpacked/Guitar Cords.exe'],
  linux: ['release/linux-unpacked/guitar-cords'],
}[process.platform] ?? [];
const binary = candidates.find(existsSync);
if (!binary) {
  console.error('No packaged app found in release/. Run `npm run dist` first.');
  process.exit(1);
}
const out = execFileSync(binary, [], { env: { ...process.env, GC_SELFTEST: '1' }, encoding: 'utf8', timeout: 90_000 });
const line = out.split('\n').find((l) => l.startsWith('SELFTEST'));
console.log(line ?? out);
process.exit(line?.includes('PASS') ? 0 : 1);
