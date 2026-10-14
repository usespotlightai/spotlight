import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  FOCUS_PARAM,
  KIND_LABELS,
  memoryListPath,
  WRITE_PARAM,
} from '@/lib/memory';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { MEMORY_SEED } from '@/mocks/world/team-memories';
import {
  choice,
  type PageArgs,
  pageStory,
  toggle,
} from '@/stories/application';

type MemoryArgs = {
  readonly standing: 'stands' | 'retired';
  readonly kind: string;
  readonly opened: string;
  readonly writing: boolean;
  readonly editing: boolean;
};

const meta = {
  title: 'Team/Memory',
  ...pageStory<MemoryArgs>({
    at: ({ standing, kind, opened, writing }) => {
      const path = memoryListPath(SLUG, PLATFORM_ID, {
        standing,
        kind: kind === 'any' ? null : kind,
        lineId: null,
        stationId: null,
        repository: null,
        path: null,
      });
      const query = new URLSearchParams(path.split('?')[1]);
      if (opened !== 'none') query.set(FOCUS_PARAM, opened);
      if (writing) query.set(WRITE_PARAM, '1');

      return `${path.split('?')[0]}?${query}`;
    },
    args: {
      standing: 'stands',
      kind: 'any',
      opened: 'none',
      writing: false,
      editing: false,
    },
    argTypes: {
      standing: choice('Standing', { stands: 'Standing', retired: 'Retired' }),
      kind: choice('Kind', { any: 'Every kind', ...KIND_LABELS }),
      opened: choice('Opened memory', {
        none: 'None',
        ...Object.fromEntries(
          MEMORY_SEED[PLATFORM_ID].map(({ id, handle, body }) => [
            id,
            `${handle} ${body.slice(0, 40)}…`,
          ]),
        ),
      }),
      writing: toggle('Writing a memory'),
      editing: toggle('Editing the opened memory'),
    },
    script: ({ opened, editing }) =>
      opened !== 'none' && editing
        ? async (screen, user) => {
            await user.click(
              await screen.findByRole('button', { name: 'Edit' }),
            );
          }
        : undefined,
  }),
} satisfies Meta<PageArgs & MemoryArgs>;

export default meta;

export const Memory: StoryObj<typeof meta> = {};
