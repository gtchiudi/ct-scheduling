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
      component="footer"
      width={"100%"}
      sx={{
        display: "flex",
        position: "fixed", // Position fixed to stick to the viewport
        bottom: 0, // Stick to the bottom of the viewport
        backgroundColor: (theme) =>
          theme.palette.mode === "light"
            ? theme.palette.grey[200]
            : theme.palette.grey[800],
        width: "100%",
        py: 1,
        px: 2,
        mt: "auto",
        zIndex: 1000,
      }}
    >
      <Container maxWidth="sm">
        <Typography
          variant="body1"
          textAlign="center"
          sx={{ fontSize: "14px" }}
        >
          Candor Logistics <br />
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
  );
}

export default Footer;
