import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/processor.mjs';

test('the shared processor parses frontmatter and all three directive forms', () => {
  const tree = parse('---\ntitle: x\n---\n\n:::tldr\nA :verdict[ok]{tone=go}.\n:::\n\n::leaf\n\n::::cards\n:::card{title="Pros"}\nx\n:::\n::::\n');
  assert.deepEqual(tree.children.map((n) => [n.type, n.name]), [
    ['yaml', undefined], ['containerDirective', 'tldr'], ['leafDirective', 'leaf'], ['containerDirective', 'cards'],
  ]);
  const inline = tree.children[1].children[0].children.find((n) => n.type === 'textDirective');
  assert.deepEqual([inline.name, inline.attributes], ['verdict', { tone: 'go' }]);
  assert.deepEqual(tree.children[3].children[0].attributes, { title: 'Pros' });
});

test('CRLF and NFD input are normalised before parsing', () => {
  const tree = parse('Café\r\n');
  assert.equal(tree.children[0].children[0].value, 'Café');
});

test('a UTF-8 BOM is stripped before parsing, so source offsets stay right', async () => {
  const { normalizeInput } = await import('../src/processor.mjs');
  assert.equal(normalizeInput('﻿It is 10:30.\r\n'), 'It is 10:30.\n');
});
