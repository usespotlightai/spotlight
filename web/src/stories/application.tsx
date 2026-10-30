import type { ArgTypes } from '@storybook/react-vite';
import { onlineManager } from '@tanstack/react-query';
import type { Location } from 'react-router';
import { mocked } from 'storybook/test';
import { useSession } from '@/hooks/api/useSession';
import { APP_TABS_KEY } from '@/lib/app-tabs';
import {
  ACCOUNTS,
  ACTIONS,
  type Account,
  type Actions,
  PAGE_STATES,
  type PageState,
  type StateScope,
  setScenario,
} from '@/mocks/scenario';
import {
  type Script,
  ScriptedApplication,
} from '@/stories/ScriptedApplication';
import { resumed } from '@/stories/visit';

const closeStoredTabs = () => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(APP_TABS_KEY)) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
};

export type PageArgs = {
  readonly state: PageState;
  readonly account: Account;
  readonly actions: Actions;
};

type Where = string | Partial<Location>;

type PageStory<Extra> = {
  readonly at: Where | ((args: PageArgs & Extra) => Where);
  readonly scope?: StateScope | ((args: PageArgs & Extra) => StateScope);
  readonly args?: Partial<PageArgs> & Extra;
  readonly argTypes?: Partial<ArgTypes<Extra>>;
  readonly script?: (args: PageArgs & Extra) => Script | undefined;
  readonly states?: readonly PageState[];
  readonly world?: (args: PageArgs & Extra) => void;
};

const SIGNED_OUT = {
  data: null,
  isPending: false,
  isRefetching: false,
  error: null,
  refetch: async () => undefined,
} as never;

const signIn = (account: Account) => {
  if (account === 'signed-out') {
    mocked(useSession).mockReturnValue(SIGNED_OUT);
  } else {
    mocked(useSession).mockRestore();
  }
};

const STATE_LABELS: Record<PageState, string> = {
  data: 'With data',
  empty: 'Empty',
  loading: 'Loading',
  error: 'Error',
};

const stateControl = (states: readonly PageState[]) =>
  states.length > 1
    ? {
        name: 'State',
        options: states,
        control: { type: 'inline-radio' as const, labels: STATE_LABELS },
      }
    : { table: { disable: true } };

const PAGE_ARG_TYPES: Partial<ArgTypes<PageArgs>> = {
  account: {
    name: 'Signed in as',
    options: ACCOUNTS,
    control: {
      type: 'inline-radio',
      labels: {
        owner: 'Owner',
        member: 'Member',
        'no-workspace': 'No workspace yet',
        'signed-out': 'Signed out',
      },
    },
  },
  actions: {
    name: 'Actions',
    options: ACTIONS,
    control: {
      type: 'inline-radio',
      labels: { succeed: 'Succeed', fail: 'Fail' },
    },
  },
};

export const choice = <Value extends string>(
  name: string,
  labels: Record<Value, string>,
) => ({
  name,
  options: Object.keys(labels) as Value[],
  control: { type: 'select' as const, labels },
});

export const toggle = (name: string) => ({
  name,
  control: 'boolean' as const,
});

export const pageStory = <Extra extends object = object>({
  at,
  scope = 'page',
  args,
  argTypes,
  script,
  states = PAGE_STATES,
  world,
}: PageStory<Extra>) => ({
  args: {
    state: 'data',
    account: 'owner',
    actions: 'succeed',
    ...args,
  } as PageArgs & Extra,
  argTypes: {
    ...PAGE_ARG_TYPES,
    state: stateControl(states),
    ...argTypes,
  } as Partial<ArgTypes<PageArgs & Extra>>,
  beforeEach: () => {
    onlineManager.setOnline(true);
    closeStoredTabs();

    return () => mocked(useSession).mockRestore();
  },
  render: (all: PageArgs & Extra) => {
    const { state, account, actions } = all;
    setScenario({
      state,
      account,
      actions,
      scope: typeof scope === 'function' ? scope(all) : scope,
    });
    signIn(account);
    world?.(all);

    const start = typeof at === 'function' ? at(all) : at;
    const where = resumed(start);

    return (
      <ScriptedApplication
        key={JSON.stringify(all)}
        at={where}
        script={where === start ? script?.(all) : undefined}
      />
    );
  },
});
