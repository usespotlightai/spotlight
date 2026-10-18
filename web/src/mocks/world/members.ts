import type {
  InvitePreviewResponseDto,
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

export type InvitePreview = InvitePreviewResponseDto & { token: string };

const preview = (
  token: string,
  email: string,
  status: InvitePreview['status'],
  role: InvitePreview['role'],
  teamIds: readonly string[],
  by: typeof SAM | null,
): InvitePreview => ({
  token,
  email,
  workspaceName: WORKSPACE.name,
  invitedBy: by?.name ?? null,
  role,
  teamNames: teamIds.map((teamId) => team(teamId).name),
  status,
});

const PREVIEWS: InvitePreview[] = [
  preview(
    'invite_sam',
    'Sam@Example.com',
    'pending',
    'member',
    [PLATFORM_ID, GROWTH_ID],
    PRIYA,
  ),
  preview(
    'invite_platform',
    'jordan.lee@acme.dev',
    'pending',
    'member',
    [PLATFORM_ID],
    SAM,
  ),
  preview(
    'invite_growth',
    'noor.haddad@acme.dev',
    'pending',
    'member',
    [GROWTH_ID],
    PRIYA,
  ),
  preview('invite_admin', 'alex.morgan@acme.dev', 'pending', 'admin', [], SAM),
  preview(
    'invite_left',
    'dana.wright@contractors.io',
    'pending',
    'member',
    [],
    null,
  ),
  preview(
    'invite_accepted',
    'tom.becker@acme.dev',
    'accepted',
    'member',
    [PLATFORM_ID],
    SAM,
  ),
  preview(
    'invite_revoked',
    'kim.ortiz@acme.dev',
    'revoked',
    'member',
    [PLATFORM_ID],
    SAM,
  ),
  preview(
    'invite_expired',
    'ravi.shah@acme.dev',
    'expired',
    'admin',
    [GROWTH_ID],
    PRIYA,
  ),
];

export type EndedInvite = 'accepted' | 'revoked';

export type MembersWorld = {
  people: WorkspacePerson[];
  invites: WorkspaceInviteResponseDto[];
  ended: Record<string, EndedInvite>;
  previews: InvitePreview[];
};

export const membersWorld = perWorld(
  (kind): MembersWorld => ({
    people: structuredClone(PEOPLE),
    invites: kind === 'empty' ? [] : structuredClone(INVITES),
    ended: {},
    previews: kind === 'empty' ? [] : structuredClone(PREVIEWS),
  }),
);
