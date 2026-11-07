import { applyDecorators, SetMetadata } from '@nestjs/common';

export const ALLOW_ANONYMOUS = Symbol('ALLOW_ANONYMOUS');

export const READS_SESSION_IF_ANY = Symbol('READS_SESSION_IF_ANY');

export const AllowAnonymous = (options: { readsSession?: boolean } = {}) =>
  options.readsSession
    ? applyDecorators(
        SetMetadata(ALLOW_ANONYMOUS, true),
        SetMetadata(READS_SESSION_IF_ANY, true),
      )
    : SetMetadata(ALLOW_ANONYMOUS, true);
