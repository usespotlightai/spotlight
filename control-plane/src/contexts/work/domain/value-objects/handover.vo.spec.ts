import { Handover } from '@work/domain/value-objects/handover.vo';
import { describe, expect, it } from 'vitest';

describe('Handover', () => {
  it('suggests closing the task where the run asks a person and suggests done', () => {
    expect(
      Handover.of({ next: 'review', suggest: ' DONE ' }).suggestsClosing(),
    ).toBe(true);
  });

  it('suggests nothing where the run does not ask a person', () => {
    expect(
      Handover.of({ next: 'spec', suggest: 'done' }).suggestsClosing(),
    ).toBe(false);
  });

  it('suggests nothing where the run suggests something other than done', () => {
    expect(
      Handover.of({ next: 'review', suggest: 'spec' }).suggestsClosing(),
    ).toBe(false);
    expect(Handover.of({ next: 'review' }).suggestsClosing()).toBe(false);
  });

  it('drops the suggestion when it sends a handover to review', () => {
    const sent = Handover.of({
      next: 'nowhere',
      note: 'Done already.',
      suggest: 'done',
    }).sentToReview('This line has no such station.');

    expect(sent.requestsReview()).toBe(true);
    expect(sent.suggestsClosing()).toBe(false);
  });

  it('asks a person itself only when the run requested one, even after a hook sends it to review', () => {
    expect(Handover.of({ next: 'review' }).asksAPersonItself()).toBe(true);
    expect(
      Handover.of({ next: 'review' })
        .sentToReview('Denied.')
        .asksAPersonItself(),
    ).toBe(true);
    expect(
      Handover.of({ next: 'deploy' })
        .sentToReview('Denied.')
        .asksAPersonItself(),
    ).toBe(false);
  });
});
