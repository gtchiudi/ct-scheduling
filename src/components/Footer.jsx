import React from "react";
import { useLocation } from "react-router-dom";
import { Box, Container, Typography } from "@mui/material";

function Footer() {
  const path = useLocation().pathname;
  const render =
    path == "/login" || path == "/" || path == "/RequestForm" ? true : false;
  if (!render) return;
  return (
    <Box
      minHeight="100vh"
      width={"100%"}
      paddingTop={1}
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "auto",
      }}
    >
      <Box
        component="footer"
        sx={{
          py: 1,
          px: 2,
          mt: "auto",
          backgroundColor: (theme) =>
            theme.palette.mode === "light"
              ? theme.palette.grey[200]
              : theme.palette.grey[800],
        }}
      >
        <Container maxWidth="sm">
          <Typography
            variant="body1"
            textAlign="center"
            sx={{ fontSize: "14px" }}
          >
            Candor Transport <br />
            22801 Aurora Rd Suite 1 <br />
            Bedford Hts, Ohio 44146 <br />
            P:{" "}
            <a href="tel:+18669419100" style={{ color: "blue" }}>
              866.941.9100
            </a>{" "}
            &nbsp; P:{" "}
            <a href="tel:+12163787100" style={{ color: "blue" }}>
              216.378.7100
            </a>{" "}
            &nbsp; F:{" "}
            <a href="tel:+12163789232" style={{ color: "blue" }}>
              216.378.9232
            </a>
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

export default Footer;
