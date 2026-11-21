'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { AsarArchive } = require('./asar.cjs');
const marker = '__ANTIGRAVITY_MAKOTO_MOTION__';
const quit = '--antigravity-makoto-quit';

function unique(source, anchor, replacement) {
  if (!source.includes(anchor) || source.indexOf(anchor) !== source.lastIndexOf(anchor)) {
    throw Error('Antigravity theme integration point has changed: ' + anchor);
  }
  return source.replace(anchor, () => replacement);
}

function uniqueMatch(source, anchor, regex, buildReplacement) {
  if (source.includes(anchor) && source.indexOf(anchor) === source.lastIndexOf(anchor)) {
    return source.replace(anchor, () => buildReplacement(anchor));
  }
  const matches = [...source.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g'))];
  if (matches.length !== 1) throw Error('Antigravity theme integration point has changed: ' + anchor);
  return source.replace(regex, m => buildReplacement(m));
}

const windowHookBlock = [
  ';try {',
  "  if (process.platform === 'win32') {",
  '    const _fs = require("node:fs"), _path = require("node:path"), _local = process.env.LOCALAPPDATA || "";',
  '    for (const _base of [_path.join(_local, "Programs", "AntigravityMakotoMotion"), _path.join(_local, "Programs", "AntigravityChineseAuto", "makoto-motion")]) {',
  '      if (_fs.existsSync(_path.join(_base, "enabled"))) {',
  '        const _we = _fs.existsSync(_path.join(_base, "window-events.cjs")) ? _path.join(_base, "window-events.cjs") : _path.join(_base, "theme", "window-events.cjs");',
  '        if (_fs.existsSync(_we)) { require(_we).watchHubWindows(electron_1.app, require("electron")); break; }',
  '      }',
  '    }',
  '  }',
  '} catch (_err) { console.warn("[Makoto] Window hook:", _err.message); }'
].join('\n');

function applyMakoto(archive, { livePath } = {}) {
  const defaultLive = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'antigravity', 'resources', 'app.asar');
  const guardLive = livePath || defaultLive;
  if (fs.existsSync(guardLive) && fs.realpathSync(archive).toLowerCase() === fs.realpathSync(guardLive).toLowerCase()) {
    throw Error('Expected a staged archive');
  }
  const main = AsarArchive.readFile(archive, 'dist/main.js').toString();
  const preload = AsarArchive.readFile(archive, 'dist/preload.js').toString();
  if (preload.includes(marker) && main.includes(quit)) return;
  if (!preload.includes('electron') ||
      preload.includes('__ANTIGRAVITY_WALLPAPER_START__') || main.includes(quit) || preload.includes(marker)) {
    throw Error('Expected a clean Antigravity archive');
  }
  const css = ['makoto.css', 'motion.css', 'pages.css'].map(name => fs.readFileSync(path.join(__dirname, name), 'utf8')).join('\n')
    .replace(/url\(makoto:([a-z-]+)\)/g, (_, name) => {
      const image = fs.readFileSync(path.join(__dirname, 'art', name + '.webp'));
      return 'url("data:image/webp;base64,' + image.toString('base64') + '")';
    });
  const clip = fs.readFileSync(path.join(__dirname, 'art', 'portrait-idle.webm')).toString('base64');
  const withClip = unique(fs.readFileSync(path.join(__dirname, 'renderer.js'), 'utf8'),
    '/* MAKOTO_PORTRAIT */', JSON.stringify('data:video/webm;base64,' + clip));
  const renderer = unique(withClip, '/* MAKOTO_CSS */', JSON.stringify(css));
  const secondary = "electron_1.app.on('second-instance', (_event, commandLine) => {";
  const withLock = uniqueMatch(
    main,
    'if (!gotTheLock) {',
    /if\s*\(\s*!gotTheLock\s*\)\s*\{/,
    () => 'if (!gotTheLock || process.argv.includes(' + JSON.stringify(quit) + ')) {'
  );
  const updatedMain = uniqueMatch(
    withLock,
    secondary,
    /electron_1\.app\.on\(\s*['"]second-instance['"]\s*,\s*\([^)]*\)\s*=>\s*\{/,
    matched => {
      const argName = /\(\s*[^,]+,\s*([A-Za-z_$][\w$]*)[^)]*\)\s*=>\s*\{/.exec(matched)?.[1] || 'commandLine';
      return windowHookBlock + '\n' + matched + '\n    if (' + argName + '.includes(' + JSON.stringify(quit) + ')) { electron_1.app.quit(); return; }';
    }
  );
  const edits = { 'dist/main.js': updatedMain, 'dist/preload.js': preload + '\n;' + JSON.stringify(marker) + ';\n' + renderer };
  for (const [filename, source] of Object.entries(edits)) new vm.Script(source, { filename });
  const tmp = archive + '.makoto.tmp';
  try { AsarArchive.patchArchive(archive, tmp, edits); fs.renameSync(tmp, archive); }
  finally { fs.rmSync(tmp, { force: true }); }
}
module.exports = { applyMakoto, marker };
