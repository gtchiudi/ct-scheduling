import React from "react";
import ReactDOM from "react-dom/client";
import ErrorPage from "./routes/error-page.jsx";
import "./index.css";
import "./App.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { Provider as JotaiProvider } from "jotai";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import Login from "./routes/Login.jsx";
import Logout from "./routes/Logout.jsx";
import Home from "./routes/Home.jsx";
import RequestForm from "./routes/RequestForm.jsx";
import PendingRequests from "./routes/PendingRequests.jsx";
import Layout from "./components/Layout.jsx";
import Calendar from "./routes/Calendar.jsx";

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
        <RequestForm />
      </Layout>
    ), // Wrap RequestForm with Layout
    errorElement: <ErrorPage />,
  },
  {
    path: "login",
    element: (
      <Layout>
        <Login />
      </Layout>
    ), // Wrap Login with Layout
    errorElement: <ErrorPage />,
  },
  {
    path: "logout",
    element: (
      <Layout>
        <Logout />
      </Layout>
    ), // Wrap Logout with Layout
    errorElement: <ErrorPage />,
  },
  {
    path: "PendingRequests",
    element: (
      <Layout>
        <PendingRequests />
      </Layout>
    ), // Wrap PendingRequests with Layout
    errorElement: <ErrorPage />,
  },
  {
    path: "Calendar",
    element: (
      <Layout>
        <Calendar />
      </Layout>
    ),
  },
]);

const LinkBehavior = React.forwardRef((props, ref) => (
  <RouterLink ref={ref} to="/" {...props} role={undefined} />
));

root.render(
  <React.StrictMode>
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <RouterProvider router={router} />
        </LocalizationProvider>
      </QueryClientProvider>
    </JotaiProvider>
  </React.StrictMode>
);
