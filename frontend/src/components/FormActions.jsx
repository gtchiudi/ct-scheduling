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
  submitButtonDisabled,
}) {
  const formEnd = (
    <Box>
      <TextField
        label="Driver Phone Number"
        name="driver_phone_number"
        value={requestData.driver_phone_number ?? ""}
        onChange={handleChange}
        autoComplete="off"
        error={driverPhoneError}
        helperText={driverPhoneError ? "Phone number must be 10 digits" : ""}
        InputProps={{
          readOnly: requestData.check_in_time != null ? true : false,
          inputComponent: PhoneMaskCustom,
        }}
      />
      <Typography>
        Read to Driver: Do you consent to receive recurring appointment updates
        via SMS from Candor Logistics? Msg and data rates may apply.
      </Typography>
      <FormControlLabel
        control={<Checkbox />}
        label="SMS Consent"
        name="sms_consent"
        checked={requestData.sms_consent}
        onChange={handleChange}
        disabled={requestData.check_in_time != null ? true : false}
      />
    </Box>
  );

  const checkedInContent = (
    <Box>
      <DateTimeField
        readOnly
        label="Checked-In Time"
        name="check_in_time"
        value={requestData.check_in_time ? dayjs(requestData.check_in_time) : undefined}
      />
      <TextField
        required
        id="dock_number"
        label="Dock Number"
        name="dock_number"
        defaultValue={requestData.dock_number ?? ""}
        autoComplete="off"
        InputProps={{
          readOnly: requestData.dock_number != null ? true : false,
        }}
      />
    </Box>
  );

  const dockedContent = (
    <Box>
      {checkedInContent}
      <DateTimeField
        readOnly
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
        readOnly
        label="Completed Time"
        name="completed_time"
        value={requestData.completed_time ? dayjs(requestData.completed_time) : undefined}
      />
    </Box>
  );

  if (path === "/PendingRequests") {
    return (
      <Stack display="flex" justifyContent="center" spacing={2} direction="row">
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
          <Button name="dock_number" variant="contained" onClick={handleButton} disabled={!!formAlert?.onAcknowledge}>
            Send To Dock
          </Button>
        </Box>
      );
    }

    if (requestData.completed_time == null) {
      return (
        <Box>
          {formEnd}
          {dockedContent}
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
