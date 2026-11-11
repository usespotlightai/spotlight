export type DeliveryReceipt =
  | { readonly kind: 'refused' }
  | { readonly kind: 'answered'; readonly body: string }
  | { readonly kind: 'accepted' };
