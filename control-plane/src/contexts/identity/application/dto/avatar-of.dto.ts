export type AvatarOf =
  | { readonly kind: 'workspace'; readonly slug: string }
  | { readonly kind: 'team'; readonly teamId: string };
