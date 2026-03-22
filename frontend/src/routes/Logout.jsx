import React from "react";
import { removeTokensAtom, refreshTokenAtom } from "../components/atoms.jsx";
import { useAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Logout() {
  const [, removeTokens] = useAtom(removeTokensAtom);
  const [refreshToken] = useAtom(refreshTokenAtom);
  const navigate = useNavigate();

  React.useEffect(() => {
    const doLogout = async () => {
      if (refreshToken) {
        try {
          await axios.post("/token/blacklist/", { refresh: refreshToken });
        } catch {
          // Blacklist call failed (token may already be invalid) — continue logout
        }
      }
      removeTokens();
      navigate("/");
    };
    doLogout();
  }, []);

  return <div></div>;
}
