import { atom } from "jotai";
import axios from "axios";

const fetchWarehouseData = async () => {
  try {
    const response = await axios.get("/api/warehouse");
    return response.data;
  } catch (error) {
    throw error;
  }
};

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

export const warehouseDataAtom = atom([]);

export const updateWarehouseDataAtom = atom(null, async (get, set, updated) => {
  try {
    const data = await fetchWarehouseData();
    set(warehouseDataAtom, data);
  } catch (error) {
    console.error(error);
  }
});