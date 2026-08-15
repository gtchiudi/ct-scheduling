import React from "react";
import ReactDOM from "react-dom/client";
import ErrorPage from "./routes/error-page.jsx";
import "./index.css";
import "./App.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { Provider as JotaiProvider } from "jotai";
import { ThemeProvider } from "@mui/material/styles";
import theme from "./theme.js";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
import Home from "./routes/Home.jsx";
import Layout from "./components/Layout.jsx";
import { CircularProgress, Box } from "@mui/material";

const Login = React.lazy(() => import("./routes/Login.jsx"));
const Logout = React.lazy(() => import("./routes/Logout.jsx"));
const RequestForm = React.lazy(() => import("./routes/RequestForm.jsx"));
const PendingRequests = React.lazy(() => import("./routes/PendingRequests.jsx"));
const Calendar = React.lazy(() => import("./routes/Calendar.jsx"));

function RouteFallback() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
      <CircularProgress />
    </Box>
  );
}

const queryClient = new QueryClient();
const root = ReactDOM.createRoot(document.getElementById("root"));

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Layout>
        <Home />
      </Layout>
    ), // Wrap Home with Layout
    errorElement: <ErrorPage />,
  },
  {
    path: "RequestForm",
    element: (
      <Layout>
        <React.Suspense fallback={<RouteFallback />}>
          <RequestForm />
        </React.Suspense>
      </Layout>
    ), // Wrap RequestForm with Layout
    errorElement: <ErrorPage />,
  },
  {
    path: "login",
    element: (
      <Layout>
        <React.Suspense fallback={<RouteFallback />}>
          <Login />
        </React.Suspense>
      </Layout>
    ), // Wrap Login with Layout
    errorElement: <ErrorPage />,
  },
  {
    path: "logout",
    element: (
      <Layout>
        <React.Suspense fallback={<RouteFallback />}>
          <Logout />
        </React.Suspense>
      </Layout>
    ), // Wrap Logout with Layout
    errorElement: <ErrorPage />,
  },
  {
    path: "PendingRequests",
    element: (
      <Layout>
        <React.Suspense fallback={<RouteFallback />}>
          <PendingRequests />
        </React.Suspense>
      </Layout>
    ), // Wrap PendingRequests with Layout
    errorElement: <ErrorPage />,
  },
  {
    path: "Calendar",
    element: (
      <Layout>
        <React.Suspense fallback={<RouteFallback />}>
          <Calendar />
        </React.Suspense>
      </Layout>
    ),
  },
]);

root.render(
  <React.StrictMode>
    <JotaiProvider>
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <RouterProvider router={router} />
          </LocalizationProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </JotaiProvider>
  </React.StrictMode>
);
