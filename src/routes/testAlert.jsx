import * as React from "react";
import Popup from '../components/alerts';

export default function TestAlert() {
    const [isOpen, setIsOpen] = React.useState(false);
    const [title, setTitle] = React.useState("");
    const [message, setMessage] = React.useState("");
  
    const openPopup = (title, message) => {
      setTitle(title);
      setMessage(message);
      setIsOpen(true);
    };
  
    const closePopup = () => {
      setIsOpen(false);
    };
  
    return (
      <div>
        <h1>Test</h1>
        <button onClick={() => openPopup("ALERT!", "Test Message")}>
          Open Popup
        </button>
        {isOpen && (
          <Popup
            title={title}
            message={message}
            onClose={closePopup}
            onConfirm={closePopup}
            onCancel={closePopup}
          />
        )}
      </div>
    );
  }
  