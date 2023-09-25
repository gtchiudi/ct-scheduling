import { atom } from "jotai";

export const accessTokenAtom = atom(null);
export const refreshTokenAtom = atom(null);
export const isAuthAtom = atom(
  (get) => {
    const accessToken = get(accessTokenAtom);
    return accessToken !== null;
  },
  (get, set, updatedAccessToken) => {}
);
export const removeTokensAtom = atom(null, (get, set, updatedAccessToken) => {
  set(accessTokenAtom, null);
  set(refreshTokenAtom, null);
});
