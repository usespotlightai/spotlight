import type { LineRepositoryResponseDto } from '@/lib/api';

export const onGitHub = (name: string): LineRepositoryResponseDto => ({
  fullName: name,
  host: 'github',
  url: `https://github.com/${name}`,
});
