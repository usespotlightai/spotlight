export const allowsUrl = (
  url: { readonly isSecure: boolean },
  insecureAllowed: boolean,
): boolean => url.isSecure || insecureAllowed;
