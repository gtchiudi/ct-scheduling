import React from "react";
import ReactDOM from "react-dom/client";
import Root from "./routes/root.jsx";
import ErrorPage from "./error-page.jsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import RequestList from "./routes/RequestList.jsx";
import HeaderBar from "./components/HeaderBar.jsx";
import Login from "./components/Login.jsx";
import Home from "./routes/Home.jsx";
import RequestForm from "./routes/RequestForm.jsx";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    errorElement: <ErrorPage />,
  },
  {
    path: "RequestList",
    element: <RequestList />,
  },
  {
    path: "RequestForm",
    element: <RequestForm />,
  },
  {
    path: "login",
    element: <Login />,
  },
  {
    path: "home",
    element: <Home />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <HeaderBar />
        <RouterProvider router={router} />
      </LocalizationProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
