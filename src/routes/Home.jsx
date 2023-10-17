import * as React from "react";
import { Box, ThemeProvider, createTheme } from "@mui/system";
import { Typography } from "@mui/material";
import { Paper } from "@mui/material";
import Button from "@mui/material/Button";

const containerStyle = {
  position: "relative",
  height: "100vh", // Set the container to 100% viewport height
  overflow: "hidden", // Prevent image from scrolling
  backgroundImage: `url("../truckBackground.png")`, // Set the image as background
  backgroundSize: "cover", // Make the image cover the entire container
  backgroundAttachment: "fixed",
};

const boxStyle = {
  position: "absolute",
  top: "50%", // Adjust this value to position the box vertically
  left: "50%", // Adjust this value to position the box horizontally
  transform: "translate(-50%, -50%)", // Center the box
  backgroundColor: "rgba(255, 255, 255, 0.8)", // Background color with opacity
  padding: "10px", // Adjust the padding as needed
  borderRadius: "5px", // Add rounded corners
};

const buttonStyle = {
  position: "absolute",
  top: "calc(50% + 250px)", // Position the button below the box
  left: "50%", // Adjust this value to position the button horizontally
  transform: "translate(-50%, -50%)", // Center the button
};

export default function Home() {
  return (
    <Typography>
      <div style={containerStyle}>
        <Box
          sx={{
            color: "",
            display: "inline",
            fontWeight: "bold",
            textAlign: "center",
            mx: 0.5,
            fontSize: 14,
          }}
        >
          <Typography variant="h2" textAlign="center">
            Welcome to Candor Logistics
          </Typography>
        </Box>
        <br />
        <Paper
          elevation={12}
          sx={{
            width: "50%",
            height: "270px",
            mx: "auto",
            p: 2,
            mt: 2,
            mb: 2,
            textAlign: "center",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
          }}
        >
          <Typography variant="h4" textAlign="center">
            CandorTransportationCo.LLC
          </Typography>
          <Typography variant="body" textAlign="left">
            Candor Transportation is a women-owned, full-service freight
            logistics company. When it comes to freight movement and service, we
            are number one in the industry. Honesty and integrity have been the
            key to our success. <br /> <br />
            Every customer is our number one customer. Our goal is to keep your
            best interests in mind. By keeping the lines of communication open,
            we can customize our services to fit your needs. One call, we handle
            it all.
          </Typography>
          <br /> <br />
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
        </Paper>
      </div>
    </Typography>
  );
}
