'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { AsarArchive } = require('./theme/asar.cjs');
const { applyMakoto, marker } = require('./theme/patch.cjs');

const [operation, stage, installDirArg, storageDirArg] = process.argv.slice(2);
if (!['install', 'restore'].includes(operation) || !stage || !fs.statSync(stage).isDirectory()) {
  throw Error('Expected install/restore and a staging directory');
}

const installDir = installDirArg ? path.resolve(installDirArg) : path.join(process.env.LOCALAPPDATA || '', 'Programs', 'antigravity');
const live = path.join(installDir, 'resources', 'app.asar');
const liveBak = path.join(installDir, 'resources', 'app.asar.bak');
const defaultChineseState = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AntigravityChineseAuto');
const hasChineseAuto = !storageDirArg &&
  fs.existsSync(path.join(defaultChineseState, 'maintain.cjs')) &&
  fs.existsSync(path.join(defaultChineseState, 'update-hook.cjs'));
const mode = hasChineseAuto ? 'chinese-auto' : 'standalone';
const state = storageDirArg
  ? path.resolve(storageDirArg)
  : (hasChineseAuto ? defaultChineseState : path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AntigravityMakotoMotion'));

const read = (file, entry) => AsarArchive.readFile(file, entry).toString();
const version = file => JSON.parse(read(file, 'package.json')).version;
const ver = version(live);
assert.match(ver, /^\d+\.\d+\.\d+$/);

const current = read(live, 'dist/preload.js');
const oldMarker = '__ANTIGRAVITY_WALLPAPER_START__';
const legacy = current.includes(oldMarker);
const themed = current.includes(marker);
if (operation === 'restore' && !themed && legacy) throw Error('This client is still using the previous wallpaper theme');

function isCleanArchive(file) {
  if (!file || !fs.existsSync(file)) return false;
  try {
    if (version(file) !== ver) return false;
    const raw = read(file, 'dist/preload.js');
    return raw.includes('const isRemoteWindow = process.argv') && !raw.includes(oldMarker) && !raw.includes(marker);
  } catch {
    return false;
  }
}

const candidates = [];
if (mode === 'chinese-auto') {
  if (legacy) candidates.push(path.join(state, 'wallpaper', 'backups', ver, 'app.asar'));
  candidates.push(path.join(state, 'makoto-motion', 'backups', ver, 'app.asar'));
} else {
  candidates.push(path.join(state, 'backups', ver, 'app.asar'));
}
if (!themed && !legacy) candidates.push(live);
candidates.push(liveBak);

const pure = candidates.find(isCleanArchive);
if (!pure) throw Error(`Could not find a clean base app.asar for version ${ver}`);

const raw = read(pure, 'dist/preload.js');
assert.equal(version(pure), ver);
if (raw.includes('__ANTIGRAVITY_CHINESE_LOCALIZATION_START__')) {
  assert.ok(read(pure, 'dist/updater.js').includes('__ANTIGRAVITY_CHINESE_UPDATE_START__'));
}

const moduleDir = path.join(stage, 'makoto-motion');
fs.cpSync(path.join(__dirname, 'theme'), moduleDir, { recursive: true });
if (mode === 'chinese-auto') {
  for (const name of ['wallpaper', 'makoto-motion']) {
    const oldBackups = path.join(state, name, 'backups');
    if (fs.existsSync(oldBackups)) fs.cpSync(oldBackups, path.join(moduleDir, 'backups'), { recursive: true });
  }
} else {
  const existingBackups = path.join(state, 'backups');
  if (fs.existsSync(existingBackups)) fs.cpSync(existingBackups, path.join(moduleDir, 'backups'), { recursive: true });
}

const backup = path.join(moduleDir, 'backups', ver, 'app.asar');
fs.mkdirSync(path.dirname(backup), { recursive: true });
fs.copyFileSync(pure, backup);

const candidate = path.join(stage, 'app.asar');
fs.copyFileSync(pure, candidate);
if (operation === 'install') {
  applyMakoto(candidate, { livePath: live });
  fs.writeFileSync(path.join(moduleDir, 'enabled'), '1\n');
}

const final = read(candidate, 'dist/preload.js');
assert.equal(final.includes(marker), operation === 'install');
assert.equal(version(candidate), ver);
for (const key of ['dist/main.js', 'dist/preload.js', 'dist/customScheme.js']) {
  const data = read(candidate, key);
  for (const signature of [oldMarker, 'agy-wallpaper-workshop', 'createWallpaperLibraryPanel', 'antigravity-wallpaper:', 'loadWallpaperSceneEngine']) {
    assert.ok(!data.includes(signature), key + ' contains ' + signature);
  }
}
for (const key of ['dist/updater.js', 'dist/customScheme.js']) {
  assert.ok(AsarArchive.readFile(candidate, key).equals(AsarArchive.readFile(pure, key)));
}

if (mode === 'chinese-auto') {
  let maintenance = fs.readFileSync(path.join(state, 'maintain.cjs'), 'utf8');
  if (maintenance.includes('function installWallpaperExtension(')) {
    const begin = maintenance.indexOf('const WALLPAPER_MARKER =');
    const end = maintenance.indexOf('function inspect(archive)', begin);
    if (begin < 0 || end < 0) throw Error('Unexpected maintenance layout');
    maintenance = maintenance.slice(0, begin) + fs.readFileSync(path.join(__dirname, 'update-extension.txt'), 'utf8') + '\n\n' + maintenance.slice(end);
    maintenance = maintenance.replaceAll('installWallpaperExtension(', 'installMakotoExtension(')
      .replace('wallpaper: preload.includes(WALLPAPER_MARKER)', 'makotoMotion: preload.includes(MAKOTO_MARKER)')
      .replaceAll('wallpaper: info.wallpaper', 'makotoMotion: info.makotoMotion')
      .replaceAll('wallpaper: inspect(archive).wallpaper', 'makotoMotion: inspect(archive).makotoMotion');
  }
  assert.ok(maintenance.includes('installMakotoExtension(candidate, sourceInfo.version)') && maintenance.includes('makotoMotion: preload.includes(MAKOTO_MARKER)') && !maintenance.includes('installWallpaperExtension'));
  new vm.Script(maintenance, { filename: 'maintain.cjs' });
  fs.writeFileSync(path.join(stage, 'maintain.cjs'), maintenance);
  const { windowHook } = require('./window-hook.cjs');
  const currentHook = fs.readFileSync(path.join(state, 'update-hook.cjs'), 'utf8');
  fs.writeFileSync(path.join(stage, 'update-hook.cjs'), windowHook(currentHook, operation === 'install'));
}

console.log(JSON.stringify({
  version: ver,
  mode,
  hasMaintenance: mode === 'chinese-auto',
  quit: legacy ? '--antigravity-wallpaper-quit' : themed ? '--antigravity-makoto-quit' : null
}));
