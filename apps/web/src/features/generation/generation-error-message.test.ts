import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { generationErrorMessage } from './generation-error-message';

test('empty and whitespace exceptions have localized nonempty feedback', () => {
  for (const error of [new Error(''), new Error('  \n'), null, undefined, {}]) {
    assert.equal(generationErrorMessage(error, true), '生成请求失败，请稍后重试。');
    assert.equal(generationErrorMessage(error, false), 'Generation request failed. Please try again.');
  }
  assert.equal(generationErrorMessage(new Error(' Service unavailable '), true), 'Service unavailable');
});

test('new submission dismisses stale toast and empty messages cannot render', () => {
  const composer = readFileSync(new URL('./components/canvas-composer.tsx', import.meta.url), 'utf8');
  assert.match(composer, /setNotice\(0\); setErrorMessage\(""\)/);
  assert.match(composer, /notice > 0 && errorMessage\.trim\(\)/);
  const toast = readFileSync(new URL('../../components/ui/toast.tsx', import.meta.url), 'utf8');
  assert.match(toast, /!visible \|\| !message\?\.trim\(\)/);
});
