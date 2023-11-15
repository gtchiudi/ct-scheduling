import React from "react";
import ReactDOM from "react-dom/client";
import ErrorPage from "./routes/error-page.jsx";
import "./index.css";
import "./app.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { Provider as JotaiProvider } from "jotai";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import Login from "./routes/Login.jsx";
import Logout from "./routes/Logout.jsx";
import Home from "./routes/Home.jsx";
import RequestList from "./routes/RequestList.jsx";
import RequestForm from "./routes/RequestForm.jsx";
import PendingRequests from "./routes/PendingRequests.jsx";
import Layout from "./components/layout.jsx";
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
    path: "RequestList",
    element: (
      <Layout>
        <RequestList />
      </Layout>
    ), // Wrap RequestList with Layout
  },
  {
    path: "RequestForm",
    element: (
      <Layout>
        <RequestForm />
      </Layout>
    ), // Wrap RequestForm with Layout
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
  },
  {
    path: "PendingRequests",
    element: (
      <Layout>
        <PendingRequests />
      </Layout>
    ), // Wrap PendingRequests with Layout
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
