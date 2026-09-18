import type { MemberResponseDto } from '@/lib/api';

export type Role = MemberResponseDto['role'];

export const nameOfRole: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};
