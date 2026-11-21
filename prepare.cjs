'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { AsarArchive } = require('./theme/asar.cjs');
const { applyMakoto, marker } = require('./theme/patch.cjs');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const [operation, stage, installDirArg, storageDirArg] = process.argv.slice(2);
if (!['install', 'restore'].includes(operation) || !stage || !fs.statSync(stage).isDirectory()) {
  throw Error('Expected install/restore and a staging directory');
}

const installDir = installDirArg ? path.resolve(installDirArg) : path.join(process.env.LOCALAPPDATA || '', 'Programs', 'antigravity');
const normalizedInstall = path.resolve(installDir).replace(/[\\/]+$/, '');
const installKey = crypto.createHash('sha256').update(normalizedInstall.toLowerCase()).digest('hex').slice(0, 12);
const live = path.join(normalizedInstall, 'resources', 'app.asar');
const defaultChineseState = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AntigravityChineseAuto');
const defaultManagedInstall = path.resolve(process.env.LOCALAPPDATA || '', 'Programs', 'antigravity').replace(/[\\/]+$/, '');
const hasChineseAuto = !storageDirArg &&
  normalizedInstall.toLowerCase() === defaultManagedInstall.toLowerCase() &&
  fs.existsSync(path.join(defaultChineseState, 'maintain.cjs')) &&
  fs.existsSync(path.join(defaultChineseState, 'update-hook.cjs'));
const mode = hasChineseAuto ? 'chinese-auto' : 'standalone';
const state = storageDirArg
  ? path.resolve(storageDirArg)
  : (hasChineseAuto ? defaultChineseState : path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AntigravityMakotoMotion'));
const makotoDataDir = mode === 'chinese-auto' ? path.join(state, 'makoto-motion') : state;

const read = (file, entry) => AsarArchive.readFile(file, entry).toString();
const version = file => JSON.parse(read(file, 'package.json')).version;
const ver = version(live);
assert.match(ver, /^\d+\.\d+\.\d+$/);

const liveSha256 = sha256File(live);
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
    return raw.includes('electron') && !raw.includes(oldMarker) && !raw.includes(marker);
  } catch {
    return false;
  }
}

const installsDir = path.join(makotoDataDir, 'installs');
const manifestFile = path.join(installsDir, `${installKey}.json`);
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;

let pure = null;
let baseSha256 = null;
if (!themed && !legacy) {
  if (operation === 'restore') {
    throw Error('当前客户端未检测到结城理主题，无需恢复（未修改 app.asar）。');
  }
  pure = live;
  baseSha256 = liveSha256;
} else if (themed) {
  if (manifest) {
    if (manifest.version !== ver) {
      throw Error(`安装记录版本 (${manifest.version}) 与当前客户端版本 (${ver}) 不匹配，已停止以避免使用错配备份。`);
    }
    if (!manifest.installDir || manifest.installDir.toLowerCase() !== normalizedInstall.toLowerCase()) {
      throw Error('安装记录中的安装目录与当前目标不一致，已停止。');
    }
    if (manifest.themedSha256 && manifest.themedSha256 !== liveSha256) {
      throw Error('检测到当前 app.asar 在主题安装后已被第三方补丁修改，无法在不覆盖新补丁的前提下自动分离旧主题。请先恢复或重新应用干净的原版/社区汉化基底，再运行本安装器。');
    }
    if (!manifest.baseBackupRel || !manifest.baseSha256) {
      throw Error('安装记录缺少基底备份路径或校验摘要，已停止。');
    }
    const boundBackup = path.resolve(makotoDataDir, manifest.baseBackupRel);
    if (!fs.existsSync(boundBackup)) {
      throw Error(`未找到与当前客户端绑定的基底备份: ${boundBackup}`);
    }
    if (sha256File(boundBackup) !== manifest.baseSha256) {
      throw Error(`基底备份 SHA-256 校验失败: ${boundBackup}`);
    }
    if (!isCleanArchive(boundBackup)) {
      throw Error(`绑定的基底备份未通过干净归档验证: ${boundBackup}`);
    }
    pure = boundBackup;
    baseSha256 = manifest.baseSha256;
  } else {
    const hasOtherManifests = fs.existsSync(installsDir) &&
      fs.readdirSync(installsDir).some(name => name.endsWith('.json') && name !== `${installKey}.json`);
    if (hasOtherManifests) {
      throw Error(`未找到 ${normalizedInstall} 对应的安装记录，且维护目录已由其他安装实例使用；拒绝猜测旧备份。`);
    }
    const legacyOwnBackup = path.join(makotoDataDir, 'backups', ver, 'app.asar');
    if (!isCleanArchive(legacyOwnBackup)) {
      throw Error(`未找到与当前客户端绑定的干净基底备份（版本 ${ver}）；为防止错配恢复，已禁止自动猜测 resources\\app.asar.bak。`);
    }
    pure = legacyOwnBackup;
    baseSha256 = sha256File(legacyOwnBackup);
  }
} else if (legacy) {
  const wallBackup = mode === 'chinese-auto' ? path.join(state, 'wallpaper', 'backups', ver, 'app.asar') : null;
  if (!isCleanArchive(wallBackup)) {
    throw Error(`未找到旧版壁纸主题对应的干净基底备份 (${ver})，请先恢复干净客户端。`);
  }
  pure = wallBackup;
  baseSha256 = sha256File(wallBackup);
}

