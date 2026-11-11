import { perWorld } from '@/mocks/world';

export const WORKSPACE_AVATAR = 'workspace';

export const avatars = perWorld(() => new Map<string, string>());
