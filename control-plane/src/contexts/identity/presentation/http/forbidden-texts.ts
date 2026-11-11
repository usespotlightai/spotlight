import type { Permission } from '@identity/domain/value-objects/permission.vo';
import type { ForbiddenText } from '@platform/http/resources/forbidden-acts';

const changing: ForbiddenText = (kind) => [
  `Not allowed to change the ${kind}`,
  `You can read this ${kind} but not change it. Your workspace role or token scopes do not allow it.`,
];

export const FORBIDDEN_TEXTS: Readonly<
  Record<Exclude<Permission, 'read'>, ForbiddenText>
> = {
  configure: changing,
  secrets: changing,
  runners: changing,
  trusts: changing,
  administer: (kind) => [
    `Not allowed to administer the ${kind}`,
    `Only workspace admins can do this. A token can never administer a ${kind}.`,
  ],
  'create-workspaces': () => [
    'Not allowed to create a workspace',
    'A workspace token cannot create a workspace. Only a person can create one.',
  ],
  plan: () => [
    'Not allowed to plan',
    'Planning needs a person or a token with the plan scope.',
  ],
};
