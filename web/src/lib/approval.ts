import type {
  InboxApprovalInputResponseDto,
  InboxApprovalResponseDto,
} from '@/lib/api';
import {
  type ApprovalStatus,
  WAITING_FOR_APPROVAL,
} from '@/lib/approval-status';

export type Approval = InboxApprovalResponseDto;

export type ApprovalInput = InboxApprovalInputResponseDto;

export type ApprovalMode = 'viewing' | 'editing' | 'refusing';

export type ApprovalAnswer = {
  readonly approve: boolean;
  readonly said: string;
  readonly inputs?: readonly ApprovalInput[];
};

const CODE_INPUTS = new Set(['command', 'cmd', 'script', 'query', 'sql']);

const HARNESS_TITLE = 'title';

const isStructured = (value: string): boolean => {
  const written = value.trim();

  if (!written.startsWith('{') && !written.startsWith('[')) {
    return false;
  }

  try {
    const read: unknown = JSON.parse(written);

    return typeof read === 'object' && read !== null;
  } catch {
    return false;
  }
};

export const approvedOnlyBy = (
  approval: Approval,
  viewerId: string | null,
): string | null =>
  approval.askedOf && approval.askedOf.id !== viewerId
    ? approval.askedOf.name || 'the person it was asked of'
    : null;

export const editable = (approval: Approval): boolean =>
  approval.kind === 'tool-call' && approval.inputs.length > 0;

export const readsAsCode = (approval: Approval, input: ApprovalInput) =>
  approval.kind === 'harness-permission'
    ? input.name !== HARNESS_TITLE || approval.name.endsWith(' execute')
    : CODE_INPUTS.has(input.name.toLowerCase()) || isStructured(input.value);

export const labelOf = (approval: Approval, input: ApprovalInput) =>
  approval.kind === 'harness-permission' && input.name === HARNESS_TITLE
    ? null
    : input.name;

export const shownInputs = (approval: Approval): readonly ApprovalInput[] =>
  approval.edited ?? approval.inputs;

export const changedNames = (approval: Approval): ReadonlySet<string> => {
  const asked = new Map(approval.inputs.map((each) => [each.name, each.value]));

  return new Set(
    (approval.edited ?? [])
      .filter((each) => asked.get(each.name) !== each.value)
      .map((each) => each.name),
  );
};

export const differs = (
  asked: readonly ApprovalInput[],
  edits: Readonly<Record<string, string>>,
): boolean =>
  asked.some((each) => (edits[each.name] ?? each.value) !== each.value);

export const blanked = (
  asked: readonly ApprovalInput[],
  edits: Readonly<Record<string, string>>,
): boolean =>
  asked.some(
    (each) =>
      each.value.trim() !== '' &&
      (edits[each.name] ?? each.value).trim() === '',
  );

const ENDED = /[.!?…]$/;

const sentence = (words: string): string =>
  ENDED.test(words) ? words : `${words}.`;

export const titleOf = (approval: Approval): string => {
  if (approval.status === 'granted') {
    return approval.edited
      ? 'Request approved with changes'
      : 'Request approved';
  }

  return approval.status === 'refused'
    ? 'Request dismissed'
    : WAITING_FOR_APPROVAL;
};

const CARD_STATUSES: Record<Approval['status'], ApprovalStatus> = {
  asked: 'waiting',
  granted: 'approved',
  refused: 'declined',
};

export const cardStatusOf = (approval: Approval): ApprovalStatus =>
  CARD_STATUSES[approval.status];

export const askedFor = (approval: Approval): string => {
  const wanted = approval.intent ?? `use ${approval.name}`;

  if (approval.edited) {
    return `Spotlight asked to ${wanted}. You edited its inputs.`;
  }

  return approval.intent
    ? sentence(`Spotlight would like to ${approval.intent}`)
    : `Spotlight would like to use ${approval.name}. ${approval.because}`;
};

export const copyText = (approval: Approval): string => {
  const inputs = shownInputs(approval);
  const title = inputs.find((each) => each.name === HARNESS_TITLE);

  if (approval.kind === 'harness-permission' && title) {
    return title.value;
  }

  return inputs.length === 1
    ? (inputs[0]?.value ?? '')
    : inputs.map((each) => `${each.name}: ${each.value}`).join('\n');
};
