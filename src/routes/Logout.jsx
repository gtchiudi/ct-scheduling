import React from "react";
import axios from "axios";
import {
  accessTokenAtom,
  refreshTokenAtom,
  removeTokensAtom,
  logoutSentAtom,
} from "../components/atoms.jsx";
import { useAtom } from "jotai";
import { useNavigate } from "react-router-dom";

export default function Logout() {
  const [, removeTokens] = useAtom(removeTokensAtom);
  const [accessToken] = useAtom(accessTokenAtom);
  const [refreshToken] = useAtom(refreshTokenAtom);
  const navigate = useNavigate();
  const [logoutSent, setLogoutSent] = useAtom(logoutSentAtom);

  console.log("Logout accessToken", accessToken);
  console.log("Logout refreshToken", refreshToken);
  React.useEffect(() => {
    if (!logoutSent) {
      (async () => {
        try {
          const { data } = await axios.post(
            "/logout/",
            {
              refresh_token: refreshToken,
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              withCredentials: true,
            }
          );
          axios.defaults.headers.common["Authorization"] = null;
          removeTokens();
          navigate("/");
        } catch (e) {
          console.log("logout not working", e);
        }
      })();
      setLogoutSent(true);
    }
  }, []);
  return <div>{console.log("Logout")}</div>;
}
