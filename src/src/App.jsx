import './App.css';
import Calendar from './components/Calendar';

import HeaderBar from './components/HeaderBar';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

function App() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div className="App">
        <HeaderBar />

      </div>
    </LocalizationProvider> 
  );
}
 
export default App;
