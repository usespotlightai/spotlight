import type { RequestHandler } from 'msw';
import type {
  AddTeamMemberRequestDto,
  ChangeMemberRoleRequestDto,
  InviteOutcomeResponseDto,
  InviteToWorkspaceRequestDto,
  WorkspaceInviteResponseDto,
  WorkspaceMemberResponseDto,
} from '@/lib/api';
import {
  isEmailAddress,
  MAX_INVITED_AT_ONCE,
  sameAddress,
} from '@/lib/members';
import type { Role } from '@/lib/role';
import { daysAgo } from '@/mocks/clock';
import { api, json, noContent, notFound, problem } from '@/mocks/http';
import { scenario } from '@/mocks/scenario';
import { world } from '@/mocks/world';
import {
  type EndedInvite,
  INVITE_DAYS,
  membersWorld,
  type WorkspacePerson,
} from '@/mocks/world/members';
import { SIGNED_IN } from '@/mocks/world/settings';

const ROLES: readonly Role[] = ['owner', 'admin', 'member'];

const ofWorkspace = (slug: unknown) => slug === world().workspace.slug;

const isAdmin = () => scenario().account !== 'member';

const NOT_PENDING_BECAUSE: Record<EndedInvite | 'expired', string> = {
  accepted: 'This invite has already been accepted.',
  revoked: 'This invite has been revoked.',
  expired: 'This invite has expired. Please request a new one.',
};

const endedInvite = (inviteId: unknown) =>
  membersWorld().ended[String(inviteId)];

const pendingInvite = (inviteId: unknown) =>
  membersWorld().invites.find((each) => each.id === inviteId);

const teamNamed = (teamId: string) =>
  world().workspace.teams.find((team) => team.id === teamId)?.name ?? teamId;

const RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

const LAST_OWNER =
  'The workspace needs at least one owner. Please make someone else an owner first.';

const myRole = (): Role =>
  isAdmin()
    ? (membersWorld().people.find((each) => each.id === SIGNED_IN.id)?.role ??
      'owner')
    : 'member';

const lastOwner = (person: WorkspacePerson) =>
  person.role === 'owner' &&
  membersWorld().people.filter((each) => each.role === 'owner').length === 1;

type RoleAssignmentDenial = readonly [status: number, detail: string];

const roleAssignmentDenial = (
  person: WorkspacePerson,
  role: Role,
): RoleAssignmentDenial | null => {
  const mine = myRole();

  if (RANK[mine] < RANK.admin) {
    return [403, 'Only an owner or an admin can set roles.'];
  }
  if (person.role === role) {
    return null;
  }
  if (!(mine === 'owner' || RANK[mine] > RANK[person.role])) {
    return person.id === SIGNED_IN.id
      ? [403, 'You cannot change your own role.']
      : [403, 'You can only set roles for people below you.'];
  }
  if (RANK[mine] < RANK[role]) {
    return [403, 'You cannot assign a role above your own.'];
  }
  if (lastOwner(person) && role !== 'owner') {
    return [409, LAST_OWNER];
  }

  return null;
};

const teamsOf = (personId: string) =>
  world().workspace.teams.filter((team) =>
    (world().members[team.id] ?? []).some((each) => each.id === personId),
  );

const assignableRolesOf = (person: WorkspacePerson): Role[] => {
  const assignable = ROLES.filter(
    (each) => !roleAssignmentDenial(person, each),
  );

  return assignable.length > 1 ? assignable : [];
};

const memberOf = (person: WorkspacePerson): WorkspaceMemberResponseDto => ({
  ...person,
  teams: teamsOf(person.id),
  assignableRoles: assignableRolesOf(person),
});

const inviter = () => ({
  id: SIGNED_IN.id,
  name: SIGNED_IN.name,
  image: SIGNED_IN.image,
});

const createdFor = (
  email: string,
  spec: InviteToWorkspaceRequestDto,
): WorkspaceInviteResponseDto => ({
  id: `invite_${crypto.randomUUID().slice(0, 8)}`,
  email,
  role: spec.role,
  teams: world().workspace.teams.filter((team) =>
    spec.teamIds.includes(team.id),
  ),
  invitedBy: inviter(),
  invitedAt: daysAgo(0),
  expiresAt: daysAgo(-INVITE_DAYS),
});

const resend = (invite: WorkspaceInviteResponseDto) => {
  invite.invitedAt = daysAgo(0);
  invite.expiresAt = daysAgo(-INVITE_DAYS);
  invite.invitedBy = inviter();
};

const bounces = (email: string): boolean =>
  email.trim().toLowerCase().startsWith('bounce@');

const inviteOne = (
  email: string,
  spec: InviteToWorkspaceRequestDto,
): InviteOutcomeResponseDto['outcome'] => {
  const store = membersWorld();

  if (store.people.some((each) => sameAddress(each.email, email))) {
    return 'already-a-member';
  }

  const pending = store.invites.find((each) => sameAddress(each.email, email));
  if (pending) {
    resend(pending);
  } else {
    store.invites.unshift(createdFor(email, spec));
  }

  if (bounces(email)) {
    return 'not-sent';
  }

  return pending ? 'resent' : 'invited';
};

