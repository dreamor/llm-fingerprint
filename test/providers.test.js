import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getProvider, listProviders } from '../lib/providers/index.js';
import * as openai from '../lib/providers/openai.js';
import * as anthropic from '../lib/providers/anthropic.js';

describe('provider registry', () => {
  it('lists both built-in providers', () => {
    const names = listProviders().sort();
    assert.deepEqual(names, ['anthropic', 'openai']);
  });

  it('throws for unknown provider', () => {
    assert.throws(() => getProvider('bedrock'), /unknown provider/);
  });
});

describe('openai provider', () => {
  it('builds a completions URL from a base', () => {
    assert.equal(
      openai.chatCompletionsUrl('https://api.openai.com/v1'),
      'https://api.openai.com/v1/chat/completions'
    );
  });

  it('does NOT send OpenRouter reasoning field by default', () => {
    const req = openai.buildRequest({
      apiKey: 'k',
      model: 'm',
      prompt: 'p',
      temperature: 1,
      maxTokens: 16
    });
    const body = JSON.parse(req.body);
    assert.equal(body.reasoning, undefined);
  });

  it('merges extraBody when provided (for OpenRouter opt-in)', () => {
    const req = openai.buildRequest({
      apiKey: 'k',
      model: 'm',
      prompt: 'p',
      temperature: 1,
      maxTokens: 16,
      extraBody: { reasoning: { enabled: false } }
    });
    const body = JSON.parse(req.body);
    assert.deepEqual(body.reasoning, { enabled: false });
  });

  it('extracts text from response envelope', () => {
    const text = openai.extractText({ choices: [{ message: { content: 'hello' } }] });
    assert.equal(text, 'hello');
  });
});

describe('anthropic provider', () => {
  it('adds /v1/messages to bare host', () => {
    assert.equal(
      anthropic.messagesUrl('https://api.anthropic.com'),
      'https://api.anthropic.com/v1/messages'
    );
  });

  it('appends /messages when /v1 present', () => {
    assert.equal(
      anthropic.messagesUrl('https://api.anthropic.com/v1'),
      'https://api.anthropic.com/v1/messages'
    );
  });

  it('handles trailing slashes', () => {
    assert.equal(
      anthropic.messagesUrl('https://api.anthropic.com/'),
      'https://api.anthropic.com/v1/messages'
    );
  });

  it('extracts concatenated text blocks', () => {
    const text = anthropic.extractText({
      content: [
        { type: 'text', text: 'foo' },
        { type: 'text', text: 'bar' },
        { type: 'tool_use', name: 'noop' }
      ]
    });
    assert.equal(text, 'foobar');
  });
});
