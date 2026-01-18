import { atom } from "jotai";
import axios from "axios";
import { atomWithStorage} from "jotai/utils";
import dayjs from "dayjs";

export const warehouseDataAtom = atomWithStorage("warehouseData", [], undefined, {getOnInit: true});
export const warehouseCheckedAtom = atomWithStorage("warehouseChecked", [], undefined, {getOnInit: true});
export const accessTokenAtom = atomWithStorage("accessToken", null, undefined, {getOnInit: true});
export const refreshTokenAtom = atomWithStorage("refreshToken", null, undefined, {getOnInit: true});
export const lastLoginDatetimeAtom = atomWithStorage("lastLoginDatetime", dayjs(), undefined, {getOnInit: true});
export const lastWarehouseRefreshAtom = atomWithStorage("lastWarehouseRefresh", null, undefined, {getOnInit: true});
export const refreshAtom = atom(false);
export const authenticatedAtom = atom(false);
export const userGroupsAtom = atomWithStorage("userGroups", [], undefined, {getOnInit: true}); // already present
export const userInitialAtom = atomWithStorage("userInitial", "U", undefined, {getOnInit: true});

authenticatedAtom.onMount = (set) => {
  set(isAuthAtom);
};

// --- NEW: Fetch user groups and set atom ---
const fetchAndSetUserGroups = async (set) => {
  try {
    const response = await axios.get("/api/user-groups/");
    if (response.status === 200) {
      set(userGroupsAtom, response.data.groups);
    } else {
      set(userGroupsAtom, []);
    }
  } catch (error) {
    set(userGroupsAtom, []);
  }
};
// -------------------------------------------

const refreshTokens = async (get, set) => {
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
      axios.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.access}`;
      set(accessTokenAtom, response.data.access);
      set(refreshTokenAtom, response.data.refresh);
      set(lastLoginDatetimeAtom, dayjs());

      // --- NEW: Fetch user groups after successful token refresh ---
      await fetchAndSetUserGroups(set);

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

export const isAuthAtom = atom(
  (get) => {
    get(accessTokenAtom);
    get(refreshTokenAtom);
    get(lastLoginDatetimeAtom);
  },
  async (get, set) => {
    const accessToken = get(accessTokenAtom);
    const refreshToken = get(refreshTokenAtom);
    const accessExp = dayjs().subtract(14, "minutes");
    const lastLoginDatetime = dayjs(get(lastLoginDatetimeAtom));

    if (get(refreshAtom) === true) {
      set(refreshAtom, false);
      if (accessExp.isAfter(lastLoginDatetime)) {
        if (await refreshTokens(get, set)) {
          set(authenticatedAtom, true);

          // --- NEW: Fetch user groups after refresh ---
          await fetchAndSetUserGroups(set);

        } else set(authenticatedAtom, false);
      } else if (accessToken !== null) {
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${accessToken}`;
        set(authenticatedAtom, true);

        // --- NEW: Fetch user groups after access token is valid ---
        await fetchAndSetUserGroups(set);

      } else set(authenticatedAtom, false);
    } else if (accessToken === null || refreshToken === null) {
      set(authenticatedAtom, false);

      // --- NEW: Clear user groups on logout ---
      set(userGroupsAtom, []);

    } else if (accessExp.isAfter(lastLoginDatetime)) {
      set(refreshAtom, true);
      if (await refreshTokens(get, set)) {
        set(refreshAtom, false);
        set(authenticatedAtom, true);

        // --- NEW: Fetch user groups after refresh ---
        await fetchAndSetUserGroups(set);

      } else {
        set(refreshAtom, false);
        set(authenticatedAtom, false);

        // --- NEW: Clear user groups on logout ---
        set(userGroupsAtom, []);
      }
    } else {
      axios.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
      set(authenticatedAtom, true);

      // --- NEW: Fetch user groups after access token is valid ---
      await fetchAndSetUserGroups(set);

    }
  }
);

// --- MODIFIED: Clear user groups on logout ---
export const removeTokensAtom = atom(null, (get, set) => {
  set(accessTokenAtom, null);
  set(refreshTokenAtom, null);
  set(isAuthAtom, false);
  set(userGroupsAtom, []); // clear user groups
});

export const updateWarehouseDataAtom = atom(null, async (get, set, updated) => {
  try {
    const data = await axios.get("/api/warehouse");
    set(warehouseDataAtom, data.data);
    set(lastWarehouseRefreshAtom, dayjs().toISOString());
  } catch (error) {
    if (error.response && error.response.status === 401) {
      set(refreshAtom, true);
      set(isAuthAtom);
    } else {
      console.log("Error updating warehouse  ", error);
      set(lastWarehouseRefreshAtom, null);
    }
  }
});

export const warehouseDataEffectAtom = atom(
  (get) => get(warehouseDataAtom),
  async (get, set, _arg) => {
    const warehouses = get(warehouseDataAtom);
    const now = dayjs();
    let lastRefresh = get(lastWarehouseRefreshAtom);
    lastRefresh = lastRefresh ? dayjs(lastRefresh) : null
    if (warehouses?.length == 0 || !lastRefresh || now.diff(lastRefresh, "hour") >= 24) {
      await set(updateWarehouseDataAtom);
    }
  }
);
