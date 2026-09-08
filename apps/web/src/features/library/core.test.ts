import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalog, filterCatalog, renderSvg, styles, validateVariant, defaultAppearance, normalizeAppearance } from './core';

test('192 development designs contain six real validated variants', () => {
  assert.equal(catalog.length, 192);
  for (const item of catalog) {
    assert.equal(item.status, 'development-sample');
    const variants = JSON.parse(readFileSync(new URL(`../../../public${item.url}`, import.meta.url), 'utf8'));
    for (const style of styles) {
      assert.ok(item.styles.includes(style));
      const variant = validateVariant(variants[style]);
      assert.equal(variant.supportsStroke, false);
      const svg = renderSvg(variant, defaultAppearance);
      assert.ok(svg.includes('<path'));
      assert.ok(!svg.includes('currentColor'));
    }
  }
});
test('search works with Chinese and English, scoped by category', () => {
  assert.equal(filterCatalog('钥匙', '').length, 1);
  assert.equal(filterCatalog('KEY', 'essential').length, 1);
  assert.equal(filterCatalog('KEY', 'food').length, 0);
});
test('unsafe data is rejected instead of injected', () => {
  for (const path of [{d:'M0 0',onclick:'alert(1)'}, {d:'M0 0',fill:'url(https://evil)'}, {d:'<script>'}]) {
    assert.throws(() => validateVariant({viewBox:'0 0 24 24',paths:[path]}));
  }
});
test('appearance clamps sizes and preserves none/opacity during gradient export', () => {
  const input = {viewBox:'0 0 24 24', supportsStroke:false, paths:[{d:'M1 1L2 2',fill:'none',stroke:'currentColor',opacity:'0.4'}]};
  const svg = renderSvg(input, {...defaultAppearance,size:128,mode:'linear',angle:45});
  assert.match(svg,/width="128"/); assert.match(svg,/fill="none"/); assert.match(svg,/opacity="0.4"/); assert.match(svg,/stroke="url\(#paint\)"/);
  for (const size of [256,512,9999]) assert.equal(normalizeAppearance({...defaultAppearance,size}).size,128);
});
