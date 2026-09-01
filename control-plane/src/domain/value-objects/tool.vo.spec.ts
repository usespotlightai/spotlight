import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import { Tool } from '@domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

describe('Tool', () => {
  it('takes a name written as words joined by dashes', () => {
    expect(Tool.of('pull-request').value).toBe('pull-request');
    expect(Tool.of('deploy').value).toBe('deploy');
  });

  it('takes one with space around it', () => {
    expect(Tool.of('  pull-request  ').value).toBe('pull-request');
  });

  it.each([
    '',
    '   ',
    'Pull-Request',
    'pull_request',
    'pull request',
    '-pull',
    'pull-',
    'pull--request',
  ])('refuses %o, which is not how a tool is named', (raw) => {
    expect(() => Tool.of(raw)).toThrow(InvalidIdentifierError);
  });

  it('is the same tool as one named the same way', () => {
    expect(Tool.of('pull-request').equals(Tool.of('pull-request'))).toBe(true);
  });

  it('is not the same tool as another', () => {
    expect(Tool.of('pull-request').equals(Tool.of('deploy'))).toBe(false);
  });
});
