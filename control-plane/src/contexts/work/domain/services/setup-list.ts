import type { NewNote } from '@work/domain/aggregates/task.aggregate';
import type { TaskNote } from '@work/domain/entities/task-note.entity';
import {
  conversationsOf,
  stillOpen,
} from '@work/domain/services/conversations';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export interface SetupState {
  readonly connectedToGitHub: boolean;
  readonly hasHarness: boolean;
  readonly configured: boolean;
}

export const SETUP_STEPS = ['github', 'harness', 'configuration'] as const;

export type SetupStepKey = (typeof SETUP_STEPS)[number];

export const TAKEN: Record<SetupStepKey, (state: SetupState) => boolean> = {
  github: (state) => state.connectedToGitHub,
  harness: (state) => state.hasHarness,
  configuration: (state) => state.configured,
};

export interface SetupChatCandidate {
  readonly pullRequest: string | null;
  readonly startedAt: Date;
}

export const setupChatOf = <C extends SetupChatCandidate>(
  chats: readonly C[],
): C | null => {
  const newestFirst = [...chats].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );

  return (
    newestFirst.find((each) => each.pullRequest !== null) ??
    newestFirst[0] ??
    null
  );
};

export const configuredBy = (setupChat: SetupChatCandidate | null): boolean =>
  setupChat !== null && setupChat.pullRequest !== null;

const setUp = (state: SetupState): boolean =>
  SETUP_STEPS.every((step) => TAKEN[step](state));

const ALL_DONE = 'Everything on this list is done.';

export const openSetupList = (notes: readonly TaskNote[]): TaskNote | null => {
  const openConversation = conversationsOf(notes.map((each) => each.kind)).find(
    stillOpen,
  );

  const opened = openConversation ? notes[openConversation.from] : undefined;

  return opened?.form === 'setup' ? opened : null;
};

export const setupDoneNote = (
  notes: readonly TaskNote[],
  state: SetupState,
  at: Date,
  line: LineMap | null,
): NewNote | null => {
  const opened = openSetupList(notes);

  if (!opened || !setUp(state)) {
    return null;
  }

  return {
    line,
    body: TaskNoteBody.of(ALL_DONE),
    form: 'resolved',
    at,
    voice: Voice.station(),
  };
};
