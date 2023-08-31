import "./App.css";
import "vite/modulepreload-polyfill";

import HeaderBar from "../components/HeaderBar";
import RequestList from "../components/RequestList";

function App() {
  return (
    <div>
      <HeaderBar />
    </div>
  );
}

export default App;
