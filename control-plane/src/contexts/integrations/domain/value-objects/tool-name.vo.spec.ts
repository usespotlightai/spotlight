import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('ToolName', () => {
  it('names a tool by the integration that offers it', () => {
    expect(ToolName.of(' linear.comment ').value).toBe('linear.comment');
    expect(
      ToolName.of('linear.comment').equals(ToolName.of('linear.comment')),
    ).toBe(true);
  });

  it('refuses a tool that names no integration', () => {
    expect(() => ToolName.of('comment')).toThrow(InvalidIdentifierError);
    expect(() => ToolName.of('Linear.Comment')).toThrow(InvalidIdentifierError);
  });
});
