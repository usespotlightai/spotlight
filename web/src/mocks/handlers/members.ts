import type { RequestHandler } from 'msw';
import type {
  AddTeamMemberRequestDto,
  ChangeMemberRoleRequestDto,
  InviteOutcomeResponseDto,
  InviteToWorkspaceRequestDto,
  WorkspaceInviteResponseDto,
  WorkspaceMemberResponseDto,
} from '@/lib/api';
import { sameAddress } from '@/lib/members';
import type { Role } from '@/lib/role';
import { daysAgo } from '@/mocks/clock';
import { api, json, noContent, notFound, problem } from '@/mocks/http';
import { scenario } from '@/mocks/scenario';
import { world } from '@/mocks/world';
import {
  INVITE_DAYS,
  membersWorld,
  type WorkspacePerson,
} from '@/mocks/world/members';
import { SIGNED_IN } from '@/mocks/world/settings';

const ROLES: readonly Role[] = ['owner', 'admin', 'member'];

const ofWorkspace = (slug: unknown) => slug === world().workspace.slug;

const administers = () => scenario().account !== 'member';

const refused = () =>
  problem(403, 'Sorry, only owners and admins can manage members.');

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const teamsOf = (personId: string) =>
  world().workspace.teams.filter((team) =>
    (world().members[team.id] ?? []).some((each) => each.id === personId),
  );

const mayBeSetToOf = (person: WorkspacePerson): Role[] =>
  !administers() || person.id === SIGNED_IN.id
    ? []
    : ROLES.filter((each) => each !== person.role);

const memberOf = (person: WorkspacePerson): WorkspaceMemberResponseDto => ({
  ...person,
  teams: teamsOf(person.id),
  mayBeSetTo: mayBeSetToOf(person),
});

const inviter = () => ({
  id: SIGNED_IN.id,
  name: SIGNED_IN.name,
  image: SIGNED_IN.image,
});

const offeredFor = (
  email: string,
  terms: InviteToWorkspaceRequestDto,
): WorkspaceInviteResponseDto => ({
  id: `invite_${crypto.randomUUID().slice(0, 8)}`,
  email,
  role: terms.role,
  teams: world().workspace.teams.filter((team) =>
    terms.teamIds.includes(team.id),
  ),
  invitedBy: inviter(),
  invitedAt: daysAgo(0),
  expiresAt: daysAgo(-INVITE_DAYS),
});

const sentAgain = (invite: WorkspaceInviteResponseDto) => {
  invite.invitedAt = daysAgo(0);
  invite.expiresAt = daysAgo(-INVITE_DAYS);
  invite.invitedBy = inviter();
};

const bounces = (email: string): boolean =>
  email.trim().toLowerCase().startsWith('bounce@');

const inviteOne = (
  email: string,
  terms: InviteToWorkspaceRequestDto,
): InviteOutcomeResponseDto['outcome'] => {
  const store = membersWorld();

  if (store.people.some((each) => sameAddress(each.email, email))) {
    return 'already-a-member';
  }

  const pending = store.invites.find((each) => sameAddress(each.email, email));
  if (pending) {
    sentAgain(pending);
  } else {
    store.invites.unshift(offeredFor(email, terms));
  }

  if (bounces(email)) {
    return 'not-sent';
  }

  return pending ? 'sent-again' : 'invited';
};

const inviteHandlers = [
  api.get('/workspaces/:slug/invites', ({ params }) => {
    if (!ofWorkspace(params.slug)) {
      return notFound();
    }

    return administers() ? json(membersWorld().invites) : notFound();
  }),

  api.post('/workspaces/:slug/invites', async ({ params, request }) => {
    if (!ofWorkspace(params.slug)) {
      return notFound();
    }
    if (!administers()) {
      return refused();
    }

    const terms = (await request.json()) as InviteToWorkspaceRequestDto;
    const strangers = terms.teamIds.filter(
      (teamId) => !world().workspace.teams.some((team) => team.id === teamId),
    );
    if (terms.emails.length === 0 || terms.emails.length > 50) {
      return problem(422, 'Sorry, invite between 1 and 50 addresses at once.');
    }
    if (terms.emails.some((each) => !ADDRESS.test(each))) {
      return problem(422, 'Sorry, every address must be an email address.');
    }
    if (strangers.length > 0) {
      return problem(422, 'Sorry, those teams are not in this workspace.');
    }

    return json({
      outcomes: terms.emails.map((email) => ({
        email,
        outcome: inviteOne(email, terms),
      })),
    });
  }),

  api.post('/workspaces/:slug/invites/:inviteId/resend', ({ params }) => {
    const invite = membersWorld().invites.find(
      (each) => each.id === params.inviteId,
    );
    if (!ofWorkspace(params.slug) || !invite || !administers()) {
      return notFound();
    }

    sentAgain(invite);
    return json(invite);
  }),

  api.delete('/workspaces/:slug/invites/:inviteId', ({ params }) => {
    const store = membersWorld();
    if (
      !ofWorkspace(params.slug) ||
      !store.invites.some((each) => each.id === params.inviteId)
    ) {
      return notFound();
    }

    store.invites = store.invites.filter((each) => each.id !== params.inviteId);
    return noContent();
  }),

  api.get('/invites/:token', ({ params }) => {
    const found = membersWorld().offers.find(
      (each) => each.token === params.token,
    );
    if (!found) {
      return notFound();
    }

    const { token: _token, ...offer } = found;
    return json(offer);
  }),

  api.post('/invites/:token/accept', ({ params }) => {
    const found = membersWorld().offers.find(
      (each) => each.token === params.token,
    );
    if (!found) {
      return notFound();
    }
    if (found.standing !== 'open') {
      return problem(409, `Sorry, this invitation is ${found.standing}.`);
    }

    found.standing = 'accepted';
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
      const person = membersWorld().people.find(
        (each) => each.id === params.userId,
      );
      if (!ofWorkspace(params.slug) || !person) {
        return notFound();
      }

      const { role } = (await request.json()) as ChangeMemberRoleRequestDto;
      if (role !== person.role && !mayBeSetToOf(person).includes(role)) {
        return problem(403, `Sorry, ${person.name} can’t be made ${role}.`);
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
      return problem(422, 'Sorry, they are not in this workspace.');
    }
    if (team.some((each) => each.id === userId)) {
      return problem(409, `Sorry, ${person.name} is already on this team.`);
    }

    team.push({
      id: person.id,
      name: person.name,
      image: person.image,
      role: person.role,
      mayBeSetTo: mayBeSetToOf(person).filter((each) => each !== person.role),
    });
    return noContent();
  }),
];

export const membersHandlers: RequestHandler[] = [
  ...inviteHandlers,
  ...memberHandlers,
];
