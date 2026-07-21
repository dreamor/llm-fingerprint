import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveReps, anthropicMessagesUrl } from '../lib/probe.js';

describe('resolveReps()', () => {
  it('auto with default EER 0.10 returns 16', () => {
    assert.equal(resolveReps('auto'), 16);
  });

  it('auto with EER 0.05 returns 40', () => {
    assert.equal(resolveReps('auto', 0.05), 40);
  });

  it('auto with EER 0.09 returns 24', () => {
    assert.equal(resolveReps('auto', 0.09), 24);
  });

  it('auto with EER 0.15 returns 4 (first in budget curve)', () => {
    assert.equal(resolveReps('auto', 0.15), 4);
  });

  it('auto with very strict EER 0.01 returns 40 (ceiling)', () => {
    assert.equal(resolveReps('auto', 0.01), 40);
  });

  it('numeric string returns parsed number', () => {
    assert.equal(resolveReps('8'), 8);
    assert.equal(resolveReps('30'), 30);
  });

  it('returns 30 for invalid input', () => {
    assert.equal(resolveReps('abc'), 30);
    assert.equal(resolveReps(''), 30);
    assert.equal(resolveReps('-5'), 30);
  });
});

describe('anthropicMessagesUrl()', () => {
  it('adds /v1/messages to a bare host', () => {
    assert.equal(
      anthropicMessagesUrl('https://api.anthropic.com'),
      'https://api.anthropic.com/v1/messages',
    );
  });

  it('adds only /messages when /v1 is already present', () => {
    assert.equal(
      anthropicMessagesUrl('https://api.anthropic.com/v1'),
      'https://api.anthropic.com/v1/messages',
    );
  });

  it('handles trailing slashes', () => {
    assert.equal(
      anthropicMessagesUrl('https://api.anthropic.com/'),
      'https://api.anthropic.com/v1/messages',
    );
    assert.equal(
      anthropicMessagesUrl('https://api.anthropic.com/v1/'),
      'https://api.anthropic.com/v1/messages',
    );
  });

  it('respects an explicit non-v1 version prefix', () => {
    assert.equal(
      anthropicMessagesUrl('https://proxy.example.com/v2'),
      'https://proxy.example.com/v2/messages',
    );
  });
});