import { SetMetadata } from '@nestjs/common';

export const ALLOW_WORKSPACE_TOKENS = Symbol('ALLOW_WORKSPACE_TOKENS');

export const AllowWorkspaceTokens = () =>
  SetMetadata(ALLOW_WORKSPACE_TOKENS, true);
