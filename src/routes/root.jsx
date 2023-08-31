import "../App.css";
import "vite/modulepreload-polyfill";
import { Outlet } from "react-router-dom";
import HeaderBar from "../components/HeaderBar";

function root() {
  return (
    <div>
      <HeaderBar />
      <div id="requestList">
        <Outlet />
      </div>
    </div>
  );
}

export default root;
