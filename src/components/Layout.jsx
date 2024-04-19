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
import Footer from "./Footer.jsx";
import { Box } from "@mui/material";

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
    <Box>
      <HeaderBar />
      <Box position="relative">{children}</Box>
      <Footer />
    </Box>
  );
}

export default Layout;
