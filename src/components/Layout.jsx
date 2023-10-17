// Layout.jsx

import React from "react";
import HeaderBar from "./HeaderBar"; // Import your HeaderBar component here

function Layout({ children }) {
  return (
    <div>
      <HeaderBar />
      {children}
    </div>
  );
}

export default Layout;
