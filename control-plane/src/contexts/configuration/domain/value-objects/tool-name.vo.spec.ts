import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('ToolName', () => {
  it('names a tool Spotlight offers, or one an integration offers', () => {
    expect(ToolName.of('pull-request').integration).toBeNull();
    expect(ToolName.of('linear.comment').integration).toBe('linear');
    expect(ToolName.of('linear.comment').name).toBe('comment');
  });

  it.each(['', 'Linear.Comment', 'linear.comment.more', 'linear.'])(
    'refuses %o',
    (raw) => {
      expect(() => ToolName.of(raw)).toThrow(InvalidIdentifierError);
    },
  );
});
