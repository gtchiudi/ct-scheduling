import * as React from "react";
import { Box, ThemeProvider, createTheme } from "@mui/system";
import { Typography } from "@mui/material";
import { Paper, Grid } from "@mui/material";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import { Link as RouterLink } from "react-router-dom";

export default function Home() {
  let image =
    "https://img1.wsimg.com/isteam/ip/f69d92aa-cce5-4851-89e5-56380f14d8f1/blob.png";
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
          backgroundColor: "rgba(0,0,0,.1)",
        }}
      />
      <Grid container>
        <Grid item md={4}>
          <Box
            sx={{
              position: "relative",
              p: { xs: 6, md: 12 },
              pr: { md: 0 },
              filter: "drop-shadow(0px 0px 10px rgba(0,0,0,.6))",
            }}
          >
            <Typography
              textAlign="center"
              component="h1"
              variant="h3"
              color="inherit"
              gutterBottom
            >
              Welcome to <br />
              CT-Scheduling
            </Typography>
            <Typography variant="h5" color="inherit" paragraph>
              Experience seamless logistics management with CT-Scheduling. Our
              user-friendly platform connects Candor Logistics clients and
              employees to streamline appointments to deliver top-notch service.{" "}
              <br /> <br />
              For more information about Candor Logistics and Candor
              Transportation, visit our website: <br />
              <Link variant="subtitle1" href="www.candortransport.com/home">
                {"Candor Transport Website"}
              </Link>
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
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
