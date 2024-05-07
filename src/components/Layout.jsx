// Layout.jsx
import React from "react";
import HeaderBar from "./HeaderBar"; // Import your HeaderBar component here
import Footer from "./Footer.jsx";
import { Box, Stack } from "@mui/material";
import { useAtom } from "jotai";
import {
  isAuthAtom,
  updateWarehouseDataAtom,
  authenticatedAtom,
} from "./atoms.jsx";

function Layout({ children }) {
  const authenticated = useAtom(authenticatedAtom);
  const [, isAuth] = useAtom(isAuthAtom);
  const [, updateWarehouseData] = useAtom(updateWarehouseDataAtom);

  React.useEffect(() => {
    isAuth();
    updateWarehouseData();
  }, [authenticated]);
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
