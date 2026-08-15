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
        {/* Spacer for the fixed AppBar — MUI's Toolbar is 56px tall below the
            sm breakpoint and 64px at sm+, plus the AppBar's 1px top+bottom
            border, so this has to match per breakpoint or mobile gets a gap. */}
        <Box sx={{ height: { xs: "58px", sm: "66px" } }} />
        <Box sx={{ flex: "1" }}>{children}</Box>
        <Box sx={{ height: "50px" }}></Box>
      </Box>
      <Footer />
    </Box>
  );
}

export default Layout;
