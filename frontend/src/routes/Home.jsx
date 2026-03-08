import * as React from "react";
import { Box, ThemeProvider, createTheme } from "@mui/system";
import { Typography } from "@mui/material";
import { Grid, Backdrop } from "@mui/material";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import { Link as RouterLink } from "react-router-dom";

export default function Home() {
  let image =
    "https://img1.wsimg.com/isteam/ip/f69d92aa-cce5-4851-89e5-56380f14d8f1/blob.png";
  return (
    <Backdrop
      open={true}
      sx={{
        // position: "relative",
        color: "#fff",
        mb: 4,
        minHeight: "calc(100vh - 45xpx)",
        height: "auto", // Allow content to expand
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
        <Grid item xs={12} md={4}> {/* Added xs={12} for full width on mobile */}
          <Box
            sx={{
              position: "relative",
              p: { xs: 3, sm: 4, md: 12 }, // Reduced padding on small screens
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
              sx={{ fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" } }} // Responsive font size
            >
              Welcome to <br />
              CT-Scheduling
            </Typography>
            <Typography
              variant="h5"
              color="inherit"
              paragraph
              sx={{ fontSize: { xs: "1rem", sm: "1.25rem", md: "1.5rem" } }} // Responsive font size
            >
              Experience seamless logistics management with CT-Scheduling. Our
              user-friendly platform connects Candor Logistics clients and
              employees to streamline appointments to deliver top-notch service.{" "}
              <br /> <br />
              For more information about Candor Logistics and Candor
              Transportation, visit our website: <br />
              <Link
                variant="subtitle1"
                href="https://www.candorlogistics.com/"
                component="a"
                target="_blank"
                rel="noopener noreferrer"
              >
                Candor Logistics Website
              </Link>
            </Typography>

            <Button
              component={RouterLink}
              to="/RequestForm"
              variant="contained"
              size="medium"
              fullWidth // Make button full width on mobile
              sx={{
                textAlign: "center",
                maxWidth: { sm: "300px" }, // Limit width on larger screens
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
    </Backdrop>
  );
}
