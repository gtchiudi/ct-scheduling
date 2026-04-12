import { useState } from "react";
import { Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { DateTimeField } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import PhoneMaskCustom from "./PhoneMaskCustom.jsx";

function FormActions({
  requestData,
  path,
  editAppointment,
  driverPhoneError,
  formAlert,
  handleChange,
  handleButton,
  updateRequest,
  handleNewRequest,
  handleApprove,
  setCancelConfirmOpen,
  setDeclineConfirmOpen,
  submitButtonDisabled,
}) {
  const [dockNumberValue, setDockNumberValue] = useState("");

  const formEnd = (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TextField
          label="Driver Phone Number"
          name="driver_phone_number"
          value={requestData.driver_phone_number ?? ""}
          onChange={handleChange}
          autoComplete="off"
          error={driverPhoneError}
          helperText={driverPhoneError ? "Phone number must be 10 digits" : ""}
          disabled={requestData.check_in_time != null}
          InputProps={{
            inputComponent: PhoneMaskCustom,
          }}
        />
        <FormControlLabel
          control={<Checkbox />}
          label="SMS Consent"
          name="sms_consent"
          checked={requestData.sms_consent}
          onChange={handleChange}
          disabled={requestData.check_in_time != null}
        />
      </Box>
      {requestData.check_in_time == null && (
        <Typography variant="caption" color="text.secondary">
          Read to Driver: Do you consent to receive recurring appointment updates
          via SMS from Candor Logistics? Msg and data rates may apply.
        </Typography>
      )}
    </Box>
  );

  const checkedInContent = (
    <Box>
      <DateTimeField
        disabled
        label="Checked-In Time"
        name="check_in_time"
        value={requestData.check_in_time ? dayjs(requestData.check_in_time) : undefined}
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TextField
          required
          id="dock_number"
          label="Dock Number"
          name="dock_number"
          value={requestData.dock_number ?? dockNumberValue}
          onChange={(e) => setDockNumberValue(e.target.value)}
          autoComplete="off"
          disabled={requestData.dock_number != null || requestData.container_drop}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={requestData.container_drop}
              onChange={handleChange}
              name="container_drop"
              disabled={requestData.dock_number != null}
            />
          }
          label="Drop in Yard"
        />
      </Box>
    </Box>
  );

  const dockedContent = (
    <Box>
      {checkedInContent}
      <DateTimeField
        disabled
        label="Docked Time"
        name="docked_time"
        value={requestData.docked_time ? dayjs(requestData.docked_time) : undefined}
      />
    </Box>
  );

  const completionContent = (
    <Box>
      {dockedContent}
      <DateTimeField
        disabled
        label="Completed Time"
        name="completed_time"
        value={requestData.completed_time ? dayjs(requestData.completed_time) : undefined}
      />
    </Box>
  );

  if (path === "/PendingRequests") {
    return (
      <Stack display="flex" justifyContent="center" spacing={2} direction="row">
        <Button color="error" variant="contained" onClick={() => setDeclineConfirmOpen(true)}>
          Decline
        </Button>
        <Button color="success" variant="contained" onClick={handleApprove} disabled={submitButtonDisabled}>
          Approve
        </Button>
      </Stack>
    );
  }

  if (path === "/RequestForm" || !requestData.approved) {
    return (
      <Box>
        <Button name="submit" variant="contained" onClick={handleNewRequest} disabled={submitButtonDisabled}>
          Submit
        </Button>
      </Box>
    );
  }

  if (path === "/Calendar" && requestData.approved) {
    if (requestData.check_in_time == null) {
      if (editAppointment) {
        return (
          <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
            <Button variant="contained" color="error" onClick={() => setCancelConfirmOpen(true)}>
              Cancel Appointment
            </Button>
            <Button variant="contained" color="success" onClick={updateRequest} disabled={submitButtonDisabled}>
              Save Changes
            </Button>
          </Box>
        );
      }
      const isDriverPhoneValid = !driverPhoneError && (
        !requestData.driver_phone_number ||
        requestData.driver_phone_number.replace(/\D/g, '').length === 10
      );
      return (
        <Box>
          {formEnd}
          <Button name="check_in_time" variant="contained" onClick={handleButton} disabled={!isDriverPhoneValid}>
            Check-In
          </Button>
        </Box>
      );
    }

    if (requestData.dock_number == null) {
      return (
        <Box>
          {formEnd}
          {checkedInContent}
          <TextField
            name="note_section"
            label="Notes"
            multiline
            rows={4}
            value={requestData.note_section ?? ""}
            onChange={handleChange}
            autoComplete="off"
            sx={{ whiteSpace: "pre-wrap", my: 1 }}
          />
          <Button name="dock_number" variant="contained" onClick={handleButton} disabled={(!dockNumberValue && !requestData.container_drop) || !!formAlert?.onAcknowledge}>
            {requestData.container_drop ? "Send To Yard" : "Send To Dock"}
          </Button>
        </Box>
      );
    }

    if (requestData.completed_time == null) {
      return (
        <Box>
          {formEnd}
          {dockedContent}
          <TextField
            name="note_section"
            label="Notes"
            multiline
            rows={4}
            value={requestData.note_section ?? ""}
            onChange={handleChange}
            autoComplete="off"
            sx={{ whiteSpace: "pre-wrap", my: 1 }}
          />
          <Button name="completed_time" variant="contained" onClick={handleButton}>
            Complete
          </Button>
        </Box>
      );
    }

    return (
      <Box>
        {formEnd}
        {completionContent}
        <Button name="remove_from_calendar" variant="contained" onClick={handleButton}>
          Remove from Calendar
        </Button>
      </Box>
    );
  }

  return null;
}

export default FormActions;
