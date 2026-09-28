type HeldLineStationKind = 'backlog' | 'work' | 'completed';

export type HeldLineStation = {
  readonly key: string;
  readonly name: string;
  readonly kind: HeldLineStationKind;
  readonly color?: string;
  readonly description?: string;
  readonly harness?: string;
  readonly model?: string;
  readonly effort?: string;
  readonly profile?: string;
  readonly prompt?: string;
  readonly check?: string;
  readonly runners?: readonly string[];
  readonly diffs?: boolean;
  readonly decisions?: boolean;
  readonly memories?: boolean;
  readonly tools: readonly string[];
  readonly skills: readonly string[];
  readonly passesTo: readonly string[];
  readonly ends: boolean;
};

export type HeldLineRepository = {
  readonly name: string;
  readonly image?: string;
  readonly setup?: string;
};

export type HeldLineReaction = {
  readonly happening: string;
  readonly from?: string;
  readonly to: string;
};

type HeldLineReviewSkips = {
  readonly spotlight?: boolean;
  readonly drafts?: boolean;
  readonly authors?: readonly string[];
};

export type HeldLineReviews = {
  readonly start?: 'opened' | 'mentioned';
  readonly mention?: string;
  readonly skip: HeldLineReviewSkips;
};

export type HeldLine = {
  readonly key: string;
  readonly name: string;
  readonly role?: string;
  readonly repositories: readonly HeldLineRepository[];
  readonly runners?: readonly string[];
  readonly stations: readonly HeldLineStation[];
  readonly reactions: readonly HeldLineReaction[];
  readonly reviews?: HeldLineReviews;
};
