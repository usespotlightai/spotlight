import { describe, expect, it } from 'vitest';
import { spanned, startedOn } from '@/lib/trace-list';

const AT = Date.UTC(2026, 7, 29, 12, 0, 0);

const iso = (at: number) => new Date(at).toISOString();

describe('spanned', () => {
  it('says both ends, and the day only once where it is the same', () => {
    const text = spanned(iso(AT), iso(AT + 3_600_000));

    expect(text).toContain('–');
    expect(text.match(/Aug/g)).toHaveLength(1);
  });

  it('says both days where the stretch crosses one', () => {
    const text = spanned(iso(AT), iso(AT + 24 * 3_600_000));

    expect(text).toMatch(/Aug.*(–).*(Aug|Sep)/);
  });
});

describe('startedOn', () => {
  it('says the day and the time, which is what tells two runs apart', () => {
    expect(startedOn(new Date(AT).toISOString())).toMatch(/Aug/);
  });
});
