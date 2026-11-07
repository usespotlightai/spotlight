import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('ToolName', () => {
  it('names a tool by the integration that offers it', () => {
    expect(ToolName.of(' linear.comment ').value).toBe('linear.comment');
    expect(
      ToolName.of('linear.comment').equals(ToolName.of('linear.comment')),
    ).toBe(true);
  });

  it('rejects a tool that names no integration', () => {
    expect(() => ToolName.of('comment')).toThrow(InvalidIdentifierError);
    expect(() => ToolName.of('Linear.Comment')).toThrow(InvalidIdentifierError);
  });

  it('names the integration that offers it, and its own name there', () => {
    const tool = ToolName.of('linear.comment');

    expect(tool.integration.value).toBe('linear');
    expect(tool.name).toBe('comment');
    expect(ToolName.parsed('comment')).toBeNull();
    expect(ToolName.parsed(' linear.comment ')?.value).toBe('linear.comment');
  });

  it('rehydrates a stored name and fails as inconsistent state for a stored row of a shape it cannot take (R7-02)', () => {
    expect(ToolName.rehydrate('linear.comment').value).toBe('linear.comment');
    expect(ToolName.rehydrate('linear.comment').integration.value).toBe(
      'linear',
    );
    expect(() => ToolName.rehydrate('comment')).toThrow(InconsistentStateError);
    expect(() => ToolName.rehydrate(' linear.comment ')).toThrow(
      InconsistentStateError,
    );
  });
});
