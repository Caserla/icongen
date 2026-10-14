import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { applyLockedSolidColor } from './solid-color';
import { validateGeneratedSvg } from './validate-generated-svg';

test('uniform foreground preserves rendered mask holes and contour coverage', async () => {
  const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><mask id="hole"><rect width="24" height="24" fill="white"/><g fill="black"><circle cx="12" cy="12" r="4"/></g></mask></defs><rect x="2" y="2" width="20" height="20" fill="#FF0000" mask="url(#hole)"/></svg>';
  const output = applyLockedSolidColor(input, '#505464');
  validateGeneratedSvg(output);
  const render = async (svg: string) => sharp(Buffer.from(svg)).resize(96, 96).ensureAlpha().raw().toBuffer();
  const before = await render(input), after = await render(output);
  assert.deepEqual([...after].filter((_, i) => i % 4 === 3), [...before].filter((_, i) => i % 4 === 3));
  assert.equal(after[(48 * 96 + 48) * 4 + 3], 0);
  assert.match(output, /fill="black"/);
  assert.match(output, /fill="#505464"/);
});

test('preserves local gradient references, filter paints, none and evenodd geometry', () => {
  const svg = '<svg viewBox="0 0 24 24"><defs><linearGradient id="paint"><stop offset="0" stop-color="#ff0000"/></linearGradient><filter id="f"><feFlood flood-color="white"/></filter></defs><path fill="url(#paint)" fill-rule="evenodd" stroke="none" d="M2 2H22V22H2Z M8 8V16H16V8Z"/></svg>';
  const output = applyLockedSolidColor(svg, '#505464');
  assert.match(output, /fill="url\(#paint\)"/);
  assert.match(output, /stop-color="#505464"/);
  assert.match(output, /flood-color="white"/);
  assert.match(output, /fill-rule="evenodd"/);
  assert.match(output, /stroke="none"/);
});
