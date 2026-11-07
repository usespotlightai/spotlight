export type DeliveryProviderOwner = 'built-in' | 'team' | 'nobody';

export const DeliveryProviders = {
  ownerOf(delivery: {
    readonly addressedToTeam: boolean;
    readonly builtIn: boolean;
  }): DeliveryProviderOwner {
    if (delivery.builtIn) {
      return delivery.addressedToTeam ? 'nobody' : 'built-in';
    }

    return delivery.addressedToTeam ? 'team' : 'nobody';
  },
};
