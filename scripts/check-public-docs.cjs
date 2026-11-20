#!/usr/bin/env node
'use strict';

// Lightweight, dependency-free integrity check for the public documentation.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = ['README.md', 'DEMO.md', 'docs/STAGE9_12_RELEASE_READINESS.md'];

function findBrokenLinks(markdown, filePath, repoRoot = root) {
  const broken = [];
  // Local Markdown links only. External links, anchors and mailto: are excluded.
  const links = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(links)) {
    const target = match[1].trim().split(/\s+"/)[0].replace(/^<|>$/g, '');
    if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) continue;
    let decoded;
    try { decoded = decodeURIComponent(target.split(/[?#]/)[0]); }
    catch { broken.push(target + ' (invalid URL encoding)'); continue; }
    if (!decoded) continue;
    const full = path.resolve(repoRoot, path.dirname(filePath), decoded);
    const relative = path.relative(repoRoot, full);
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
      broken.push(target + ' (outside repository)');
    } else if (!fs.existsSync(full)) {
      broken.push(target);
    }
  }
  return broken;
}

function main() {
  let errors = 0;
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) {
      console.error('Missing required public documentation: ' + file);
      errors++;
      continue;
    }
    const broken = findBrokenLinks(fs.readFileSync(absolute, 'utf8'), file);
    for (const link of broken) {
      console.error(file + ': broken local link ' + link);
      errors++;
    }
  }
  if (errors) process.exitCode = 1;
  else console.log('Public documentation local links: OK (' + files.length + ' files)');
}

if (require.main === module) main();
module.exports = { findBrokenLinks };
