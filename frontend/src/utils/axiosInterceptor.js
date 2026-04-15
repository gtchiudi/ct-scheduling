import axios from "axios";
import { getDefaultStore } from "jotai";
import { accessTokenAtom, refreshTokenAtom, lastLoginDatetimeAtom, authenticatedAtom } from "../components/atoms.jsx";
import dayjs from "dayjs";
import { sharedRefreshTokens } from "./refreshTokensShared.js";

let isRefreshing = false;
let failedQueue = [];
let interceptorRegistered = false;

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

export function setupAxiosInterceptor(navigate) {
  if (interceptorRegistered) return;
  interceptorRegistered = true;

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Don't intercept the refresh endpoint itself to avoid infinite loops
      if (
        error.response?.status !== 401 ||
        originalRequest._retry ||
        originalRequest.url?.includes("/token/refresh/") ||
        originalRequest._skipAuthRedirect
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the ongoing refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
            return axios(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const storedRefresh = localStorage.getItem("refreshToken");
      const refreshToken = storedRefresh ? JSON.parse(storedRefresh) : null;

      if (!refreshToken) {
        isRefreshing = false;
        navigate("/logout");
        return Promise.reject(error);
      }

      try {
        const store = getDefaultStore();
        // sharedRefreshTokens deduplicates: if isAuthAtom is already refreshing,
        // this awaits that same promise instead of starting a second request
        const access = await sharedRefreshTokens(async () => {
          const response = await axios.post("/token/refresh/", { refresh: store.get(refreshTokenAtom) });
          const { access: newAccess, refresh: newRefresh } = response.data;
          store.set(accessTokenAtom, newAccess);
          if (newRefresh) store.set(refreshTokenAtom, newRefresh);
          store.set(lastLoginDatetimeAtom, dayjs());
          store.set(authenticatedAtom, true);
          axios.defaults.headers.common["Authorization"] = `Bearer ${newAccess}`;
          return newAccess;
        });

        originalRequest.headers["Authorization"] = `Bearer ${access}`;
        processQueue(null, access);
        return axios(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        const store = getDefaultStore();
        store.set(accessTokenAtom, null);
        store.set(refreshTokenAtom, null);
        store.set(authenticatedAtom, false);
        delete axios.defaults.headers.common["Authorization"];
        navigate("/logout");
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
  );
}
