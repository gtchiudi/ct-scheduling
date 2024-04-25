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
import { Box, Stack } from "@mui/material";

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
    <Box sx={{ height: "100%", margin: "0" }}>
      <Box sx={{ minHeight: "100%", marginBottom: "-50px" }}>
        <HeaderBar />
        <Box sx={{ flex: "1" }}>{children}</Box>
        <Box sx={{ height: "50px" }}></Box>
      </Box>
      <Footer />
    </Box>
  );
}

export default Layout;
