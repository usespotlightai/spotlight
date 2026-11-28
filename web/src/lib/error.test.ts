import { describe, expect, it } from 'vitest';

import { FieldRefusal, refusalOf } from '@/lib/error';

const problem = (...errors: unknown[]) => ({
  detail: 'key: Use lowercase letters',
  errors,
});

describe('refusalOf', () => {
  it('gives the reason for a field the form shows, without the field name', () => {
    const refusal = refusalOf(
      problem({ path: 'key', message: 'Use lowercase letters' }),
      ['key'],
    );

    expect(refusal).toBeInstanceOf(FieldRefusal);
    expect(refusal).toMatchObject({
      message: 'Use lowercase letters',
      field: 'key',
    });
  });

  it('joins the reasons for that one field, and leaves out warnings', () => {
    expect(
      refusalOf(
        problem(
          { path: 'key', message: 'Use lowercase letters.' },
          { path: 'key', message: 'Choose a shorter name.' },
          { path: 'labels', message: 'is unused', severity: 'warning' },
        ),
        ['key'],
      ).message,
    ).toBe('Use lowercase letters. Choose a shorter name.');
  });

  it('keeps the detail, which names each field, when more than one field is refused', () => {
    const refusal = refusalOf(
      problem(
        { path: 'key', message: 'Use lowercase letters' },
        { path: 'labels.0', message: 'Use lowercase letters' },
      ),
      ['key'],
    );

    expect(refusal).not.toBeInstanceOf(FieldRefusal);
    expect(refusal.message).toBe('key: Use lowercase letters');
  });

  it('keeps the detail for a field the form does not show', () => {
    expect(
      refusalOf(problem({ path: 'scopes', message: 'include read' }), ['key'])
        .message,
    ).toBe('key: Use lowercase letters');
  });

  it('keeps the detail when a reason is empty', () => {
    expect(
      refusalOf(problem({ path: 'key', message: '' }), ['key']).message,
    ).toBe('key: Use lowercase letters');
  });

  it('falls back when Spotlight says nothing', () => {
    expect(refusalOf(undefined, ['key'], 'Sorry.').message).toBe('Sorry.');
  });
});
