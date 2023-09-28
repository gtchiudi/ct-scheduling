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
        
         <img style={{height: '100%',
          width: '100%',}}src="../truckBackground.png"></img>
        
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