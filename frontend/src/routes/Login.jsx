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
  authenticatedAtom,
  userInitialAtom,
} from "../components/atoms.jsx";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

import IconButton from '@mui/material/IconButton';
import Input from '@mui/material/Input';
import FilledInput from '@mui/material/FilledInput';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import InputAdornment from '@mui/material/InputAdornment';
import FormHelperText from '@mui/material/FormHelperText';
import FormControl from '@mui/material/FormControl';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

export default function Login() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [accessToken, setAccessToken] = useAtom(accessTokenAtom);
  const [refreshToken, setRefreshToken] = useAtom(refreshTokenAtom);
  const [, setLastLoginDatetime] = useAtom(lastLoginDatetimeAtom);
  const [, isAuth] = useAtom(isAuthAtom);
  const [authenticated] = useAtom(authenticatedAtom);
  const [, setUserInitial] = useAtom(userInitialAtom);

  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const handleMouseUpPassword = (event) => {
    event.preventDefault();
  };

  const submitUserDataMutation = useMutation(submitUserData, {
    onSuccess: (data) => {
      console.log("Login Successful");
      axios.defaults.headers.common["Authorization"] = `Bearer ${data.access}`;
      setAccessToken(data.access);
      setRefreshToken(data.refresh);
      setLastLoginDatetime(dayjs());
      setUserInitial(username.charAt(0).toUpperCase() || "U");
      setUsername("");
      setPassword("");
      setErrorMessage("");
      navigate("/Calendar");
    },
    onError: (error) => {
      console.error("Login failed:", error);
      if (error.response?.status === 401) {
        setErrorMessage("Invalid username or password");
      } else if (error.response?.data?.detail) {
        setErrorMessage(error.response.data.detail);
      } else {
        setErrorMessage("Login failed. Please try again.");
      }
    },
  });

  React.useEffect(() => {
    if (authenticated) {
      navigate("/Calendar");
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
        <br></br>
        <FormControl sx={{ m: 1, width: '25ch' }} variant="outlined">
          <InputLabel htmlFor="username">Username</InputLabel>
          <OutlinedInput
            id="username"
            type={'text'}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            label="Username"
          />
        </FormControl>
        <br></br>
        <FormControl sx={{ m: 1, width: '25ch' }} variant="outlined">
          <InputLabel htmlFor="outlined-adornment-password">Password</InputLabel>
          <OutlinedInput
            id="outlined-adornment-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  aria-label={
                    showPassword ? 'hide the password' : 'display the password'
                  }
                  onClick={handleClickShowPassword}
                  onMouseDown={handleMouseDownPassword}
                  onMouseUp={handleMouseUpPassword}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            }
            label="Password"
          />
        </FormControl>
        {errorMessage && (
          <Typography color="error" sx={{ mt: 2, textAlign: "center" }}>
            {errorMessage}
          </Typography>
        )}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={!username || !password || submitUserDataMutation.isLoading}
        >
          {submitUserDataMutation.isLoading ? "Logging in..." : "Log in"}
        </Button>
      </div>
    </Box>
  );
}
