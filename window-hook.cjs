'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function windowHook(source, enabled) {
    const anchor = 'function attachUpdater(updater, _app, options = {}) {';
    const block = [
        '    // Makoto window transitions',
        "    if (process.type === 'browser' && !updater[ATTACHED] && fs.existsSync(path.join(__dirname, 'makoto-motion', 'enabled'))) {",
        "        try { require('./makoto-motion/window-events.cjs').watchHubWindows(_app, require('electron')); }",
        "        catch (error) { console.warn('[Makoto] Window integration:', error.message); }",
        '    }',
    ].join('\n');
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const injection = eol + block.split('\n').join(eol);
    if (!source.includes(anchor) || source.indexOf(anchor)!==source.lastIndexOf(anchor)) throw Error('Antigravity update hook layout changed');
    const without = source.replace(anchor+injection, anchor);
    const result = enabled ? without.replace(anchor, () => anchor+injection) : without;
    new vm.Script(result,{filename:'update-hook.cjs'});
    return result;
}
module.exports = { windowHook };
