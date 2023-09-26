import axios from "axios";
import { useAtom } from "jotai";
import {
  access_token as accessTokenAtom,
  refresh_token as refreshTokenAtom,
} from "../components/atoms";

let refresh = false;

const [access_token, setAccessToken] = useAtom(accessTokenAtom);
const [refresh_token, setRefreshToken] = useAtom(refreshTokenAtom);

axios.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    if (error.response.status === 401 && !refresh) {
      refresh = true;
      console.log("refresh_token");
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
        return axios(error.config);
      }
    }
    refresh = falase;
    return error;
  }
);
