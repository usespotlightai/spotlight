import { ToolOutput } from '@work/domain/value-objects/tool-output.vo';
import { describe, expect, it } from 'vitest';

describe('ToolOutput', () => {
  it('keeps what a tool answered as JSON text, and reads it back', () => {
    const output = ToolOutput.answered({ pages: 3, $type: 'Task' });

    expect(output.json).toBe('{"pages":3,"$type":"Task"}');
    expect(output.answer).toEqual({ pages: 3, $type: 'Task' });
  });

  it('keeps nothing answered as null', () => {
    expect(ToolOutput.answered(undefined).answer).toBeNull();
  });

  it('keeps an answer that cannot be written as JSON as null', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(ToolOutput.answered(10n).answer).toBeNull();
    expect(ToolOutput.answered(() => 'called').answer).toBeNull();
    expect(ToolOutput.answered(Symbol('answer')).answer).toBeNull();
    expect(ToolOutput.answered(circular).answer).toBeNull();
  });

  it('keeps an answer too large to carry as null, and one just small enough whole', () => {
    expect(ToolOutput.answered('x'.repeat(16_000)).answer).toBeNull();
    expect(ToolOutput.answered('x'.repeat(15_998)).answer).toBe(
      'x'.repeat(15_998),
    );
  });

  it('keeps no reference to what it was value', () => {
    const value = { pages: [1] };
    const output = ToolOutput.answered(value);

    value.pages.push(2);

    expect(output.answer).toEqual({ pages: [1] });
  });
});
