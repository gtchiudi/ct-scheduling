import React from "react";
import { removeTokensAtom, isAuthAtom } from "../components/atoms.jsx";
import { useAtom } from "jotai";
import { useNavigate } from "react-router-dom";

export default function Logout() {
  const [, removeTokens] = useAtom(removeTokensAtom);
  const navigate = useNavigate();
  const [, isAuth] = useAtom(isAuthAtom);
  const authenticated = isAuth();

  React.useEffect(() => {
    removeTokens();
    navigate("/");
  }, [authenticated, removeTokens, navigate]);

  return <div></div>;
}
