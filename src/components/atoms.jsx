import { atom } from "jotai";
import { getWarehouseInfo } from "../actions";

const initialWarehouseData = [{}];

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

export const warehouseDataAtom = atom(initialWarehouseData);

export const updateWarehouseDataAtom = atom(
  null,
  (get, set, updatedWarehouseData) => {
    const response = getWarehouseInfo();
    if (response.isError) {
      console.log("Error: ", response.error.message);
    } else if (response.data) {
      set(warehouseDataAtom, response.data.data);
    }
  }
);
