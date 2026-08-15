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
  Stack,
  Badge,
  Divider,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useAtom } from "jotai";
import { authenticatedAtom, userGroupsAtom, userInitialAtom } from "../components/atoms.jsx";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import candorLogo from "../assets/candor-logo.png";

// Add Links to header here using same format as Request List
// This is the only part that needs modified to change the header links
// text: <== This changes what actual text displays
// href: <== This changes what the header button links to
// All of this is the same for the 'Settings' menu

const pagesNonAuth = [
  { text: "REQUEST PICKUP/DELIVERY", mobileText: "REQUEST", href: "/RequestForm" },
];


function HeaderBar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [anchorElUser, setAnchorElUser] = React.useState(null);
  const [authenticated] = useAtom(authenticatedAtom);
  const userGroups = useAtom(userGroupsAtom)[0];
  const [userInitial] = useAtom(userInitialAtom);
  const location = useLocation();
  // "REQUEST PICKUP/DELIVERY" is the anonymous-visitor CTA — an authenticated
  // user whose group doesn't match any case below (e.g. mid-load, or a group
  // this list doesn't know about) should see no extra nav links, never that.
  let pagesToRender = authenticated ? [] : pagesNonAuth;
  let settings = [{ text: "Login", href: "/Login" }];

  // Query for pending request stats
  const { data: pendingStats } = useQuery({
    queryKey: ['pendingStats'],
    queryFn: async () => {
      const response = await axios.get('/api/pending-requests-stats/');
      return response.data;
    },
    enabled: authenticated && !userGroups.includes('Dock') && (location.pathname === '/' || location.pathname === '/Calendar'), // Only fetch if authenticated and not Dock user
    refetchInterval: 90000, // Refetch every 90 seconds
    staleTime: 45000, // data considered fresh for 45 seconds
    retry: 3,
    retryDelay: 1000,
  });

  const pendingCount = pendingStats?.pending_count || 0;
  const hasUrgentRequests = pendingStats?.has_urgent_requests || false;

  if (authenticated){
    if (location.pathname === '/' || location.pathname === '/RequestForm'){
      if (userGroups.some(g => ['Admin', 'Dispatch'].includes(g)))
        pagesToRender = [
          { 
            text: "Pending Requests", 
            href: "/PendingRequests",
            color: hasUrgentRequests ? "error" : "warning"
          },
          { text: "Calendar", href: "/Calendar" },
        ];
      else if (userGroups.includes('Dock'))
        pagesToRender = [{ text: "Calendar", href: "/Calendar" }];
      }
    else if (location.pathname === '/Calendar'){
      if (userGroups.some(g => ['Admin', 'Dispatch'].includes(g)))
        pagesToRender = [{
          text: 'Pending Requests', 
          href: '/PendingRequests',
          color: hasUrgentRequests ? "error" : "warning"
        }];
      else if (userGroups.includes('Dock'))
        pagesToRender = [{text: 'Home', href: '/'}];
    }
    else if (location.pathname === '/PendingRequests')
      pagesToRender = [{text: 'Calendar', href: '/Calendar'}];


    if (userGroups.includes('Admin'))
      settings = [
        {text: 'Logout', href: '/logout'},
        {text: 'Admin Page', href: '/admin/', component: 'a'}
      ];
    else
      settings = [{text: 'Logout', href: '/logout'}];

  }

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  return (
    <AppBar
      position="fixed"
      style={{ border: "1px solid rgba(0, 0, 0, 0.1)" }}
    >
      <Container maxWidth="false">
        <Toolbar disableGutters>
          <a href="/">
            <img
              src={candorLogo}
              className="candorLogo"
              alt="Candor Logo"
              width={291}
              height={75}
              loading="eager"
            />
          </a>

          <Box sx={{ flexGrow: 1 }} />

          {/* Unauthenticated visitors have no avatar/user menu to fall back into on
              mobile, so their single link stays visible at every width; authenticated
              users get it below md via the avatar menu instead (see settings Menu). */}
          <Box
            sx={{
              justifyContent: "flex-end",
              display: authenticated ? { xs: "none", md: "flex" } : "flex",
            }}
          >
            <Stack
              spacing={2} 
              direction="row" 
              justifyContent= 'flex-end'
              sx={{ 
                color: 'action.active'
              }}
            >
              {pagesToRender.map((page) => (
                <Badge 
                  key={page.text}
                  color={page.color} 
                  badgeContent={page.text === 'Pending Requests' ? pendingCount : 0} 
                  showZero={page.text === 'Pending Requests'}
                >
                  <Button
                    component={RouterLink}
                    to={page.href}
                    variant="contained"
                    size={isMobile ? "small" : "medium"}
                  >
                    {isMobile ? page.mobileText || page.text : page.text}
                  </Button>
                </Badge>
              ))}
            </Stack>
          </Box>

          <Box sx={{ flexGrow: 0, ml: 2 }}>
            
            {authenticated ? (
              <>
                <Tooltip title="User Menu">
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                    <Avatar>{userInitial}</Avatar>
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
                  {/* Nav links (Pending Requests, Calendar, etc.) — only shown here below
                      md, where the button row above is hidden; this is the only place
                      they're reachable on a narrow screen, so there's no separate menu. */}
                  {pagesToRender.map((page) => (
                    <MenuItem
                      key={page.text}
                      component={RouterLink}
                      to={page.href}
                      onClick={handleCloseUserMenu}
                      sx={{ display: { xs: "flex", md: "none" } }}
                    >
                      <Typography
                        sx={
                          page.text === "Pending Requests" && pendingCount > 0
                            ? { color: `${page.color}.main` }
                            : undefined
                        }
                      >
                        {page.text}
                        {page.text === "Pending Requests" && pendingCount > 0 ? ` (${pendingCount})` : ""}
                      </Typography>
                    </MenuItem>
                  ))}
                  {pagesToRender.length > 0 && (
                    <Divider sx={{ display: { xs: "block", md: "none" } }} />
                  )}
                  {settings.map((setting) => (
                    <MenuItem key={setting.text} onClick={handleCloseUserMenu}>
                      <Typography textAlign="center">
                        <Button
                          key={setting.href}
                          component={setting.component ? setting.component : RouterLink}
                          {...(setting.component === 'a' ? { href: setting.href } : { to: setting.href })}
                        >
                          {setting.text}
                        </Button>
                      </Typography>
                    </MenuItem>
                  ))}
                </Menu>
              </>
            ) : (
              <Button
                component={RouterLink}
                to="/Login"
                variant="contained"
                sx={{ backgroundColor: "grey"}}
              >
                Login
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default HeaderBar;
