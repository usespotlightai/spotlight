import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { Tool } from '@work/domain/value-objects/tool.vo';
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

describe('a tool named for its integration', () => {
  it('is one tool, and says which integration and name it is', () => {
    const tool = Tool.of('linear.comment');

    expect(tool.integration).toBe('linear');
    expect(tool.name).toBe('comment');
  });

  it('comes from no integration where it is one of Spotlight’s own', () => {
    expect(Tool.of('pull-request').integration).toBeNull();
    expect(Tool.of('pull-request').name).toBe('pull-request');
  });

  it('is named for one integration, not several', () => {
    expect(() => Tool.of('linear.issue.comment')).toThrow();
    expect(() => Tool.of('.comment')).toThrow();
  });
});
