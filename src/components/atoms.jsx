import { atom, useAtom } from "jotai";
import axios from "axios";
import { atomWithStorage } from "jotai/utils";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const warehouseDataAtom = atom([]);
export const accessTokenAtom = atomWithStorage("accessToken", null);
export const refreshTokenAtom = atomWithStorage("refreshToken", null);
export const lastLoginDatetimeAtom = atomWithStorage(
  "lastLoginDatetime",
  dayjs()
);
export const refreshAtom = atom(false);
export const authenticatedAtom = atom(false);
authenticatedAtom.onMount = (set) => {
  set(isAuthAtom);
};

const refreshTokens = async (get, set) => {
  console.log("Refreshing Tokens");

  try {
    const response = await axios.post(
      //  try to refresh tokens, passing in refresh token
      "/token/refresh/",
      {
        refresh: get(refreshTokenAtom),
      },
      {
        headers: {
          "content-Type": "application/json",
        },
      }
    );
    if (response.status === 200) {
      // ok response
      axios.defaults.headers.common[ // set authorization header
        "Authorization"
      ] = `Bearer ${response.data.access}`;
      set(accessTokenAtom, response.data.access); // set tokens
      set(refreshTokenAtom, response.data.refresh);
      set(lastLoginDatetimeAtom, dayjs()); // set last login datetime
      return true; // successful refresh
    } else {
      // not successful refresh
      set(removeTokensAtom); // remove tokens
      return false; // unsuccessful refresh
    }
  } catch (error) {
    // refresh error
    console.log("Error refreshing tokens: ", error);
    set(removeTokensAtom); // remove tokens after error
    return false; // unsuccessful refresh
  }
};

export const isAuthAtom = atom(
  (get) => {
    get(accessTokenAtom);
    get(refreshTokenAtom);
    get(lastLoginDatetimeAtom);
  },
  (get, set) => {
    const accessToken = get(accessTokenAtom);
    const refreshToken = get(refreshTokenAtom);
    const accessExp = dayjs().subtract(14, "minutes");
    const lastLoginDatetime = dayjs(get(lastLoginDatetimeAtom));

    console.log("Checking Auth");
    console.log("Access Token: ", accessToken);

    if (get(refreshAtom) === true) {
      console.log("Refreshing Tokens");
      // received error 401. refresh?
      set(refreshAtom, false);
      if (accessExp.isAfter(lastLoginDatetime)) {
        // access token expired
        if (refreshTokens(get, set)) {
          // try to refresh tokens
          set(authenticatedAtom, true); // authenticated
        } else set(authenticatedAtom, false); // refresh failed
      } else if (accessToken !== null) {
        // possible page refreshed. access token is still valid.
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${accessToken}`;
        set(authenticatedAtom, true);
      } else set(authenticatedAtom, false);
    } else if (accessToken === null || refreshToken === null) {
      // no tokens: not authenticated
      set(authenticatedAtom, false);
    } else if (accessExp.isAfter(lastLoginDatetime)) {
      // access token is expired
      set(refreshAtom, true); // refreshing tokens
      if (refreshTokens(get, set)) {
        // if refresh success
        set(refreshAtom, false); // not refreshing tokens
        set(authenticatedAtom, true); // authenticated
      } else {
        set(refreshAtom, false); // not refreshing tokens
        set(authenticatedAtom, false); // not authenticated
      }
    } else {
      axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
      set(authenticatedAtom, true); // authenticated
    }
    console.log("Authenticated: ", get(authenticatedAtom));
  }
);

export const removeTokensAtom = atom(null, (get, set) => {
  set(accessTokenAtom, null);
  set(refreshTokenAtom, null);
  set(isAuthAtom, false);
});

export const updateWarehouseDataAtom = atom(null, async (get, set, updated) => {
  try {
    const data = await axios.get("/api/warehouse");
    set(warehouseDataAtom, data.data);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      set(refreshAtom, true);
      set(isAuthAtom);
    } else {
      console.log("Error updating warehouse data: ", error);
    }
  }
});
