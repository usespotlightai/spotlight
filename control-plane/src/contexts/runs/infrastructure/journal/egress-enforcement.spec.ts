import { enforcementOf } from '@runs/infrastructure/journal/egress-enforcement';
import { describe, expect, it } from 'vitest';

const encoded = (data: unknown) =>
  Buffer.from(JSON.stringify(data)).toString('base64');

describe('enforcementOf', () => {
  it('reads whether the egress check enforced the run', () => {
    for (const [data, enforcement] of [
      [encoded({ enforced: true }), 'enforced'],
      [encoded({ enforced: false }), 'not-enforced'],
      [null, null],
      [encoded({ enforced: 'yes' }), null],
      ['not base64 json', null],
    ] as const) {
      expect(enforcementOf(data)).toBe(enforcement);
    }
  });
});
