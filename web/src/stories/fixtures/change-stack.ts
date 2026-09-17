import type { QueryClient } from '@tanstack/react-query';
import { changeStackKeys } from '@/hooks/api/useRunChangeStacks';
import { reviewKeys } from '@/hooks/api/useRunReview';
import type {
  ChangeStackResponseDto,
  CodeReviewResponseDto,
  RunChangeStacksResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { RUN_ID, seedRun } from '@/stories/fixtures/run';

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const patch = (header: string, lines: string[]): string =>
  [header, ...lines].join('\n');

export const INVITATIONS: ChangeStackResponseDto = {
  id: 'stack_invitations',
  repository: null,
  state: 'ready',
  failure: null,
  draftedAt: minutesAgo(6),
  settledAt: minutesAgo(5),
  check: null,
  files: [
    {
      path: 'control-plane/src/schemas/invitation.schema.ts',
      previousPath: null,
      status: 'added',
      binary: false,
      hunks: [
        {
          id: 'h1',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 11,
          patch: patch('@@ -0,0 +1,11 @@', [
            "+import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';",
            '+',
            "+export const invitation = pgTable('invitation', {",
            "+  id: text('id').primaryKey(),",
            "+  teamId: text('team_id').notNull(),",
            "+  email: text('email').notNull(),",
            "+  token: text('token').notNull().unique(),",
            "+  role: text('role').notNull(),",
            "+  expiresAt: timestamp('expires_at').notNull(),",
            "+  acceptedAt: timestamp('accepted_at'),",
            '+});',
          ]),
        },
      ],
    },
    {
      path: 'control-plane/src/invitations/invitation.controller.ts',
      previousPath: null,
      status: 'added',
      binary: false,
      hunks: [
        {
          id: 'h2',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 12,
          patch: patch('@@ -0,0 +1,12 @@', [
            "+@Controller('teams/:teamId/invitations')",
            '+export class InvitationController {',
            '+  constructor(private readonly invitations: Invitations) {}',
            '+',
            '+  @Post()',
            "+  @Roles('admin')",
            '+  invite(@Param() { teamId }: TeamParams, @Body() body: InviteDto) {',
            '+    return this.invitations.invite(teamId, body.email, body.role);',
            '+  }',
            '+',
            "+  @Post(':token/accept')",
            '+  accept(@Param() { token }: TokenParams) { return this.invitations.accept(token); }',
          ]),
        },
      ],
    },
    {
      path: 'control-plane/src/mail/invitation.mail.ts',
      previousPath: null,
      status: 'added',
      binary: false,
      hunks: [
        {
          id: 'h3',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 5,
          patch: patch('@@ -0,0 +1,5 @@', [
            '+export const invitationMail = (team: string, link: string) => ({',
            "+  subject: 'Join ' + team + ' on Spotlight',",
            "+  text: 'You have been invited to ' + team + '. Accept: ' + link,",
            '+});',
            '+',
          ]),
        },
      ],
    },
    {
      path: 'web/src/routes/TeamMembers.tsx',
      previousPath: null,
      status: 'modified',
      binary: false,
      hunks: [
        {
          id: 'h4',
          oldStart: 18,
          oldLines: 4,
          newStart: 18,
          newLines: 6,
          patch: patch('@@ -18,4 +18,6 @@ export function TeamMembers() {', [
            '       <PageHeader title="Members" />',
            '-      <MemberList members={members} />',
            '+      <MemberList members={members} />',
            '+      {isAdmin && <InviteForm teamId={teamId} />}',
            '+      <PendingInvitations teamId={teamId} />',
            '     </div>',
          ]),
        },
      ],
    },
    {
      path: 'web/package-lock.json',
      previousPath: null,
      status: 'modified',
      binary: false,
      hunks: [
        {
          id: 'h5',
          oldStart: 1204,
          oldLines: 3,
          newStart: 1204,
          newLines: 3,
          patch: patch('@@ -1204,3 +1204,3 @@', [
            '     "node_modules/zod": {',
            '-      "version": "4.4.2",',
            '+      "version": "4.4.3",',
          ]),
        },
      ],
    },
  ],
  cohorts: [
    {
      id: 'c1',
      kind: 'change',
      title: 'Team invitations',
      intent:
        'Let admins invite people to a team by email, and let the invited accept with a one-time link.',
      layers: [
        {
          id: 'c1.l1',
          title: 'Add the invitation data model',
          summary:
            'A table for pending invitations, each with a unique token, the role it grants and when it expires.',
          dependsOn: [],
          ranges: [
            {
              hunk: 'h1',
              summary:
                'The token is unique, so accepting looks an invitation up by token alone.',
            },
          ],
        },
        {
          id: 'c1.l2',
          title: 'Add the invitation API and emails',
          summary:
            'Endpoints to invite and to accept, the invitation email, and the admin-only permission gate.',
          dependsOn: [{ layer: 'c1.l1', because: ['invitation'] }],
          ranges: [
            {
              hunk: 'h2',
              summary:
                'Only admins may invite; anyone holding a token may accept.',
            },
            { hunk: 'h3', summary: null },
          ],
        },
        {
          id: 'c1.l3',
          title: 'Build the invite & members UI',
          summary:
            'Admins see an invite form on the members page, and everyone sees who is still to accept.',
          dependsOn: [
            {
              layer: 'c1.l2',
              because: ['POST /teams/:teamId/invitations'],
            },
          ],
          ranges: [{ hunk: 'h4', summary: null }],
        },
      ],
    },
    {
      id: 'c2',
      kind: 'incidental',
      title: 'Dependency bump',
      intent: 'The lockfile picked up a patch release of zod.',
      layers: [
        {
          id: 'c2.l1',
          title: 'Update the lockfile',
          summary: 'A patch release of zod, with no code depending on it.',
          dependsOn: [],
          ranges: [{ hunk: 'h5', summary: null }],
        },
      ],
    },
  ],
};

const seedStacks = (
  client: QueryClient,
  stacks: RunChangeStacksResponseDto,
) => {
  seedRun(client);
  client.setQueryData(changeStackKeys.forRun(RUN_ID), stacks);
};

export const checkedChangeStack = (client: QueryClient) =>
  seedStacks(client, {
    stacks: [
      {
        ...INVITATIONS,
        check: {
          command: 'npx tsc --noEmit',
          state: 'checked',
          reason: null,
          whole: { step: 'whole', passed: true, output: '', tookMs: 41_000 },
          layers: [
            { step: 'c1.l1', passed: true, output: '', tookMs: 38_000 },
            {
              step: 'c1.l2',
              passed: false,
              output: [
                "src/invitations/invitation.mail.ts(4,23): error TS2304: Cannot find name 'InvitationRole'.",
                "src/invitations/invitations.controller.ts(18,5): error TS2339: Property 'invite' does not exist on type 'InvitationService'.",
              ].join('\n'),
              tookMs: 39_000,
            },
            { step: 'c1.l3', passed: true, output: '', tookMs: 41_000 },
          ],
        },
      },
    ],
  });

export const checkingChangeStack = (client: QueryClient) =>
  seedStacks(client, {
    stacks: [
      {
        ...INVITATIONS,
        check: {
          command: 'npx tsc --noEmit',
          state: 'waiting',
          reason: null,
          whole: null,
          layers: [],
        },
      },
    ],
  });

export const seedChangeStack = (client: QueryClient) =>
  seedStacks(client, { stacks: [INVITATIONS] });

export const draftingChangeStack = (client: QueryClient) =>
  seedStacks(client, {
    stacks: [
      {
        ...INVITATIONS,
        state: 'drafting',
        settledAt: null,
        cohorts: [],
      },
    ],
  });

export const emptyChangeStack = (client: QueryClient) =>
  seedStacks(client, { stacks: [] });

export const failChangeStack = (client: QueryClient) => {
  seedRun(client);
  failQuery(client, changeStackKeys.forRun(RUN_ID));
};

export const REVIEW: CodeReviewResponseDto = {
  pullRequest: 'https://github.com/acme/api/pull/42',
  reviews: [],
  comments: [
    {
      id: 'comment_expiry',
      path: 'control-plane/src/schemas/invitation.schema.ts',
      side: 'new',
      line: 9,
      startLine: 7,
      body: 'Should an invitation that has expired still be listed as pending?',
      authorName: 'octocat',
      authorLogin: 'octocat',
      authorImage: 'https://github.com/octocat.png?size=64',
      yours: false,
      replyTo: null,
      state: 'posted',
      failure: null,
      url: 'https://github.com/acme/api/pull/42#discussion_r1',
      createdAt: minutesAgo(40),
      editedAt: null,
    },
    {
      id: 'comment_expiry_reply',
      path: 'control-plane/src/schemas/invitation.schema.ts',
      side: 'new',
      line: 9,
      startLine: 7,
      body: 'No — the members page filters them out.',
      authorName: 'Ada Lovelace',
      authorLogin: null,
      authorImage: null,
      yours: true,
      replyTo: 'comment_expiry',
      state: 'sending',
      failure: null,
      url: null,
      createdAt: minutesAgo(2),
      editedAt: null,
    },
    {
      id: 'comment_roles',
      path: 'control-plane/src/invitations/invitation.controller.ts',
      side: 'new',
      line: 6,
      startLine: null,
      body: 'Owners should be able to invite too, not only admins.',
      authorName: 'Ada Lovelace',
      authorLogin: null,
      authorImage: null,
      yours: true,
      replyTo: null,
      state: 'draft',
      failure: null,
      url: null,
      createdAt: minutesAgo(1),
      editedAt: null,
    },
  ],
};

export const reviewedChangeStack = (client: QueryClient) => {
  seedChangeStack(client);
  client.setQueryData(reviewKeys.forRun(RUN_ID), REVIEW);
};