const inviteHandlers = [
  api.get('/workspaces/:slug/invites', ({ params }) => {
    if (!ofWorkspace(params.slug)) {
      return notFound();
    }

    return isAdmin() ? json(membersWorld().invites) : notFound();
  }),

  api.post('/workspaces/:slug/invites', async ({ params, request }) => {
    if (!ofWorkspace(params.slug)) {
      return notFound();
    }
    if (!isAdmin()) {
      return notFound();
    }

    const spec = (await request.json()) as InviteToWorkspaceRequestDto;
    const unknownTeam = spec.teamIds.find(
      (teamId) => !world().workspace.teams.some((team) => team.id === teamId),
    );
    const notAnAddress = spec.emails.find(
      (each) => !isEmailAddress(each.trim().toLowerCase()),
    );
    if (spec.emails.length === 0 || spec.emails.length > MAX_INVITED_AT_ONCE) {
      return problem(
        422,
        `Number of email addresses must be 1 to ${MAX_INVITED_AT_ONCE}. Received: ${spec.emails.length}`,
      );
    }
    if ((spec.role as Role) === 'owner') {
      return problem(
        403,
        'Nobody can be invited as an owner. Please invite them as an admin, then make them an owner.',
      );
    }
    if (notAnAddress !== undefined) {
      return problem(
        422,
        `Email address is not valid. Received: ${notAnAddress.trim()}`,
      );
    }
    if (unknownTeam) {
      return problem(422, `Team ${unknownTeam} is not in this workspace.`);
    }

    return json({
      outcomes: spec.emails.map((email) => ({
        email,
        outcome: inviteOne(email, spec),
      })),
    });
  }),

  api.post('/workspaces/:slug/invites/:inviteId/resend', ({ params }) => {
    if (!ofWorkspace(params.slug) || !isAdmin()) {
      return notFound();
    }

    const ended = endedInvite(params.inviteId);
    if (ended) {
      return problem(409, NOT_PENDING_BECAUSE[ended]);
    }

    const invite = pendingInvite(params.inviteId);
    if (!invite) {
      return notFound();
    }

    resend(invite);
    return json(invite);
  }),

  api.delete('/workspaces/:slug/invites/:inviteId', ({ params }) => {
    if (!ofWorkspace(params.slug) || !isAdmin()) {
      return notFound();
    }

    const store = membersWorld();
    const ended = endedInvite(params.inviteId);
    if (ended === 'accepted') {
      return problem(409, NOT_PENDING_BECAUSE.accepted);
    }
    if (ended === 'revoked') {
      return noContent();
    }
    if (!pendingInvite(params.inviteId)) {
      return notFound();
    }

    store.invites = store.invites.filter((each) => each.id !== params.inviteId);
    store.ended[String(params.inviteId)] = 'revoked';
    return noContent();
  }),

  api.get('/invites/:token', ({ params }) => {
    const found = membersWorld().previews.find(
      (each) => each.token === params.token,
    );
    if (!found) {
      return notFound();
    }

    const { token: _token, ...preview } = found;
    return json(preview);
  }),

  api.post('/invites/:token/accept', ({ params }) => {
    const found = membersWorld().previews.find(
      (each) => each.token === params.token,
    );
    if (!found) {
      return notFound();
    }
    if (found.status !== 'pending') {
      return problem(409, NOT_PENDING_BECAUSE[found.status]);
    }

    const store = membersWorld();
    const pending = store.invites.find((each) =>
      sameAddress(each.email, found.email),
    );
    found.status = 'accepted';
    if (pending) {
      store.invites = store.invites.filter((each) => each !== pending);
      store.ended[pending.id] = 'accepted';
    }
    return json({ workspaceSlug: world().workspace.slug });
  }),
];

const memberHandlers = [
  api.get('/workspaces/:slug/members', ({ params }) => {
    if (!ofWorkspace(params.slug)) {
      return notFound();
    }

    return json(membersWorld().people.map(memberOf));
  }),

  api.patch(
    '/workspaces/:slug/members/:userId',
    async ({ params, request }) => {
      if (!ofWorkspace(params.slug)) {
        return notFound();
      }

      const person = membersWorld().people.find(
        (each) => each.id === params.userId,
      );
      if (!person) {
        return problem(403, 'This person is not a member of this workspace.');
      }

      const { role } = (await request.json()) as ChangeMemberRoleRequestDto;
      const denial = roleAssignmentDenial(person, role);
      if (denial) {
        return problem(...denial);
      }

      person.role = role;
      for (const each of Object.values(world().members).flat()) {
        if (each.id === person.id) {
          each.role = role;
        }
      }

      return noContent();
    },
  ),

  api.post('/teams/:teamId/members', async ({ params, request }) => {
    const teamId = String(params.teamId);
    const { userId } = (await request.json()) as AddTeamMemberRequestDto;
    const person = membersWorld().people.find((each) => each.id === userId);
    const team = world().members[teamId];
    if (!team) {
      return notFound();
    }
    if (!person) {
      return problem(
        422,
        'This person is not a member of this workspace. Please invite them first.',
      );
    }
    if (team.some((each) => each.id === userId)) {
      return problem(409, `${teamNamed(teamId)} already includes this person.`);
    }

    team.push({
      id: person.id,
      name: person.name,
      image: person.image,
      role: person.role,
      assignableRoles: assignableRolesOf(person).filter(
        (each) => each !== person.role,
      ),
    });
    return noContent();
  }),
];

export const membersHandlers: RequestHandler[] = [
  ...inviteHandlers,
  ...memberHandlers,
];
