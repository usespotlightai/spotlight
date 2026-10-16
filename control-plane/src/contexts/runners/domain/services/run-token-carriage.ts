export const carriesRunTokens = (
  url: { readonly isSecure: boolean },
  insecureAllowed: boolean,
): boolean => url.isSecure || insecureAllowed;
