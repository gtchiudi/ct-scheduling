import "./App.css";
import "vite/modulepreload-polyfill";

import HeaderBar from "./components/HeaderBar";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import RequestList from "./components/RequestList";

function App() {
  return (
    <div>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <HeaderBar />
        <RequestList />
      </LocalizationProvider>
    </div>
  );
}

export default App;