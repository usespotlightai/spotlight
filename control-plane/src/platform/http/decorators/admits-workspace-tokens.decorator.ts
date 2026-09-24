import { SetMetadata } from '@nestjs/common';

export const ADMITS_WORKSPACE_TOKENS = Symbol('ADMITS_WORKSPACE_TOKENS');

export const AdmitsWorkspaceTokens = () =>
  SetMetadata(ADMITS_WORKSPACE_TOKENS, true);
