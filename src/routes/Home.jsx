import * as React from "react";
import { Box, ThemeProvider, createTheme } from "@mui/system";
import { Typography } from "@mui/material";
import { Paper, Grid } from "@mui/material";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import { Link as RouterLink } from "react-router-dom";

export default function Home() {
  let image = "../truckBackground.png";
  return (
    <Paper
      sx={{
        position: "relative",
        color: "#fff",
        mb: 4,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundImage: `url(${image})`,
      }}
    >
      {/* Increase the priority of the hero background image */}
      {<img style={{ display: "none" }} src={image} alt="Truck Background" />}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          left: 0,
          backgroundColor: "rgba(0,0,0,.3)",
        }}
      />
      <Grid container>
        <Grid item md={4}>
          <Box
            sx={{
              position: "relative",
              p: { xs: 6, md: 12 },
              pr: { md: 0 },
            }}
          >
            <Typography
              textAlign="center"
              component="h1"
              variant="h3"
              color="inherit"
              gutterBottom
            >
              Welcome to CT-Scheduling
            </Typography>
            <Typography variant="h5" color="inherit" paragraph>
              Experience seamless logistics management with CT-Scheduling. Our
              user-friendly platform connects Candor Logistics clients and
              employees to streamline requests, manage warehouse operations, and
              deliver top-notch service. <br /> <br />
              For more information about Candor Logistics and Candor
              Transportation, visit our website:
            </Typography>
            <Button
              component={RouterLink}
              to="/RequestForm"
              variant="contained"
              size="medium"
              sx={{
                textAlign: "center",
                "&:hover": {
                  backgroundColor: "#AAC1D0",
                  opacity: [0.9, 0.8, 0.7],
                },
              }}
            >
              Request Pickup/Delivery
            </Button>
            <br />
            <Link variant="subtitle1" href="www.candortransport.com/home">
              {"Candor Transport Website"}
            </Link>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
