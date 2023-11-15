import * as React from "react";
import { Box, ThemeProvider, createTheme } from "@mui/system";
import { Typography } from "@mui/material";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { isAuthAtom } from "../components/atoms.jsx";

const containerStyle = {
  position: "relative",
  height: "100vh", // Set the container to 100% viewport height
  overflow: "hidden", // Prevent image from scrolling
  backgroundImage: `url("../truckBackground.png")`, // Set the image as background
  backgroundSize: "cover", // Make the image cover the entire container
  backgroundAttachment: "fixed",
  maxWidth: "100%",
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
          <h1>Welcome to CT-Scheduling</h1>
        </Box>
        <div style={boxStyle}>
          <h1 style={{ textAlign: "center" }}>CandorTransportationCo.LLC</h1>
          <p style={{ margin: 0 }}>
            Experience seamless logistics management with CT-Scheduling. Our
            user-friendly platform connects Candor Logistics clients and
            employees to streamline requests, manage warehouse operations, and
            deliver top-notch service.
          </p>{" "}
          <br />
          <p style={{ margin: 0 }}>
            For more information about Candor Logistics and Candor
            Transportation, visit our websites&nbsp;
            <a href="https://www.candortransport.com/home">Here</a>
          </p>
        </div>

        <div style={buttonStyle}>
          <Button
            component={Link}
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
        </div>
      </div>
    </Typography>
  );
}
