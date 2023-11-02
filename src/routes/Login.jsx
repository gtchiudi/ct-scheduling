import * as React from "react";
import {
  TextField,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Button,
} from "@mui/material/";
import { submitUserData } from "../actions.jsx";
import { useAtom } from "jotai";
import {
  accessTokenAtom,
  refreshTokenAtom,
  lastLoginDatetimeAtom,
  isAuthAtom,
} from "../components/atoms.jsx";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

export default function Login() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [accessToken, setAccessToken] = useAtom(accessTokenAtom);
  const [refreshToken, setRefreshToken] = useAtom(refreshTokenAtom);
  const [, setLastLoginDatetime] = useAtom(lastLoginDatetimeAtom);
  const [, isAuth] = useAtom(isAuthAtom);

  const submitUserDataMutation = useMutation(submitUserData, {
    onSuccess: (data) => {
      console.log("Login Successful");
      axios.defaults.headers.common["Authorization"] = `Bearer ${data.access}`;
      setAccessToken(data.access);
      setRefreshToken(data.refresh);
      setLastLoginDatetime(dayjs());
      setUsername("");
      setPassword("");
      navigate("/calendar");
    },
  });

  React.useEffect(() => {
    if (isAuth()) {
      navigate("/calendar");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const data = await submitUserDataMutation.mutateAsync({
        username: username,
        password: password,
      });
      // You can access data from the mutation here.
    } catch (error) {
      console.error("Error submitting user data:", error);
    }
  };

  return (
    <Box
      id="Login"
      component="form" // Wrap the form in a <form> element
      display="flex"
      justifyContent="center"
      alignItems="center"
      sx={{
        "& > :not(style)": { m: 1, width: "25ch" },
      }}
      noValidate
      autoComplete="off"
      onSubmit={handleSubmit} // Add the onSubmit handler here
    >
      <div>
        <Typography alignContent="center" textAlign="center" variant="h3">
          Login
        </Typography>
        <label htmlFor="Username">Username:</label>
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
  );
}
