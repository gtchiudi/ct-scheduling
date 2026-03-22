import axios from "axios";

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
        originalRequest.url?.includes("/token/refresh/")
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
        const response = await axios.post("/token/refresh/", { refresh: refreshToken });
        const { access, refresh } = response.data;

        localStorage.setItem("accessToken", JSON.stringify(access));
        if (refresh) localStorage.setItem("refreshToken", JSON.stringify(refresh));

        axios.defaults.headers.common["Authorization"] = `Bearer ${access}`;
        originalRequest.headers["Authorization"] = `Bearer ${access}`;

        processQueue(null, access);
        return axios(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        delete axios.defaults.headers.common["Authorization"];
        navigate("/logout");
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
  );
}
