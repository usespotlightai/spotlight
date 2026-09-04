import type { Saying } from '@domain/aggregates/task.aggregate';
import { conversationsOf, stillOpen } from '@domain/services/conversations';
import type { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { Voice } from '@domain/value-objects/voice.vo';

/** Where a team stands on each of the things the list asks for. */
export interface SetupState {
  readonly hasRunner: boolean;
  readonly connectedToGitHub: boolean;
  readonly hasRepository: boolean;
  readonly hasConfiguration: boolean;
  readonly listensToATool: boolean;
}

/** The list a team is opened with, in the order it is worked through. */
export const SETUP_STEPS = [
  'runner',
  'github',
  'repository',
  'configuration',
  'tools',
] as const;

export type SetupStepKey = (typeof SETUP_STEPS)[number];

/** What having taken each step looks like. */
export const TAKEN: Record<SetupStepKey, (state: SetupState) => boolean> = {
  runner: (state) => state.hasRunner,
  github: (state) => state.connectedToGitHub,
  repository: (state) => state.hasRepository,
  configuration: (state) => state.hasConfiguration,
  tools: (state) => state.listensToATool,
};

const setUp = (state: SetupState): boolean =>
  SETUP_STEPS.every((step) => TAKEN[step](state));

const SETTLED = 'Everything on this list is done.';

/**
 * What settles a team's list, or nothing where there is nothing to settle.
 *
 * Only the conversation still open, and only where a list opened it: one the
 * task closed on its way somewhere was settled by that, and an open one
 * somebody else started is theirs.
 */
export const settling = (
  notes: readonly TaskNote[],
  state: SetupState,
  at: Date,
): Saying | null => {
  const standing = conversationsOf(notes.map((each) => each.kind)).find(
    stillOpen,
  );

  const opened = standing ? notes[standing.from] : undefined;

  if (opened?.form !== 'setup' || !setUp(state)) {
    return null;
  }

  return {
    station: opened.station,
    body: TaskNoteBody.of(SETTLED),
    at,
    voice: Voice.station(),
  };
};
