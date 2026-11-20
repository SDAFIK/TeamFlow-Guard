'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findBrokenLinks } = require('./check-public-docs.cjs');

test('finds removed submission document links', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teamflow-doclinks-'));
  try {
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'README.md'), '# Example\n');
    assert.deepEqual(
      findBrokenLinks('[old](../SUBMISSION.md) [ok](../README.md)', 'docs/report.md', root),
      ['../SUBMISSION.md']
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ignores external URLs and anchors', () => {
  assert.deepEqual(findBrokenLinks('[web](https://example.com) [section](#intro) [email](mailto:test@example.com)', 'README.md'), []);
});

test('rejects relative links escaping repository', () => {
  assert.deepEqual(findBrokenLinks('[bad](../../secret.txt)', 'docs/report.md', '/tmp/checkroot'), ['../../secret.txt (outside repository)']);
});
