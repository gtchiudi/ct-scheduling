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
    // Clear local auth state synchronously, before any await, so a fast
    // subsequent navigation can't abort this effect mid-flight and leave
    // stale tokens in localStorage (the server-side blacklist call below is
    // fire-and-forget — logout must not be gated on a network round trip).
    removeTokens();
    navigate("/");
    if (refreshToken) {
      axios.post("/token/blacklist/", { refresh: refreshToken }).catch(() => {
        // Blacklist call failed (token may already be invalid) — client-side
        // logout already completed, nothing more to do.
      });
    }
  }, []);

  return <div></div>;
}
