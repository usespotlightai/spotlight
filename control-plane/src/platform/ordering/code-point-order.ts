export const inCodePointOrder = (one: string, other: string): number => {
  const ones = one[Symbol.iterator]();
  const others = other[Symbol.iterator]();

  for (;;) {
    const mine = ones.next();
    const theirs = others.next();

    if (mine.done || theirs.done) {
      return Number(theirs.done) - Number(mine.done);
    }

    const apart =
      (mine.value.codePointAt(0) ?? 0) - (theirs.value.codePointAt(0) ?? 0);

    if (apart !== 0) {
      return apart;
    }
  }
};

export const inCodePointOrderOf =
  <T>(key: (each: T) => string) =>
  (one: T, other: T): number =>
    inCodePointOrder(key(one), key(other));
