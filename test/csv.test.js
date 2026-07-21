import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../lib/csv.js';

describe('parseCSV()', () => {
  it('parses a simple header + rows', () => {
    const rows = parseCSV('task_id,lang,answer\ncoin-flip,en,heads\ncoin-flip,en,tails');
    assert.deepEqual(rows, [
      ['task_id', 'lang', 'answer'],
      ['coin-flip', 'en', 'heads'],
      ['coin-flip', 'en', 'tails'],
    ]);
  });

  it('handles quoted fields with embedded commas', () => {
    const rows = parseCSV('a,b,c\n"1,2",x,"y,z"');
    assert.deepEqual(rows, [
      ['a', 'b', 'c'],
      ['1,2', 'x', 'y,z'],
    ]);
  });

  it('handles doubled quotes as escape', () => {
    const rows = parseCSV('a,b\n"she said ""hi""",world');
    assert.deepEqual(rows, [['a', 'b'], ['she said "hi"', 'world']]);
  });

  it('handles CRLF line endings', () => {
    const rows = parseCSV('a,b\r\n1,2\r\n3,4');
    assert.deepEqual(rows, [['a', 'b'], ['1', '2'], ['3', '4']]);
  });

  it('handles newlines inside quoted fields', () => {
    const rows = parseCSV('a,b\n"line1\nline2",x');
    assert.deepEqual(rows, [['a', 'b'], ['line1\nline2', 'x']]);
  });

  it('preserves Unicode content (CJK, Arabic)', () => {
    const rows = parseCSV('task_id,lang,answer\ncolor-favorite,zh,蓝色\ncolor-favorite,ar,أزرق');
    assert.deepEqual(rows[1], ['color-favorite', 'zh', '蓝色']);
    assert.deepEqual(rows[2], ['color-favorite', 'ar', 'أزرق']);
  });

  it('drops a lone trailing newline', () => {
    const rows = parseCSV('a,b\n1,2\n');
    assert.deepEqual(rows, [['a', 'b'], ['1', '2']]);
  });
});