const raw = read(pure, 'dist/preload.js');
assert.equal(version(pure), ver);
if (mode === 'chinese-auto' && raw.includes('__ANTIGRAVITY_CHINESE_LOCALIZATION_START__')) {
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
if (fs.existsSync(installsDir)) {
  fs.cpSync(installsDir, path.join(moduleDir, 'installs'), { recursive: true });
}

const baseBackupRel = path.posix.join('backups', installKey, ver, baseSha256.slice(0, 16), 'app.asar');
const backup = path.join(moduleDir, baseBackupRel);
fs.mkdirSync(path.dirname(backup), { recursive: true });
if (fs.existsSync(backup)) {
  if (sha256File(backup) !== baseSha256) {
    throw Error(`检测到备份内容不一致 (${backup})，拒绝静默覆盖已有基底。`);
  }
} else {
  fs.copyFileSync(pure, backup, fs.constants.COPYFILE_EXCL);
}

const candidate = path.join(stage, 'app.asar');
fs.copyFileSync(pure, candidate);
if (operation === 'install') {
  applyMakoto(candidate, { livePath: live });
}
const candidateSha256 = sha256File(candidate);

const stageInstallsDir = path.join(moduleDir, 'installs');
const stageManifestFile = path.join(stageInstallsDir, `${installKey}.json`);
if (operation === 'install') {
  fs.mkdirSync(stageInstallsDir, { recursive: true });
  fs.writeFileSync(stageManifestFile, JSON.stringify({
    installDir: normalizedInstall,
    installKey,
    version: ver,
    mode,
    baseSha256,
    baseBackupRel,
    themedSha256: candidateSha256,
    updatedAt: new Date().toISOString()
  }, null, 2) + '\n');
} else {
  fs.rmSync(stageManifestFile, { force: true });
}

const enabledFile = path.join(moduleDir, 'enabled');
if (mode === 'standalone') {
  const hasAnyActiveInstall = fs.existsSync(stageInstallsDir) &&
    fs.readdirSync(stageInstallsDir).some(name => name.endsWith('.json'));
  if (hasAnyActiveInstall) fs.writeFileSync(enabledFile, '1\n');
  else fs.rmSync(enabledFile, { force: true });
} else {
  if (operation === 'install') fs.writeFileSync(enabledFile, '1\n');
  else fs.rmSync(enabledFile, { force: true });
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
  const extBegin = maintenance.includes('const WALLPAPER_MARKER =')
    ? maintenance.indexOf('const WALLPAPER_MARKER =')
    : maintenance.indexOf('const MAKOTO_MARKER =');
  const extEnd = extBegin >= 0 ? maintenance.indexOf('function inspect(archive)', extBegin) : -1;
  if (extBegin < 0 || extEnd < 0) throw Error('Unexpected maintenance layout');
  maintenance = maintenance.slice(0, extBegin) + fs.readFileSync(path.join(__dirname, 'update-extension.txt'), 'utf8') + '\n\n' + maintenance.slice(extEnd);
  if (maintenance.includes('installWallpaperExtension')) {
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
  installDir: normalizedInstall,
  installKey,
  sourceSha256: liveSha256,
  baseSha256,
  candidateSha256,
  quit: legacy ? '--antigravity-wallpaper-quit' : themed ? '--antigravity-makoto-quit' : null
}));
