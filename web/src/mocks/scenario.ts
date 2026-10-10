import { resetWorld } from '@/mocks/world';

export const PAGE_STATES = ['data', 'empty', 'loading', 'error'] as const;

export type PageState = (typeof PAGE_STATES)[number];

export const ACCOUNTS = [
  'owner',
  'member',
  'no-workspace',
  'signed-out',
] as const;

export type Account = (typeof ACCOUNTS)[number];

export const ACTIONS = ['succeed', 'fail'] as const;

export type Actions = (typeof ACTIONS)[number];

export type StateScope = 'page' | 'app';

export type Scenario = {
  readonly state: PageState;
  readonly scope: StateScope;
  readonly account: Account;
  readonly actions: Actions;
};

const ORDINARY: Scenario = {
  state: 'data',
  scope: 'page',
  account: 'owner',
  actions: 'succeed',
};

let current: Scenario = ORDINARY;

export const scenario = (): Scenario => current;

export const pageState = (): PageState => current.state;

export const setScenario = (next: Partial<Scenario>): void => {
  current = { ...ORDINARY, ...next };
  resetWorld(current.state === 'empty' ? 'empty' : 'full');
};
