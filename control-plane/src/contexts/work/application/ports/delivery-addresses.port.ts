export const DELIVERY_ADDRESSES = Symbol('DELIVERY_ADDRESSES');

export interface DeliveryAddressesPort {
  of(slug: string, teamKey: string, source: string): string;
}
