import type {
  InviteOutcomeResponseDto,
  TeamReferenceResponseDto,
  WorkspaceInviteResponseDto,
  WorkspaceMemberResponseDto,
} from '@/lib/api';
import { nameOfRole, type Role } from '@/lib/role';
import { settingsPath } from '@/lib/settings';

export type WorkspaceMember = WorkspaceMemberResponseDto;

export type WorkspaceInvite = WorkspaceInviteResponseDto;

export type InviteRole = WorkspaceInvite['role'];

export type InviteOutcome = InviteOutcomeResponseDto;

export const membersPath = (slug: string): string =>
  `${settingsPath(slug)}/members`;

export const INVITE_ROLES: readonly { value: InviteRole; label: string }[] = [
  { value: 'admin', label: nameOfRole.admin },
  { value: 'member', label: nameOfRole.member },
];

export const USUAL_INVITE_ROLE: InviteRole = 'member';

const ROLE_ORDER: readonly Role[] = ['owner', 'admin', 'member'];

export const rolesOffered = (
  role: Role,
  mayBeSetTo: readonly Role[],
): Role[] => {
  const offered = new Set<Role>([role, ...mayBeSetTo]);

  return ROLE_ORDER.filter((each) => offered.has(each));
};

const ADDRESS = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const LONGEST_ADDRESS = 254;

export const MAX_INVITED_AT_ONCE = 50;

export const isEmailAddress = (text: string): boolean =>
  text.length <= LONGEST_ADDRESS && ADDRESS.test(text);

type ParsedEmails = {
  readonly valid: string[];
  readonly invalid: string[];
};

export const parseEmails = (text: string): ParsedEmails => {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const each of text.split(/[\s,;]+/)) {
    const address = each.trim();
    const key = address.toLowerCase();

    if (address.length === 0 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    (isEmailAddress(address) ? valid : invalid).push(address);
  }

  return { valid, invalid };
};

export const OUTCOME_LABELS: Record<InviteOutcome['outcome'], string> = {
  invited: 'Invited',
  'sent-again': 'Sent again',
  'already-a-member': 'Already a member',
  'not-sent': 'Not sent. Please resend it from Pending invites.',
};

const OUTCOME_COUNTS: readonly [InviteOutcome['outcome'], string][] = [
  ['invited', 'invited'],
  ['sent-again', 'sent again'],
  ['already-a-member', 'already in the workspace'],
  ['not-sent', 'not sent'],
];

export const describeOutcomes = (outcomes: readonly InviteOutcome[]): string =>
  OUTCOME_COUNTS.flatMap(([outcome, label]) => {
    const count = outcomes.filter((each) => each.outcome === outcome).length;
    return count > 0 ? [`${count} ${label}`] : [];
  }).join(' · ') || 'Invites';

export const describeTeams = (teams: readonly TeamReferenceResponseDto[]) =>
  teams.length === 0 ? 'No team' : teams.map((each) => each.name).join(', ');

export const inviterNamed = (name: string | null | undefined): string =>
  name ?? 'Someone who has left';

export const describeInviter = (name: string | null | undefined): string =>
  `Invited by ${name ?? 'someone who has left'}`;

export const sameAddress = (one: string, other: string): boolean =>
  one.trim().toLowerCase() === other.trim().toLowerCase();

export const MEMBER_SHOWS = [
  { value: 'owner', label: 'Owners' },
  { value: 'admin', label: 'Admins' },
  { value: 'member', label: 'Members' },
  { value: 'invited', label: 'Pending invites' },
] as const;

export type MemberShow = (typeof MEMBER_SHOWS)[number]['value'];

export const SHOW_PARAM = 'show';

export const showOf = (params: URLSearchParams): MemberShow | null => {
  const shown = params.get(SHOW_PARAM);

  return MEMBER_SHOWS.find((each) => each.value === shown)?.value ?? null;
};

export const visibleMembers = (
  members: readonly WorkspaceMember[],
  show: MemberShow | null,
): WorkspaceMember[] | null => {
  if (show === 'invited') {
    return null;
  }

  return show === null
    ? [...members]
    : members.filter((each) => each.role === show);
};

export const showsInvites = (show: MemberShow | null): boolean =>
  show === null || show === 'invited';

const DAY = 24 * 60 * 60 * 1000;

export const expiryOfInvite = (expiresAt: string, now = Date.now()): string => {
  const left = new Date(expiresAt).getTime() - now;

  if (left <= 0) {
    return 'Expired';
  }

  const days = Math.ceil(left / DAY);

  return days <= 1 ? 'Expires within a day' : `Expires in ${days} days`;
};

const listedNames = (names: readonly string[]): string =>
  names.length <= 1
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

const ROLE_WITH_ARTICLE: Record<InviteRole, string> = {
  admin: 'an admin',
  member: 'a member',
};

export const joiningAs = (
  role: InviteRole,
  teamNames: readonly string[],
): string => {
  const as = `You join as ${ROLE_WITH_ARTICLE[role]}`;

  if (teamNames.length === 0) {
    return `${as} of the workspace on Spotlight.`;
  }

  const teams = teamNames.length === 1 ? 'team' : 'teams';

  return `${as}, on the ${listedNames(teamNames)} ${teams}.`;
};
