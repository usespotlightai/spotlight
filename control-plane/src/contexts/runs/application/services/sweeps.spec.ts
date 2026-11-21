import { Sweeps } from '@runs/application/services/sweeps';
import { describe, expect, it } from 'vitest';

describe('Sweeps', () => {
  it('starts the first page past the head where the head ends', () => {
    expect(new Sweeps<number>(10).next('ws_1', 200)).toEqual({
      from: 200,
      page: 2,
    });
  });

  it('moves one page further after each full page', () => {
    const sweeps = new Sweeps<number>(10);

    sweeps.read('ws_1', 2, { full: true, next: 400 });

    expect(sweeps.next('ws_1', 200)).toEqual({ from: 400, page: 3 });
  });

  it('starts at the head again after a page that is not full, or after the last page', () => {
    const sweeps = new Sweeps<number>(3);

    sweeps.read('ws_1', 2, { full: false, next: 300 });
    expect(sweeps.next('ws_1', 200)).toEqual({ from: 200, page: 2 });

    sweeps.read('ws_1', 3, { full: true, next: 600 });
    expect(sweeps.next('ws_1', 200)).toEqual({ from: 200, page: 2 });
  });

  it('keeps each workspace apart, and forgets those with no waiting work', () => {
    const sweeps = new Sweeps<number>(10);

    sweeps.read('ws_1', 2, { full: true, next: 400 });
    sweeps.read('ws_2', 2, { full: true, next: 400 });
    sweeps.keepOnly(new Set(['ws_2']));

    expect(sweeps.next('ws_1', 200)).toEqual({ from: 200, page: 2 });
    expect(sweeps.next('ws_2', 200)).toEqual({ from: 400, page: 3 });
  });

  it('starts at the head again when the head is short', () => {
    const sweeps = new Sweeps<number>(10);

    sweeps.read('ws_1', 2, { full: true, next: 400 });
    sweeps.restart('ws_1');

    expect(sweeps.next('ws_1', 200)).toEqual({ from: 200, page: 2 });
  });
});
