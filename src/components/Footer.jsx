import React from "react";
import { useLocation } from "react-router-dom";

const footerStyle = {
  backgroundColor: "#333",
  color: "#fff",
  textAlign: "center",
  padding: "2px",
};

function Footer() {
  const path = useLocation().pathname;
  const render =
    path == "/login" || path == "/" || path == "/RequestForm" ? true : false;
  return (
    <div>
      {render && (
        <footer>
          <div style={footerStyle}>
            Candor Transport <br />
            22801 Aurora Rd Suite 1 <br />
            Bedford Hts, Ohio 44146 <br />
            P:{" "}
            <a href="tel:+18669419100" style={{ color: "white" }}>
              866.941.9100
            </a>{" "}
            &nbsp; P:{" "}
            <a href="tel:+12163787100" style={{ color: "white" }}>
              216.378.7100
            </a>{" "}
            &nbsp; F:{" "}
            <a href="tel:+12163789232" style={{ color: "white" }}>
              216.378.9232
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}

export default Footer;
