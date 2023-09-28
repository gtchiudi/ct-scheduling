import * as React from "react";
import { Box, ThemeProvider, createTheme } from '@mui/system';
import { Typography } from "@mui/material";
import Button from "@mui/material/Button";

export default function Home(){
    return(
        <Typography>
        <Box
        sx={{
            color: '',
            display: 'inline',
            fontWeight: 'bold',
            textAlign: 'center',
            mx: 0.5,
            fontSize: 14,
          }}><h1>Welcome to Candor Logistics</h1>
        </Box>
        
        <div style={{ position: 'relative' }}>
                <img
                    style={{
                        height: '100%',
                        width: '100%',
                    }}
                    src="../truckBackground.png"
                    alt="Truck Background"
                />
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',  // Adjust this value to position the text vertically
                        left: '50%', // Adjust this value to position the text horizontally
                        transform: 'translate(-50%, -50%)', // Center the text
                        backgroundColor: 'rgba(255, 255, 255, 0.8)', // Background color with opacity
                        padding: '10px', // Adjust the padding as needed
                        borderRadius: '5px', // Add rounded corners

                    }}>
                        <h1>CandorTransportationCo.LLC</h1>
                    <p style={{ margin: 0 }}>
                        Candor Transportation is a women owned, full service freight logistics company. 
                        When it comes to freight movement and service, we are number one in the industry.
                        Honesty and integrity has been the key to our success.</p> <br/>
                    <p style={{ margin: 0 }}>   
                        Every customer is our number one customer. Our goal is to keep your best interests 
                        in mind. By keeping the lines of communication open, we can customize our services 
                        to fit your needs. One call, we handle it all.</p>
                </div>
        </div>
        
        <Box sx={{ textAlign: 'center' }}>
            <Button
                variant="outlined"
                size="medium"
                sx={{
                    textAlign: "center",
                    "&:hover": {
                    backgroundColor: "#AAC1D0",
                    opacity: [0.9, 0.8, 0.7]
                    }
                }}>
                Request Pickup/Delivery
            </Button>
        </Box>
    </Typography>
    )
}