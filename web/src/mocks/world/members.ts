import type {
  InviteOfferResponseDto,
  WorkspaceInviteResponseDto,
} from '@/lib/api';
import type { Role } from '@/lib/role';
import { daysAgo } from '@/mocks/clock';
import { GROWTH_ID, PLATFORM_ID, perWorld, WORKSPACE } from '@/mocks/world';
import { LENA, MAYA, PRIYA, SAM, TOM } from '@/mocks/world/people';

export const INVITE_DAYS = 7;

export type WorkspacePerson = {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
  readonly email: string;
  role: Role;
  readonly joinedAt: string;
};

const person = (
  who: typeof SAM,
  email: string,
  role: Role,
  joinedDaysAgo: number,
): WorkspacePerson => ({
  ...who,
  email,
  role,
  joinedAt: daysAgo(joinedDaysAgo),
});

const PEOPLE: WorkspacePerson[] = [
  person(SAM, 'sam@example.com', 'owner', 140),
  person(PRIYA, 'priya.nair@acme.dev', 'admin', 96),
  person(MAYA, 'maya.chen@acme.dev', 'member', 88),
  person(TOM, 'tom.becker@acme.dev', 'member', 31),
  person(LENA, 'lena.park@acme.dev', 'member', 2),
];

const team = (teamId: string) => ({
  id: teamId,
  name: WORKSPACE.teams.find((each) => each.id === teamId)?.name ?? '',
});

const inviter = (who: typeof SAM) => ({
  id: who.id,
  name: who.name,
  image: who.image,
});

const invite = (
  id: string,
  email: string,
  role: WorkspaceInviteResponseDto['role'],
  teamIds: readonly string[],
  by: typeof SAM | null,
  invitedDaysAgo: number,
): WorkspaceInviteResponseDto => ({
  id,
  email,
  role,
  teams: teamIds.map(team),
  invitedBy: by ? inviter(by) : null,
  invitedAt: daysAgo(invitedDaysAgo),
  expiresAt: daysAgo(invitedDaysAgo - INVITE_DAYS),
});

const INVITES: WorkspaceInviteResponseDto[] = [
  invite(
    'invite_jordan',
    'jordan.lee@acme.dev',
    'member',
    [PLATFORM_ID],
    SAM,
    1,
  ),
  invite(
    'invite_noor',
    'noor.haddad@acme.dev',
    'member',
    [GROWTH_ID],
    PRIYA,
    2,
  ),
  invite(
    'invite_alex',
    'alex.morgan@acme.dev',
    'admin',
    [PLATFORM_ID, GROWTH_ID],
    SAM,
    4,
  ),
  invite('invite_dana', 'dana.wright@contractors.io', 'member', [], null, 6),
];

export type InviteOffer = InviteOfferResponseDto & { token: string };

const offer = (
  token: string,
  email: string,
  status: InviteOffer['status'],
  role: InviteOffer['role'],
  teamIds: readonly string[],
  by: typeof SAM | null,
): InviteOffer => ({
  token,
  email,
  workspaceName: WORKSPACE.name,
  invitedBy: by?.name ?? null,
  role,
  teamNames: teamIds.map((teamId) => team(teamId).name),
  status,
});

const OFFERS: InviteOffer[] = [
  offer(
    'invite_sam',
    'Sam@Example.com',
    'open',
    'member',
    [PLATFORM_ID, GROWTH_ID],
    PRIYA,
  ),
  offer(
    'invite_platform',
    'jordan.lee@acme.dev',
    'open',
    'member',
    [PLATFORM_ID],
    SAM,
  ),
  offer(
    'invite_growth',
    'noor.haddad@acme.dev',
    'open',
    'member',
    [GROWTH_ID],
    PRIYA,
  ),
  offer('invite_admin', 'alex.morgan@acme.dev', 'open', 'admin', [], SAM),
  offer(
    'invite_left',
    'dana.wright@contractors.io',
    'open',
    'member',
    [],
    null,
  ),
  offer(
    'invite_accepted',
    'tom.becker@acme.dev',
    'accepted',
    'member',
    [PLATFORM_ID],
    SAM,
  ),
  offer(
    'invite_revoked',
    'kim.ortiz@acme.dev',
    'revoked',
    'member',
    [PLATFORM_ID],
    SAM,
  ),
  offer(
    'invite_expired',
    'ravi.shah@acme.dev',
    'expired',
    'admin',
    [GROWTH_ID],
    PRIYA,
  ),
];

export type ClosedInvite = 'accepted' | 'revoked';

export type MembersWorld = {
  people: WorkspacePerson[];
  invites: WorkspaceInviteResponseDto[];
  closed: Record<string, ClosedInvite>;
  offers: InviteOffer[];
};

export const membersWorld = perWorld(
  (kind): MembersWorld => ({
    people: structuredClone(PEOPLE),
    invites: kind === 'empty' ? [] : structuredClone(INVITES),
    closed: {},
    offers: kind === 'empty' ? [] : structuredClone(OFFERS),
  }),
);
