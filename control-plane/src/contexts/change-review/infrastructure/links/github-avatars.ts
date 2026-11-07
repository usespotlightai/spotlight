import type { AvatarsPort } from '@change-review/application/ports/avatars.port';

const PICTURE_SIZE = 64;

export class GitHubAvatars implements AvatarsPort {
  pictureOf(login: string): string | null {
    return login
      ? `https://github.com/${encodeURIComponent(login)}.png?size=${PICTURE_SIZE}`
      : null;
  }
}
