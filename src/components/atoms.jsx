import { atom, useAtom } from "jotai";
import axios from "axios";
import { atomWithStorage } from "jotai/utils";
import dayjs from "dayjs";
import { fetchWarehouseData } from "../actions.jsx";

const refreshTokens = async (get, set) => {
  console.log("Refreshing Tokens");

  try {
    const response = await axios.post(
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
      console.log("New Tokens: ", response);
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.access}`;
      set(accessTokenAtom, response.data.access);
      set(refreshTokenAtom, response.data.refresh);
      set(lastLoginDatetimeAtom, dayjs());
      return true;
    } else {
      set(removeTokensAtom);
      return false;
    }
  } catch (error) {
    console.log("Error refreshing tokens: ", error);
    set(removeTokensAtom);
    return false;
  }
};

export const accessTokenAtom = atomWithStorage("accessToken", null);
export const refreshTokenAtom = atomWithStorage("refreshToken", null);
export const lastLoginDatetimeAtom = atomWithStorage(
  "lastLoginDatetime",
  dayjs()
);
export const refreshAtom = atom(false);

export const isAuthAtom = atom(null, (get, set, updatedAccessToken) => {
  const accessToken = get(accessTokenAtom);
  const refreshToken = get(refreshTokenAtom);
  const accessExp = dayjs().subtract(14, "minutes");
  const lastLoginDatetime = dayjs(get(lastLoginDatetimeAtom));
  if (get(refreshAtom) === true) {
    set(refreshAtom, false);
    if (refreshTokens(get, set)) {
      return true;
    } else return false;
  } else if (accessToken === null || refreshToken === null) {
    return false;
  } else if (accessExp.isAfter(lastLoginDatetime)) {
    console.log("access token is expired, try to refresh.");
    set(refreshAtom, true);
    if (refreshTokens(get, set)) {
      set(refreshAtom, false);
      return true;
    } else {
      set(refreshAtom, false);
      return false;
    }
  }
  return true;
});

export const removeTokensAtom = atom(null, (get, set) => {
  set(accessTokenAtom, null);
  set(refreshTokenAtom, null);
});

export const warehouseDataAtom = atom([]);

export const updateWarehouseDataAtom = atom(null, async (get, set, updated) => {
  try {
    const data = await fetchWarehouseData();
    set(warehouseDataAtom, data);
  } catch (error) {
    console.error(error);
  }
});
