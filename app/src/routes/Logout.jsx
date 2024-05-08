import React from "react";
import { removeTokensAtom, isAuthAtom } from "../components/atoms.jsx";
import { useAtom } from "jotai";
import { useNavigate } from "react-router-dom";

export default function Logout() {
  const [, removeTokens] = useAtom(removeTokensAtom);
  const navigate = useNavigate();

  React.useEffect(() => {
    removeTokens();
    navigate("/");
  }, []);

  return <div></div>;
}
