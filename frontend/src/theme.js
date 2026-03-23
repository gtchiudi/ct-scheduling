import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    text: {
      disabled: "rgba(0, 0, 0, 0.6)",
    },
    action: {
      disabled: "rgba(0, 0, 0, 0.4)",
    },
  },
});

export default theme;
