import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs, resolveApiKey } from '../lib/cli-args.js';

describe('parseArgs()', () => {
  it('parses positional args', () => {
    const { positional, flags } = parseArgs(['probe', 'https://x', 'gpt-4o']);
    assert.deepEqual(positional, ['probe', 'https://x', 'gpt-4o']);
    assert.deepEqual(flags, {});
  });

  it('parses --flag value form', () => {
    const { flags } = parseArgs(['--reps', '16', '--langs', 'en,zh']);
    assert.equal(flags.reps, '16');
    assert.equal(flags.langs, 'en,zh');
  });

  it('parses --flag=value form', () => {
    const { flags } = parseArgs(['--reps=16', '--api=anthropic']);
    assert.equal(flags.reps, '16');
    assert.equal(flags.api, 'anthropic');
  });

  it('parses boolean flags', () => {
    const { flags, positional } = parseArgs(['--adaptive', '--reps', '16']);
    assert.equal(flags.adaptive, true);
    assert.equal(flags.reps, '16');
    assert.deepEqual(positional, []);
  });

  it('mixes positional and flags', () => {
    const { positional, flags } = parseArgs(['probe', 'https://x', '--reps', '8', 'gpt-4o', '--api', 'openai']);
    assert.deepEqual(positional, ['probe', 'https://x', 'gpt-4o']);
    assert.equal(flags.reps, '8');
    assert.equal(flags.api, 'openai');
  });
});

describe('resolveApiKey()', () => {
  const origEnv = { ...process.env };
  afterEach(() => {
    for (const k of Object.keys(process.env)) if (!(k in origEnv)) delete process.env[k];
    for (const [k, v] of Object.entries(origEnv)) process.env[k] = v;
  });

  it('accepts positional key (with a warn)', () => {
    let warned = false;
    const r = resolveApiKey({ positional: 'sk-abc', flags: {}, apiType: 'openai', warn: () => { warned = true; } });
    assert.equal(r.key, 'sk-abc');
    assert.equal(r.source, 'positional');
    assert.ok(warned, 'should warn about ps visibility');
  });

  it('reads from --api-key-env', () => {
    process.env.MY_KEY = 'env-secret';
    const r = resolveApiKey({ positional: '-', flags: { 'api-key-env': 'MY_KEY' }, apiType: 'openai' });
    assert.equal(r.key, 'env-secret');
    assert.equal(r.source, 'env:MY_KEY');
  });

  it('rejects an empty env var', () => {
    process.env.EMPTY = '';
    assert.throws(() => resolveApiKey({ positional: '-', flags: { 'api-key-env': 'EMPTY' }, apiType: 'openai' }));
  });

  it('reads from --api-key-file (first non-empty line)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'fp-key-'));
    const path = join(tmp, 'k');
    writeFileSync(path, '\n\nsk-fromfile\n');
    const r = resolveApiKey({ positional: '-', flags: { 'api-key-file': path }, apiType: 'openai' });
    assert.equal(r.key, 'sk-fromfile');
    rmSync(tmp, { recursive: true, force: true });
  });

  it('falls back to OPENAI_API_KEY for openai', () => {
    delete process.env.LLM_FINGERPRINT_KEY;
    process.env.OPENAI_API_KEY = 'sk-openai';
    const r = resolveApiKey({ positional: undefined, flags: {}, apiType: 'openai' });
    assert.equal(r.key, 'sk-openai');
  });

  it('falls back to ANTHROPIC_API_KEY for anthropic', () => {
    delete process.env.LLM_FINGERPRINT_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-anth';
    const r = resolveApiKey({ positional: undefined, flags: {}, apiType: 'anthropic' });
    assert.equal(r.key, 'sk-anth');
  });

  it('LLM_FINGERPRINT_KEY wins over per-provider fallback', () => {
    process.env.LLM_FINGERPRINT_KEY = 'sk-shared';
    process.env.OPENAI_API_KEY = 'sk-openai';
    const r = resolveApiKey({ positional: undefined, flags: {}, apiType: 'openai' });
    assert.equal(r.key, 'sk-shared');
  });

  it('throws with an actionable message when nothing configured', () => {
    delete process.env.LLM_FINGERPRINT_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    assert.throws(() => resolveApiKey({ positional: undefined, flags: {}, apiType: 'openai' }), /--api-key-env|--api-key-file/);
  });
});
