import * as React from "react";
import { TextField, Box, Typography, FormControlLabel, Checkbox, Button } from "@mui/material/";
import { submitUserData } from "../actions.jsx";
import { useAtom } from "jotai";
import { accessTokenAtom, refreshTokenAtom } from "../components/atoms.jsx";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";


export default function Login() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [accessToken, setAccessToken] = useAtom(accessTokenAtom);
  const [refreshToken, setRefreshToken] = useAtom(refreshTokenAtom);

  const submitUserDataMutation = submitUserData(
    username,
    password,
    queryClient
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const data = await submitUserDataMutation.mutateAsync({
        username,
        password,
        queryClient,
      });

      if (data) {
        console.log("Login Successful");
        setAccessToken(data.access);
        setRefreshToken(data.refresh);
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
        id="Login"
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
