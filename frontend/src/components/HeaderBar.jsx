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
  Experimental_CssVarsProvider,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useAtom } from "jotai";
import { authenticatedAtom, userGroupsAtom } from "../components/atoms.jsx";

// Add Links to header here using same format as Request List
// This is the only part that needs modified to change the header links
// text: <== This changes what actual text displays
// href: <== This changes what the header button links to
// All of this is the same for the 'Settings' menu

const pagesNonAuth = [
  { text: "REQUEST PICKUP/DELIVERY", href: "/RequestForm" },
];


function HeaderBar() {
  const [anchorElNav, setAnchorElNav] = React.useState(null);
  const [anchorElUser, setAnchorElUser] = React.useState(null);
  const [authenticated] = useAtom(authenticatedAtom);
  const userGroups = useAtom(userGroupsAtom)[0];
  const location = useLocation();
  let pagesToRender = pagesNonAuth;
  let settings = [{ text: "Login", href: "/Login" }];
  console.log(location.pathname)
  console.log(userGroups)

  if (authenticated){
    if (location.pathname === '/'){
      if (userGroups.includes('Dock'))
        pagesToRender = [{ text: "Calendar", href: "/Calendar" },];
      else
        pagesToRender = [
          { text: "Pending Requests", href: "/PendingRequests" },
          { text: "Calendar", href: "/Calendar" },
        ];
      }
    else if (location.pathname === '/Calendar'){
      if (userGroups.includes('Dock'))
        pagesToRender = [{text: 'Home', href: '/'}];
      else
        pagesToRender = [{text: 'Pending Requests', href: '/PendingRequests'}];
    }
    else if (location.pathname === '/PendingRequests')
      pagesToRender = [{text: 'Calendar', href: '/Calendar'}];

    if (userGroups.includes('Admin'))
      settings = [
        {text: 'Logout', href: '/logout'},
        {text: 'Admin Page', href: '/Admin'}
      ];
    else
      settings = [{text: 'Logout', href: '/logout'}];

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
    <AppBar
      position="sticky"
      style={{ border: "1px solid rgba(0, 0, 0, 0.1)" }}
    >
      <Container maxWidth="false">
        <Toolbar disableGutters>
          <a href="/">
            <img
              src="//img1.wsimg.com/isteam/ip/f69d92aa-cce5-4851-89e5-56380f14d8f1/candorlogo.png/:/rs=h:75,cg:true,m/qt=q:100/ll"
              className="candorLogo"
              alt="Candor Logo"
              component={RouterLink}
            />
          </a>

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
                <MenuItem key={setting.text} onClick={handleCloseUserMenu}>
                  <Typography textAlign="center">
                    <Button
                      key={setting.href}
                      onClick={handleCloseNavMenu}
                      component={RouterLink}
                      to={setting.href}
                    >
                      {setting.text}
                    </Button>
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
