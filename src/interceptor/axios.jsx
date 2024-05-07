import axios from "axios";
import { useAtom } from "jotai";
import { isAuthAtom, refreshTokenAtom } from "../components/atoms.jsx";
import { setRef } from "@mui/material";

const [refresh, setRefresh] = useAtom(refreshAtom);
const [, isAuth] = useAtom(isAuthAtom);

axios.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error.response.status === 401 && !refresh) {
      setRefresh(true);
      console.log("refresh token");
      isAuth();
    }
    setRefresh(false);
    console.log("interceptor: ", error);
    return Promise.reject(error);
  }
);
