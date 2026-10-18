import type { MemberResponseDto } from '@/lib/api';

export type Role = MemberResponseDto['role'];

export const nameOfRole: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export const isAdmin = (role: Role): boolean =>
  role === 'owner' || role === 'admin';
