'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/** Minimal zero-dependency ASAR reader and patcher compatible with Electron archives. */
class AsarArchive {
  static align4(n) {
    return (n + 3) & ~3;
  }

  static readHeader(asarPath) {
    const fd = fs.openSync(asarPath, 'r');
    try {
      const sizeBuf = Buffer.alloc(8);
      fs.readSync(fd, sizeBuf, 0, 8, 0);
      const headerSize = sizeBuf.readUInt32LE(4);
      const headerBuf = Buffer.alloc(headerSize);
      fs.readSync(fd, headerBuf, 0, headerSize, 8);
      const jsonLen = headerBuf.readUInt32LE(4);
      const jsonStr = headerBuf.subarray(8, 8 + jsonLen).toString('utf8');
      return { header: JSON.parse(jsonStr), baseOffset: 8 + headerSize, headerSize, jsonLen };
    } finally {
      fs.closeSync(fd);
    }
  }

  static createHeaderBuffer(headerJson) {
    const jsonBuf = Buffer.from(headerJson, 'utf8');
    const jsonLen = jsonBuf.length;
    const headerPayloadSize = 4 + this.align4(jsonLen);
    const headerBuf = Buffer.alloc(4 + headerPayloadSize);
    headerBuf.writeUInt32LE(headerPayloadSize, 0);
    headerBuf.writeUInt32LE(jsonLen, 4);
    jsonBuf.copy(headerBuf, 8);
    const sizeBuf = Buffer.alloc(8);
    sizeBuf.writeUInt32LE(4, 0);
    sizeBuf.writeUInt32LE(headerBuf.length, 4);
    return Buffer.concat([sizeBuf, headerBuf]);
  }

  static readFile(sourceAsar, relPath) {
    const { header, baseOffset } = this.readHeader(sourceAsar);
    const parts = relPath.replace(/\\/g, '/').split('/');
    let cur = header.files;
    for (const part of parts) {
      if (!cur || !cur[part]) return null;
      cur = cur[part].files ? cur[part].files : cur[part];
    }
    if (cur.unpacked) {
      const unpackedPath = path.join(`${sourceAsar}.unpacked`, ...parts);
      return fs.existsSync(unpackedPath) ? fs.readFileSync(unpackedPath) : null;
    }
    if (cur.offset === undefined || cur.size === undefined) return null;
    const fd = fs.openSync(sourceAsar, 'r');
    try {
      const buf = Buffer.alloc(cur.size);
      fs.readSync(fd, buf, 0, cur.size, baseOffset + Number(cur.offset));
      return buf;
    } finally {
      fs.closeSync(fd);
    }
  }

  static patchArchive(sourceAsar, targetAsar, filePatches) {
    const { header, baseOffset } = this.readHeader(sourceAsar);
    const srcFd = fs.openSync(sourceAsar, 'r');
    let destFd = null;
    try {
      const packedFiles = [];
      function walk(dir, prefix) {
        for (const [name, entry] of Object.entries(dir)) {
          const full = prefix ? `${prefix}/${name}` : name;
          if (entry.files) walk(entry.files, full);
          else if (!entry.unpacked && entry.offset !== undefined) packedFiles.push({ path: full, entry });
        }
      }
      walk(header.files, '');
      packedFiles.sort((a, b) => Number(BigInt(a.entry.offset) - BigInt(b.entry.offset)));

      const matched = new Set();
      for (const item of packedFiles) {
        item.oldOffset = Number(item.entry.offset);
        item.oldSize = item.entry.size;
        const patch = filePatches[item.path];
        if (patch !== undefined && patch !== null) {
          matched.add(item.path);
          const patchBuf = Buffer.isBuffer(patch) ? patch : Buffer.from(patch, 'utf8');
          item.patchBuffer = patchBuf;
          item.entry.size = patchBuf.length;
          if (item.entry.integrity) {
            const blockSize = item.entry.integrity.blockSize || 4194304;
            const blocks = [];
            for (let start = 0; start < patchBuf.length; start += blockSize) {
              blocks.push(crypto.createHash('sha256').update(patchBuf.subarray(start, start + blockSize)).digest('hex'));
            }
            item.entry.integrity = {
              algorithm: 'SHA256',
              hash: crypto.createHash('sha256').update(patchBuf).digest('hex'),
              blockSize,
              blocks
            };
          }
        }
      }
      for (const key of Object.keys(filePatches)) {
        if (filePatches[key] != null && !matched.has(key)) {
          throw new Error(`ASAR patch target not found: ${key}`);
        }
      }

      let offset = 0n;
      for (const item of packedFiles) {
        item.entry.offset = offset.toString();
        offset += BigInt(item.entry.size);
      }

      const newHeaderBuf = this.createHeaderBuffer(JSON.stringify(header));
      destFd = fs.openSync(targetAsar, 'w');
      fs.writeSync(destFd, newHeaderBuf, 0, newHeaderBuf.length, 0);

      let writePos = newHeaderBuf.length;
      const chunk = Buffer.alloc(256 * 1024);
      for (const item of packedFiles) {
        if (item.patchBuffer) {
          fs.writeSync(destFd, item.patchBuffer, 0, item.patchBuffer.length, writePos);
          writePos += item.patchBuffer.length;
        } else {
          let remaining = item.oldSize;
          let readPos = baseOffset + item.oldOffset;
          while (remaining > 0) {
            const n = Math.min(remaining, chunk.length);
            fs.readSync(srcFd, chunk, 0, n, readPos);
            fs.writeSync(destFd, chunk, 0, n, writePos);
            readPos += n;
            writePos += n;
            remaining -= n;
          }
        }
      }
    } finally {
      if (srcFd !== null) fs.closeSync(srcFd);
      if (destFd !== null) fs.closeSync(destFd);
    }
  }
}

module.exports = { AsarArchive };
