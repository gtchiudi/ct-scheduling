import { atom, useAtom } from "jotai";
import axios from "axios";
import { atomWithStorage } from "jotai/utils";
import dayjs from "dayjs";

const fetchWarehouseData = async () => {
  try {
    const response = await axios.get("/api/warehouse");
    return response.data;
  } catch (error) {
    throw error;
  }
};
const refreshTokens = async () => {
  const [access_token, setAccessToken] = useAtom(accessTokenAtom);
  const [refresh_token, setRefreshToken] = useAtom(refreshTokenAtom);

  try {
    const response = await axios.post(
      "/token/refresh/",
      {
        refresh: refresh_token,
      },
      {
        headers: {
          "content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    if (response.status === 200) {
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data["access"]}`;
      setAccessToken(response.data.access);
      setRefreshToken(response.data.refresh);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    throw error;
  }
};

const expirationTime = 15 * 60 * 1000; // 15 minutes in milliseconds

export const accessTokenAtom = atomWithStorage("accessToken", null);
export const refreshTokenAtom = atomWithStorage("refreshToken", null);
export const lastLoginDatetimeAtom = atomWithStorage("lastLoginDatetime", null);
export const logoutSentAtom = atom(false);

export const areTokensExpiredAtom = atom(null, (get, set, updated) => {
  const lastLoginDatetime = get(lastLoginDatetimeAtom);
  if (lastLoginDatetime === null) {
    set(removeTokensAtom, null); // Remove tokens if lastLoginDatetime is null
    return true;
  }
  const fifteenMinAgo = dayjs().subtract(15, "minutes");
  if (lastLoginDatetime.isBefore(fifteenMinAgo)) {
    let gotNewTokens = refreshTokens();
    if (gotNewTokens === true) {
      set(lastLoginDatetimeAtom, now);
      return false;
    } else {
      set(removeTokensAtom);
      return true;
    }
  } else {
    return false;
  }
});

export const isAuthAtom = atom(
  (get) => {
    const accessToken = get(accessTokenAtom);
    return accessToken !== null;
  },
  (get, set, updatedAccessToken) => {}
);

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
