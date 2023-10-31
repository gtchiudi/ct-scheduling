import axios from "axios";
import { useAtom } from "jotai";
import { accessTokenAtom, refreshTokenAtom } from "../components/atoms.jsx";

let refresh = false;
axios.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const [accessToken, setAccessToken] = useAtom(accessTokenAtom);
    const [refreshToken, setRefreshToken] = useAtom(refreshTokenAtom);

    if (error.response.status === 401 && !refresh) {
      refresh = true;
      console.log("refresh token");

      const response = await axios.post(
        "/token/refresh/",
        {
          refresh: refreshToken,
        },
        {
          headers: {
            "content-Type": "application/json",
          },
          withCredentials: true,
        }
      );
      console.log("refresh_token response", response);
      if (response.status === 200) {
        setAccessToken(response.data.access);
        setRefreshToken(response.data.refresh);
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.access}`;
        return axios(error.config);
      }
    }
    refresh = false;
    console.log("interceptor: ", error);
    return Promise.reject(error);
  }
);
