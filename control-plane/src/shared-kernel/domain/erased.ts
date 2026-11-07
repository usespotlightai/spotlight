declare const erasedBrand: unique symbol;

export type Erased<A> = A & { readonly [erasedBrand]: true };

export const erasedAs = <A>(aggregate: A): Erased<A> => aggregate as Erased<A>;
