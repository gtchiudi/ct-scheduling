import * as React from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Button from "@mui/material/Button";
import { submitUserData } from "../actions.jsx";
import { useAtom } from "jotai";
import {
  access_token as accessTokenAtom,
  refresh_token as refreshTokenAtom,
} from "../components/atoms.jsx";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [access_token, setAccessToken] = useAtom(accessTokenAtom);
  const [refresh_token, setRefreshToken] = useAtom(refreshTokenAtom);

  const submitUserDataMutation = submitUserData(username, password);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await submitUserDataMutation.mutateAsync({
        username,
        password,
      });

      if (response) {
        console.log("Login Successful");
        setAccessToken(response.access_token);
        setRefreshToken(response.refresh_token);

        navigate("/RequestList");
      } else {
        console.log("Login Failed");
      }
    } catch (error) {
      console.error("Error submitting user data:", error);
    }
  };

  return (
    <Typography textAlign="center">
      <Box
        component="form"
        display="flex"
        justifyContent="center"
        alignItems="center"
        sx={{
          "& > :not(style)": { m: 1, width: "25ch" },
        }}
        noValidate
        autoComplete="off"
        onSubmit={handleSubmit}
      >
        <div>
          <h1>Login</h1>
          <label htmlFor="fUsername">Username:</label>
          <br></br>
          <TextField
            id="Username"
            label="Enter Username"
            variant="filled"
            required
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <label htmlFor="fPassword">Password:</label>
          <br></br>
          <TextField
            id="Password"
            label="Enter Password"
            variant="filled"
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormControlLabel
            control={<Checkbox value="remember" color="primary" />}
            label="Remember me"
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={submitUserDataMutation.isLoading}
          >
            {submitUserDataMutation.isLoading ? "Logging in..." : "Log in"}
          </Button>
        </div>
      </Box>
    </Typography>
  );
}
