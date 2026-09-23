import type { Saying } from '@work/domain/aggregates/task.aggregate';
import type { TaskNote } from '@work/domain/entities/task-note.entity';
import {
  conversationsOf,
  stillOpen,
} from '@work/domain/services/conversations';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export interface SetupState {
  readonly hasRunner: boolean;
  readonly connectedToGitHub: boolean;
  readonly listensToAnIntegration: boolean;
}

export const SETUP_STEPS = ['runner', 'github', 'integrations'] as const;

export type SetupStepKey = (typeof SETUP_STEPS)[number];

export const TAKEN: Record<SetupStepKey, (state: SetupState) => boolean> = {
  runner: (state) => state.hasRunner,
  github: (state) => state.connectedToGitHub,
  integrations: (state) => state.listensToAnIntegration,
};

const setUp = (state: SetupState): boolean =>
  SETUP_STEPS.every((step) => TAKEN[step](state));

const SETTLED = 'Everything on this list is done.';

export const openSetupList = (notes: readonly TaskNote[]): TaskNote | null => {
  const standing = conversationsOf(notes.map((each) => each.kind)).find(
    stillOpen,
  );

  const opened = standing ? notes[standing.from] : undefined;

  return opened?.form === 'setup' ? opened : null;
};

export const settling = (
  notes: readonly TaskNote[],
  state: SetupState,
  at: Date,
): Saying | null => {
  const opened = openSetupList(notes);

  if (!opened || !setUp(state)) {
    return null;
  }

  return {
    station: opened.station,
    body: TaskNoteBody.of(SETTLED),
    form: 'settled',
    at,
    voice: Voice.station(),
  };
};
