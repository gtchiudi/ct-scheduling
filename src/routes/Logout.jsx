import React from "react";
import axios from "axios";
import {
  access_token as accessTokenAtom,
  refresh_token as refreshTokenAtom,
} from "../components/atoms.jsx";
import { useAtom } from "jotai";
import { useNavigate } from "react-router-dom";

export default function Logout() {
  const [access_token, setAccessToken] = useAtom(accessTokenAtom);
  const [refresh_token, setRefreshToken] = useAtom(refreshTokenAtom);

  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.post(
          "/logout/",
          {
            refresh_token: refresh_token,
          },
          {
            headers: {
              "content-Type": "application/json",
            },
            withCredentials: true,
          }
        );
        setAccessToken(null);
        setRefreshToken(null);
        axios.defaults.headers.common["Authorization"] = null;
        navigate("/");
      } catch (e) {
        console.log("logout not workong", e);
      }
    })();
  }, []);

  return <div></div>;
}
