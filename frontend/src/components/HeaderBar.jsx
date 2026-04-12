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
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useAtom } from "jotai";
import { authenticatedAtom, userGroupsAtom, userInitialAtom } from "../components/atoms.jsx";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

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
  const [userInitial] = useAtom(userInitialAtom);
  const location = useLocation();
  let pagesToRender = pagesNonAuth;
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
      position="fixed"
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

          <Box
            sx={{
              flexGrow: 1,
              justifyContent: "flex-end",
              display: { xs: "none", md: "flex" },
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
                    onClick={handleCloseNavMenu}
                    component={RouterLink}
                    to={page.href}
                    variant="contained"
                  >
                    {page.text}
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
                  {settings.map((setting) => (
                    <MenuItem key={setting.text} onClick={handleCloseUserMenu}>
                      <Typography textAlign="center">
                        <Button
                          key={setting.href}
                          onClick={handleCloseNavMenu}
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
