import type { ArgTypes } from '@storybook/react-vite';
import { onlineManager } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { Location } from 'react-router';
import { mocked } from 'storybook/test';

import { useSession } from '@/hooks/api/useSession';
import { APP_TABS_KEY } from '@/lib/app-tabs';
import { keysOf } from '@/lib/one-of';
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
import { partial } from '@/test/partial';

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

const SIGNED_OUT = partial<ReturnType<typeof useSession>>({
  data: null,
  isPending: false,
  isRefetching: false,
  error: null,
});

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

type Choice<Value extends string> = {
  readonly name: string;
  readonly options: Value[];
  readonly control: {
    readonly type: 'select';
    readonly labels: Record<Value, string>;
  };
};

export const choice = <Value extends string>(
  name: string,
  labels: Record<Value, string>,
): Choice<Value> => ({
  name,
  options: keysOf(labels),
  control: { type: 'select', labels },
});

type Toggle = { readonly name: string; readonly control: 'boolean' };

export const toggle = (name: string): Toggle => ({
  name,
  control: 'boolean' as const,
});

const DEFAULT_ARGS: PageArgs = {
  state: 'data',
  account: 'owner',
  actions: 'succeed',
};

type PageStoryOf<Extra> = {
  readonly args: PageArgs & Extra;
  readonly argTypes: Partial<ArgTypes<PageArgs>> & Partial<ArgTypes<Extra>>;
  readonly beforeEach: () => () => void;
  readonly render: (all: PageArgs & Extra) => ReactElement;
};

export const pageStory = <Extra extends object = object>({
  at,
  scope = 'page',
  args,
  argTypes,
  script,
  states = PAGE_STATES,
  world,
}: PageStory<Extra>): PageStoryOf<Extra> => ({
  args: { ...DEFAULT_ARGS, ...(args ?? partial<Extra>({})) },
  argTypes: {
    ...PAGE_ARG_TYPES,
    state: stateControl(states),
    ...(argTypes ?? partial<ArgTypes<Extra>>({})),
  },
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
