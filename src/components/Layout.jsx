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
      <body style={{}}>
        <div style={{}}>{children}</div>
        <footer style={{}}>
          <Footer />
        </footer>
      </body>
    </div>
  );
}

export default Layout;
