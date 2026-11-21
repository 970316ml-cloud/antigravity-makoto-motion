'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

function verifyHelperBinary(exePath, shaPath) {
    try {
        if (!fs.existsSync(exePath) || !fs.existsSync(shaPath)) return false;
        const expected = fs.readFileSync(shaPath, 'utf8').trim().toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(expected)) return false;
        const actual = crypto.createHash('sha256').update(fs.readFileSync(exePath)).digest('hex');
        return actual === expected;
    } catch {
        return false;
    }
}

function revealPaintedHub(window, contents) {
    let opacity = null, paintTimer, deadline;
    let revision = 0;
    function cancel() {
        clearTimeout(paintTimer);
        clearTimeout(deadline);
        paintTimer = deadline = undefined;
        revision++;
    }
    function minimize() {
        cancel();
        if (opacity !== null) return;
        opacity = window.getOpacity();
        // Keep a drawable surface while Windows reconstructs the child views.
        window.setOpacity(Math.min(opacity, 1 / 255));
    }
    function restore() {
        if (opacity === null || deadline || window.isMinimized()) return;
        const cycle = revision;
        function reveal() {
            if (cycle !== revision || window.isDestroyed() || window.isMinimized()) return;
            cancel();
            window.setOpacity(opacity);
            opacity = null;
        }
        // A compositor readback after the native resize confirms a renderable frame.
        // A suspended or navigating renderer must still give the user their window back.
        deadline = setTimeout(reveal, 240);
        paintTimer = setTimeout(() => {
            if (!contents.isDestroyed()) {
                contents.capturePage({x: 0, y: 0, width: 1, height: 1}, {stayHidden: true}).then(reveal, () => {});
            }
        }, 95);
    }
    window.on('minimize', minimize);
    window.on('restore', restore);
    window.on('maximize', restore);
    window.on('show', restore);
    window.once('closed', cancel);
}

function watchHubWindows(app, { BaseWindow, webContents }) {
    if (globalThis.__makotoWindowEventsAttached) return;
    globalThis.__makotoWindowEventsAttached = true;
    const applied = new WeakSet();
    function match(contents) {
        if (contents.isDestroyed() || !contents.getURL().startsWith('https://127.0.0.1:')) return false;
        const window = BaseWindow.getAllWindows().find(win =>
            !win.isDestroyed() && win.contentView.children.some(view => view.webContents === contents));
        if (!window) return false;
        if (!applied.has(window)) {
            const native = window.getNativeWindowHandle();
            const hwnd = native.length === 8 ? native.readBigUInt64LE() : native.readUInt32LE();
            applied.add(window);
            revealPaintedHub(window, contents);
            const helperExe = path.join(__dirname, 'WindowTransitions.exe');
            const helperSha = path.join(__dirname, 'WindowTransitions.sha256');
            if (!verifyHelperBinary(helperExe, helperSha)) {
                console.warn('[Makoto] Window transition helper skipped (missing or SHA-256 mismatch):', helperExe);
            } else {
                execFile(helperExe, [String(hwnd), String(process.pid)],
                    { windowsHide: true }, err => { if (err) console.warn('[Makoto] Window transition:', err.message); });
            }
        }
        return true;
    }
    function observe(contents) {
        if (match(contents)) return;
        const ready = () => { if (match(contents)) contents.off('dom-ready', ready); };
        contents.on('dom-ready', ready);
    }
    app.on('web-contents-created', (_event, contents) => observe(contents));
    app.whenReady().then(() => webContents.getAllWebContents().forEach(observe));
}
module.exports = { watchHubWindows, verifyHelperBinary };
