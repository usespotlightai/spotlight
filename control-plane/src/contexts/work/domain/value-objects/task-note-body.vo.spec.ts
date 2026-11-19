import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { describe, expect, it } from 'vitest';

describe('TaskNoteBody.receivedHappening', () => {
  it('keeps the place and the body of the anchor, and nothing generic over it', () => {
    const anchor = Anchor.of({
      body: 'can you please create a separate migration image?',
      path: 'apps/server/Dockerfile',
      from: 9,
    });

    expect(
      TaskNoteBody.receivedHappening(
        'The pull request was commented on.',
        anchor,
      ).value,
    ).toBe(
      [
        'apps/server/Dockerfile:9',
        'can you please create a separate migration image?',
      ].join('\n'),
    );
  });

  it('says what happened where it has no anchor', () => {
    expect(
      TaskNoteBody.receivedHappening('The pull request was merged.', null)
        .value,
    ).toBe('The pull request was merged.');
  });

  it("is a person's words alone where they pointed at no place", () => {
    const anchor = Anchor.of({ body: 'Ship it.' });

    expect(
      TaskNoteBody.receivedHappening(
        'The pull request was commented on.',
        anchor,
      ).value,
    ).toBe('Ship it.');
  });
});

describe('TaskNoteBody.deferredMove', () => {
  it('says a run worked on the task, where it moves once the run ends, and then what arrived', () => {
    expect(
      TaskNoteBody.deferredMove(
        StationName.of('Implementation'),
        TaskNoteBody.of('The checks failed on the pull request.'),
      ).value,
    ).toBe(
      [
        'This arrived while a run was in progress on the task. If the run does not pass the task on, the task moves to Implementation when the run ends.',
        '',
        'The checks failed on the pull request.',
      ].join('\n'),
    );
  });
});

describe('TaskNoteBody.resumed', () => {
  const resumed = (into: { name: StationName; completed: boolean } | null) =>
    TaskNoteBody.resumed({
      at: StationName.of('Build'),
      into,
      held: null,
      because: null,
      changes: [],
      summary: null,
    }).value;

  it('says why the line resumed, right after where', () => {
    expect(
      TaskNoteBody.resumed({
        at: StationName.of('Build'),
        into: null,
        held: null,
        because: TaskNoteBody.CHAT_DELETED,
        changes: [],
        summary: null,
      }).value.split('\n\n')[1],
    ).toBe(TaskNoteBody.CHAT_DELETED);
  });

  it('ends the rules for the person’s turns wherever the task goes on', () => {
    expect(resumed(null)).toContain(
      "The rules for the person's turns no longer apply.",
    );
    expect(
      resumed({ name: StationName.of('Review'), completed: false }),
    ).toContain("The rules for the person's turns no longer apply.");
  });
});

describe('TaskNoteBody.putOnHold', () => {
  it('tells the agent which handover words resume the line, and what each one does', () => {
    const body = TaskNoteBody.putOnHold(StationName.of('Build'), [
      HandoverOption.station(StationKey.of('build'), StationName.of('Build')),
      HandoverOption.station(StationKey.of('deploy'), StationName.of('Deploy')),
      HandoverOption.done(),
    ]).value;

    expect(body).toContain('A person put the task on hold at Build.');
    expect(body).toContain('`"build"`: Build continues the work.');
    expect(body).toContain('`"deploy"`: the task moves on to Deploy.');
    expect(body).toContain(
      '`"done"`: the task is finished. Use it only when they say the task is finished.',
    );
    expect(body).toContain(
      'In all other cases, do not run `spotlight handover`.',
    );
  });
});
