import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, LANG, normalize } from '../lib/tasks.js';

describe('TASKS', () => {
  it('has 15 probing tasks', () => {
    assert.equal(TASKS.length, 15);
  });

  it('each task has a task_id, prompts, and label', () => {
    for (const t of TASKS) {
      assert.ok(typeof t.task_id === 'string' && t.task_id.length > 0);
      assert.ok(typeof t.prompts === 'object');
      assert.ok(typeof t.label === 'string');
    }
  });

  it('each task has prompts in all 4 languages', () => {
    for (const t of TASKS) {
      for (const lang of LANG) {
        assert.ok(typeof t.prompts[lang] === 'string', `${t.task_id} missing ${lang}`);
      }
    }
  });

  it('tasks include expected standard tasks', () => {
    const ids = TASKS.map(t => t.task_id);
    assert.ok(ids.includes('num10-random'));
    assert.ok(ids.includes('coin-flip'));
    assert.ok(ids.includes('color-favorite'));
    assert.ok(ids.includes('secret-password'));
  });
});

describe('LANG', () => {
  it('has 4 languages', () => {
    assert.equal(LANG.length, 4);
  });

  it('includes expected languages', () => {
    assert.ok(LANG.includes('en'));
    assert.ok(LANG.includes('ru'));
    assert.ok(LANG.includes('zh'));
    assert.ok(LANG.includes('ar'));
  });
});

describe('normalize()', () => {
  it('returns null for empty input', () => {
    assert.equal(normalize(''), null);
    assert.equal(normalize(null), null);
    assert.equal(normalize(undefined), null);
  });

  it('trims whitespace and lowercases', () => {
    assert.equal(normalize('  Hello  '), 'hello');
    assert.equal(normalize('RED'), 'red');
  });

  it('strips surrounding quotes', () => {
    assert.equal(normalize('"hello"'), 'hello');
    assert.equal(normalize("'hello'"), 'hello');
  });

  it('strips trailing period', () => {
    assert.equal(normalize('hello.'), 'hello');
  });

  it('returns null for common refusal patterns', () => {
    assert.equal(normalize('i cannot answer that'), null);
    assert.equal(normalize('sorry, I cannot'), null);
    assert.equal(normalize('I apologize'), null);
    assert.equal(normalize("i don't have"), null);
    assert.equal(normalize('as an ai'), null);
  });
});