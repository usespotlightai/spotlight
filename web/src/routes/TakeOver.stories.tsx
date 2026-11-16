import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { waitFor, within } from 'storybook/test';

import { MAYA, SAM } from '@/mocks/world/people';
import { takenOverBy } from '@/mocks/world/takeovers';
import { choice, type PageArgs, pageStory } from '@/stories/application';
import { JourneyGuide } from '@/stories/JourneyGuide';
import { openDialog } from '@/stories/open-dialog';
import type { Script } from '@/stories/ScriptedApplication';

const TEAM = 'team_platform';
const TASK = 'task_retries';
const TASK_PAGE = `/w/acme/team/${TEAM}/tasks/${TASK}`;
const SESSION = `/w/acme/team/${TEAM}/runs/run_retries_3`;

type Step = {
  readonly story: string;
  readonly title: string;
  readonly at: string;
  readonly world?: () => void;
  readonly script?: Script;
  readonly guide: ReactNode;
};

const STEPS = {
  working: {
    story: 'the-line-works-the-task',
    title: 'The line works the task',
    at: SESSION,
    guide: (
      <>
        <p>An agent works the task at a station. This is its run.</p>
        <p>
          You read its work and see that it is not right. You want to do the
          work yourself.
        </p>
      </>
    ),
  },
  'take-over': {
    story: 'take-it-over',
    title: 'Take it over',
    at: SESSION,
    script: openDialog('Take over'),
    guide: (
      <>
        <p>Select Take over at the top of the run, or press Shift T.</p>
        <p>
          Say why you take over and write the agent's first message. If the
          agent works now, taking over stops that run.
        </p>
      </>
    ),
  },
  held: {
    story: 'the-line-holds-the-task',
    title: 'The line holds the task',
    at: TASK_PAGE,
    world: () => takenOverBy(TEAM, TASK, SAM),
    guide: (
      <>
        <p>
          You have the task now and you are its assignee. The line does not move
          it and does not fire hooks for it.
        </p>
        <p>
          The station and the assignee are locked. Select Taken over at the top
          of the task to go to your session.
        </p>
      </>
    ),
  },
  drive: {
    story: 'drive-the-agent',
    title: 'Drive the agent',
    at: SESSION,
    world: () => takenOverBy(TEAM, TASK, SAM),
    guide: (
      <>
        <p>
          This is your session with the agent. Each message you send starts one
          turn. When the agent answers, the answer is in your Inbox.
        </p>
        <p>
          You can open the workspace in VS Code and change the code yourself.
        </p>
      </>
    ),
  },
  team: {
    story: 'your-team-sees-it',
    title: 'Your team sees it',
    at: `/w/acme/team/${TEAM}/lines/line_delivery`,
    world: () => takenOverBy(TEAM, TASK, MAYA),
    guide: (
      <>
        <p>
          When a teammate has a task, the board, the task and its runs show
          Taken over. Hover the pill to see who has it and since when.
        </p>
        <p>
          Your messages to the agent wait until your teammate hands the task
          back.
        </p>
      </>
    ),
  },
  'hand-back': {
    story: 'hand-it-back',
    title: 'Hand it back',
    at: SESSION,
    world: () => takenOverBy(TEAM, TASK, SAM),
    script: openDialog('Hand it back'),
    guide: (
      <>
        <p>
          When you are done, select Hand it back at the top of the session, or
          press Shift H.
        </p>
        <p>
          Choose what the line does next: run the station again, move the task
          on or finish it. Your changes stay in the workspace.
        </p>
      </>
    ),
  },
  back: {
    story: 'back-on-the-line',
    title: 'Back on the line',
    at: SESSION,
    world: () => takenOverBy(TEAM, TASK, SAM),
    script: async (screen, user) => {
      await openDialog('Hand it back')(screen, user);
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Hand it back',
        }),
      );
      await waitFor(() => {
        if (screen.queryByRole('dialog')) {
          throw new Error('The dialog is still open');
        }
      });
    },
    guide: (
      <>
        <p>
          The task is back on the line. A message tells you what the line does
          next.
        </p>
        <p>
          The station runs again with your changes, or the task moves on.
          Spotlight records your changes as the work of the station.
        </p>
      </>
    ),
  },
} satisfies Record<string, Step>;

type StepId = keyof typeof STEPS;

const ORDER = Object.keys(STEPS) as StepId[];

const JOURNEY = 'Take over a task';
const TITLE = 'Team/Lines/Take over';
const STORY_PREFIX = 'team-lines-take-over--';

type TakeOverArgs = { readonly step: StepId };

const meta = {
  title: TITLE,
  ...pageStory<TakeOverArgs>({
    states: ['data'],
    at: ({ step }) => STEPS[step].at,
    args: { step: 'working' },
    argTypes: {
      step: choice(
        'Step',
        Object.fromEntries(
          ORDER.map((each) => [each, STEPS[each].title]),
        ) as Record<StepId, string>,
      ),
    },
    world: ({ step }) => (STEPS[step] as Step).world?.(),
    script: ({ step }) => (STEPS[step] as Step).script,
  }),
  decorators: [
    (Story, { args }) => (
      <>
        <Story />
        <JourneyGuide
          journey={JOURNEY}
          steps={ORDER.map((each) => ({
            story: `${STORY_PREFIX}${STEPS[each].story}`,
            title: STEPS[each].title,
          }))}
          at={ORDER.indexOf(args.step)}
        >
          {STEPS[args.step].guide}
        </JourneyGuide>
      </>
    ),
  ],
} satisfies Meta<PageArgs & TakeOverArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheLineWorksTheTask: Story = {
  name: 'The line works the task',
  args: { step: 'working' },
};

export const TakeItOver: Story = {
  name: 'Take it over',
  args: { step: 'take-over' },
};

export const TheLineHoldsTheTask: Story = {
  name: 'The line holds the task',
  args: { step: 'held' },
};

export const DriveTheAgent: Story = {
  name: 'Drive the agent',
  args: { step: 'drive' },
};

export const YourTeamSeesIt: Story = {
  name: 'Your team sees it',
  args: { step: 'team' },
};

export const HandItBack: Story = {
  name: 'Hand it back',
  args: { step: 'hand-back' },
};

export const BackOnTheLine: Story = {
  name: 'Back on the line',
  args: { step: 'back' },
};
