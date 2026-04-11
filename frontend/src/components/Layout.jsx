// Layout.jsx
import React from "react";
import HeaderBar from "./HeaderBar"; // Import your HeaderBar component here
import Footer from "./Footer.jsx";
import { Box } from "@mui/material";
import { useAtom } from "jotai";
import {
  isAuthAtom,
  authenticatedAtom,
  navigateFnAtom,
} from "./atoms.jsx";
import { useNavigate } from "react-router-dom";
import { setupAxiosInterceptor } from "../utils/axiosInterceptor.js";

function Layout({ children }) {
  const authenticated = useAtom(authenticatedAtom);
  const [, isAuth] = useAtom(isAuthAtom);
  const [, setNavigateFn] = useAtom(navigateFnAtom);
  const navigate = useNavigate();

  React.useEffect(() => {
    setupAxiosInterceptor(navigate);
    setNavigateFn(() => navigate);
  }, []);

  React.useEffect(() => {
    isAuth();
  }, [authenticated]);
  return (
    <Box sx={{ height: "100%", margin: "0" }}>
      <Box sx={{ minHeight: "100%", marginBottom: "-50px" }}>
        <HeaderBar />
        <Box sx={{ height: "66px" }} /> {/* spacer for fixed AppBar */}
        <Box sx={{ flex: "1" }}>{children}</Box>
        <Box sx={{ height: "50px" }}></Box>
      </Box>
      <Footer />
    </Box>
  );
}

export default Layout;
