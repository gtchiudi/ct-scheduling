import * as React from "react";
import { Box, ThemeProvider, createTheme } from "@mui/system";
import { Typography } from "@mui/material";
import { Paper, Grid } from "@mui/material";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";

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
              component="h1"
              variant="h3"
              color="inherit"
              gutterBottom
            >
              Welcome to Candor Logistics
            </Typography>
            <Typography variant="h5" color="inherit" paragraph>
              Candor Transportation is a women-owned, full-service freight
              logistics company. When it comes to freight movement and service,
              we are number one in the industry. Honesty and integrity have been
              the key to our success. <br /> <br />
              Every customer is our number one customer. Our goal is to keep
              your best interests in mind. By keeping the lines of communication
              open, we can customize our services to fit your needs. One call,
              we handle it all.
            </Typography>
            <Button
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
