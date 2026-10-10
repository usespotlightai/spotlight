import type { ChangeStackResponseDto, CodeReviewResponseDto } from '@/lib/api';

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const patch = (header: string, lines: string[]): string =>
  [header, ...lines].join('\n');

export const INVITATIONS: ChangeStackResponseDto = {
  id: 'stack_invitations',
  repository: null,
  state: 'ready',
  failure: null,
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
          ranges: [{ hunk: 'h1' }],
          notes: [
            {
              path: 'control-plane/src/schemas/invitation.schema.ts',
              note: 'Adds the invitation table. The token is unique, so accepting can look an invitation up by token alone.',
            },
          ],
        },
        {
          id: 'c1.l2',
          title: 'Add the invitation API and emails',
          summary:
            'Endpoints to invite and to accept, the invitation email, and the admin-only permission gate.',
          ranges: [{ hunk: 'h2' }, { hunk: 'h3' }],
          notes: [
            {
              path: 'control-plane/src/invitations/invitation.controller.ts',
              note: 'Adds the invite and accept endpoints. Only admins may invite; anyone holding a token may accept.',
            },
            {
              path: 'control-plane/src/mail/invitation.mail.ts',
              note: 'Adds the email an invited person receives, carrying the link that accepts the invitation.',
            },
          ],
        },
        {
          id: 'c1.l3',
          title: 'Build the invite & members UI',
          summary:
            'Admins see an invite form on the members page, and everyone sees who is still to accept.',
          ranges: [{ hunk: 'h4' }],
          notes: [
            {
              path: 'web/src/routes/TeamMembers.tsx',
              note: 'Shows admins the invite form on the members page, and lists invitations still waiting to be accepted.',
            },
          ],
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
          ranges: [{ hunk: 'h5' }],
          notes: [],
        },
      ],
    },
  ],
};

const GENERATED_LINES = 20_000;

export const LARGE_FILE: ChangeStackResponseDto = {
  ...INVITATIONS,
  id: 'stack_generated',
  files: [
    ...INVITATIONS.files,
    {
      path: 'web/src/lib/api/types.gen.ts',
      previousPath: null,
      status: 'modified',
      binary: false,
      hunks: [
        {
          id: 'h6',
          oldStart: 1,
          oldLines: 0,
          newStart: 1,
          newLines: GENERATED_LINES,
          patch: patch(
            `@@ -1,0 +1,${GENERATED_LINES} @@`,
            Array.from(
              { length: GENERATED_LINES },
              (_, at) => `+export type Generated${at} = { id: string };`,
            ),
          ),
        },
      ],
    },
  ],
  cohorts: INVITATIONS.cohorts.map((cohort) =>
    cohort.id === 'c1'
      ? {
          ...cohort,
          layers: cohort.layers.map((layer) =>
            layer.id === 'c1.l1'
              ? {
                  ...layer,
                  ranges: [...layer.ranges, { hunk: 'h6', summary: null }],
                  notes: [
                    ...layer.notes,
                    {
                      path: 'web/src/lib/api/types.gen.ts',
                      note: 'Regenerates the API client for the new endpoints.',
                    },
                  ],
                }
              : layer,
          ),
        }
      : cohort,
  ),
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
      byAgent: false,
      replyTo: null,
      state: 'posted',
      failure: null,
      url: 'https://github.com/acme/api/pull/42#discussion_r1',
      createdAt: minutesAgo(40),
      editedAt: null,
    },
    {
      id: 'comment_expiry_agent',
      path: 'control-plane/src/schemas/invitation.schema.ts',
      side: 'new',
      line: 9,
      startLine: null,
      body: 'Nothing sets `expiresAt` when an invitation is resent, so a resent one expires on the first date.',
      authorName: 'Spotlight',
      authorLogin: null,
      authorImage: null,
      yours: false,
      byAgent: true,
      replyTo: null,
      state: 'posted',
      failure: null,
      url: 'https://github.com/acme/api/pull/42#discussion_r2',
      createdAt: minutesAgo(30),
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
      byAgent: false,
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
      byAgent: false,
      replyTo: null,
      state: 'draft',
      failure: null,
      url: null,
      createdAt: minutesAgo(1),
      editedAt: null,
    },
  ],
};
