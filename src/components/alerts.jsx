import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';

function Popup(props) {
  return (
    <Dialog open={true} onClose={props.onClose}>
      <DialogTitle>
        <IconButton edge="end" color="inherit" onClick={props.onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
        {props.title}
      </DialogTitle>
      <DialogContent>
        <p>{props.message}</p>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onConfirm()}>Confirm</Button>
        <Button onClick={() => props.onCancel()}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

export default Popup;
