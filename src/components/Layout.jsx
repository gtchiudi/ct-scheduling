// Layout.jsx

import React from "react";
import HeaderBar from "./HeaderBar"; // Import your HeaderBar component here
import { useAtom } from "jotai";
import {
  accessTokenAtom,
  refreshTokenAtom,
  lastLoginDatetimeAtom,
  updateWarehouseDataAtom,
  isAuthAtom,
} from "./atoms.jsx";
import axios from "axios";

function Layout({ children }) {
  const [, isAuth] = useAtom(isAuthAtom);
  const [accessToken] = useAtom(accessTokenAtom);
  const [refreshToken] = useAtom(refreshTokenAtom);
  const [lastLoginDatetime] = useAtom(lastLoginDatetimeAtom);
  const [, updateWarehouseData] = useAtom(updateWarehouseDataAtom);
  React.useEffect(() => {
    updateWarehouseData();
  }, []);

  return (
    <div>
      <HeaderBar />
      {children}
    </div>
  );
}

export default Layout;
