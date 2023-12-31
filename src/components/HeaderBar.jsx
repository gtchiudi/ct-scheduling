import React from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  Container,
  Avatar,
  Button,
  Tooltip,
  MenuItem,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useAtom } from "jotai";
import { isAuthAtom } from "../components/atoms.jsx";

// Add Links to header here using same format as Request List
// This is the only part that needs modified to change the header links
// text: <== This changes what actual text displays
// href: <== This changes what the header button links to
// All of this is the same for the 'Settings' menu

//old
// const pages = [
//   { text: "Pending Requests", href: "/PendingRequests" },
//   { text: "Make A request", href: "/RequestForm" },
// ];

const pagesAuth = [
  { text: "Pending Requests", href: "/PendingRequests" },
  { text: "Calendar", href: "/Calendar" },
];

const pagesNonAuth = [
  { text: "Make A request", href: "/RequestForm" },
];

const settings = [{ text: "Login", href: "/Login" }];

function HeaderBar() {
  const [anchorElNav, setAnchorElNav] = React.useState(null);
  const [anchorElUser, setAnchorElUser] = React.useState(null);
  const [, isAuth] = useAtom(isAuthAtom);
  const location = useLocation();
  let pagesToRender = isAuth() ? pagesAuth : pagesNonAuth;
  if (location.pathname === "/Calendar" && isAuth()) {
    pagesToRender = [{ text: "Pending Requests", href: "/PendingRequests" }];
  } 
  else if (location.pathname === "/PendingRequests" && isAuth()) {
    pagesToRender = [{ text: "Calendar", href: "/Calendar" }];
  }
  else if (isAuth()) //to fix bug when rendering when first logging in
  {
    pagesToRender = pagesAuth;
  }
  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };
  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  return (
    <AppBar position="static">
      <Container maxWidth="false">
        <Toolbar disableGutters>
          <a href="/"><img
            src="https://www.candortransport.com/static/images/candorlogo.png"
            className="candorLogo"
            alt="Candor Logo"
            component={RouterLink}
          /></a>

          <Box sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "left",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "left",
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{
                display: { xs: "block", md: "none" },
              }}
            >
              {pagesToRender.map((page) => (
                <Button
                  key={page.text}
                  onClick={handleCloseNavMenu}
                  component={RouterLink}
                  to={page.href}
                  sx={{ my: 2, display: "block" }}
                >
                  {page.text}
                </Button>
              ))}
            </Menu>
          </Box>

          <Box
            sx={{
              flexGrow: 1,
              justifyContent: "flex-end",
              display: { xs: "none", md: "flex" },
            }}
          >
            {pagesToRender.map((page) => (
              <Button
                key={page.text}
                onClick={handleCloseNavMenu}
                component={RouterLink}
                to={page.href}
                sx={{ my: 2, color: "white", display: "block" }}
              >
                {page.text}
              </Button>
            ))}
          </Box>

          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Open Settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar alt="Remy Sharp" src="/static/images/avatar/2.jpg" />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: "45px" }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              {settings.map((setting) => (
                <MenuItem key={setting} onClick={handleCloseUserMenu}>
                  <Typography textAlign="center">
                    {isAuth() ? (
                      <Button
                        onClick={handleCloseNavMenu}
                        component={RouterLink}
                        to="/logout"
                      >
                        Logout
                      </Button>
                    ) : (
                      <Button
                        key={setting.text}
                        onClick={handleCloseNavMenu}
                        component={RouterLink}
                        to={setting.href}
                      >
                        {setting.text}
                      </Button>
                    )}
                  </Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default HeaderBar;