import * as React from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material/";
import { submitUserData } from "../actions.jsx";
import { useAtom } from "jotai";
import {
  accessTokenAtom,
  refreshTokenAtom,
  lastLoginDatetimeAtom,
  authenticatedAtom,
  userInitialAtom,
  removeTokensAtom,
} from "../components/atoms.jsx";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

import IconButton from '@mui/material/IconButton';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import InputAdornment from '@mui/material/InputAdornment';
import FormControl from '@mui/material/FormControl';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

export default function Login() {
  const navigate = useNavigate();

  const validUserGroups = ['Dock', 'Dispatch', 'Admin']

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const [, setAccessToken] = useAtom(accessTokenAtom);
  const [, setRefreshToken] = useAtom(refreshTokenAtom);
  const [, setLastLoginDatetime] = useAtom(lastLoginDatetimeAtom);
  const [authenticated] = useAtom(authenticatedAtom);
  const [, setUserInitial] = useAtom(userInitialAtom);
  const [, removeTokens] = useAtom(removeTokensAtom);

  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [groupErrorOpen, setGroupErrorOpen] = React.useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);
  const handleMouseDownPassword = (event) => event.preventDefault();
  const handleMouseUpPassword = (event) => event.preventDefault();

  const handleGroupErrorClose = () => {
    setGroupErrorOpen(false);
    removeTokens();
    navigate("/");
  };

  const submitUserDataMutation = useMutation(submitUserData, {
    onSuccess: async (data) => {
      axios.defaults.headers.common["Authorization"] = `Bearer ${data.access}`;
      setAccessToken(data.access);
      setRefreshToken(data.refresh);
      setLastLoginDatetime(dayjs());
      setUserInitial(username.charAt(0).toUpperCase() || "U");
      setUsername("");
      setPassword("");
      setErrorMessage("");

      // Check group membership before proceeding
      try {
        const response = await axios.get("/api/user-groups/");
        if (!response.data.groups || !response.data.groups.some(g => validUserGroups.includes(g))) {
          setGroupErrorOpen(true);
          return;
        }
      } catch {
        setGroupErrorOpen(true);
        return;
      }

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
      await submitUserDataMutation.mutateAsync({ username, password });
    } catch {
      // handled by onError
    }
  };

  return (
    <Box
      id="Login"
      component="form"
      display="flex"
      justifyContent="center"
      alignItems="center"
      sx={{ "& > :not(style)": { m: 1, width: "25ch" } }}
      noValidate
      autoComplete="off"
      onSubmit={handleSubmit}
    >
      <Dialog open={groupErrorOpen} onClose={handleGroupErrorClose}>
        <DialogTitle textAlign="center">Access Error</DialogTitle>
        <DialogContent>
          <Typography textAlign="center">
            Error: User is not assigned to a valid Group. <br />Contact system administrator to resolve.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleGroupErrorClose}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <div>
        <Typography alignContent="center" textAlign="center" variant="h3">
          Login
        </Typography>
        <br />
        <FormControl sx={{ m: 1, width: '25ch' }} variant="outlined">
          <InputLabel htmlFor="username">Username</InputLabel>
          <OutlinedInput
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            label="Username"
          />
        </FormControl>
        <br />
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
                  aria-label={showPassword ? 'hide the password' : 'display the password'}
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
