export const AVATARS = Symbol('AVATARS');

export interface AvatarsPort {
  pictureOf(login: string): string | null;
}
