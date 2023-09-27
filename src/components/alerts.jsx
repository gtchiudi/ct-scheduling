import React from 'react';
//import './Popup.css';

function Popup(props) {
  return (
    <div className="popup">
      <div className="popup-content">
        <span className="close-button" onClick={props.onClose}>
          &times;
        </span>
        <h2>{props.title}</h2>
        <p>{props.message}</p>
        <div className="popup-buttons">
          <button onClick={() => props.onConfirm()}>Confirm</button>
          <button onClick={() => props.onCancel()}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default Popup;