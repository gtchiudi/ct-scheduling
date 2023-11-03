
export function FilledForm({request}){
  const queryClient = useQueryClient();

  const [requestData, setRequestData] = useState({
    id: request.id || null,
    approved: request.approved || false,
    company_name: request.company_name || "",
    phone_number: request.phone_number || "",
    email: request.email || "",
    warehouse: request.warehouse || "",
    po_number: request.po_number || "",
    load_type: request.load_type || "",
    container_drop: request.container_drop || false,
    container_number: request.container_number || "",
    note_section: request.note_section || "",
    date_time: dayjs(request.date_time) || new dayjs(),
    delivery: request.delivery || false,
    trailer_number: request.trailer_number || "",
    driver_phone_number: request.driver_phone || "",
    dock_number: request.dock_number || "",
    check_in_time: request.check_in_time || null,
    docked_time: request.docked_time || null,
    completed_time: request.completed_time || null,
    active: request.active || true
  });

  const UpdateRequest = async () => {
    
    try { 
      await axios.put(`http://localhost:5173/api/request/${requestData.id}`, requestData
      ).then((response) => {
        console.log(response.data);
      });      
      queryClient.invalidateQueries("PendingRequests");
      (requestData.active) ? null : useNavigate('/RequestList')
    } catch (error) {
      console.error("Error updating request:", error);
      useNavigate('/RequestList')
    };
  };

  // This handles the updating of the requests status.
  // When a button is pressed, this function will be called and depending on the current state
  //    of the request will be updated accordingly.
const handleButton = (e) => {
  const { name } = e.target;
  switch (name){
    case "approve":
      setRequestData({...requestData, [name]: true});
      break;
    case "deny":
      setRequestData({...requestData, [name]: false});
      setactive(false);
      // should probably trigger an event to tell the requestor to submit anew
      break;
    case "check_in_time":
      setRequestData({...requestData, [name]: dayjs().format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]")});
      break;
    case "docked_time":
      setRequestData({...requestData, [name]: dayjs().format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]")});
      break;
    case "completed_time":
      setRequestData({...requestData, [name]: dayjs().format("YYYY-MM-DD HH:mm:ss.SSSSSS[Z]")});
      break;
    default:
      break;
  }
  UpdateRequest();
}
  // This controls the dyanmic display of buttons based on the state of the request
  // BUTTONS ARE MISSING onClick FUNCTIONALITY
  let formButton;
  if (!requestData.approved) {

    formButton = <div><Button name="approve" variant="contained" onClick={handleButton}> Approve </Button> <Button id="deny" variant="contained" onClick={handleButton}> Deny </Button></div> 

  } else if (requestData.checkedTime == null) {

    formButton = <Button name="check_in_time" variant="contained" onClick={handleButton}> Check-In </Button>

  } else if (requestData.checkedTime != null && requestData.dockTime == null) {

    formButton = <Button name="docked_time" variant="contained" onClick={handleButton}> Dock </Button>

  } else if (requestData.checkedTime != null && requestData.dockTime != null && requestData.completeTime == null) {
    
    formButton = <Button name="completed_time" variant="contained" onClick={handleButton}> Complete </Button>

  } else {

    formButton = <Button disabled variant="contained" color="red"> Error - See Admin </Button>
  
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "container_drop" || name === "delivery") {
      setRequestData({ ...requestData, [name]: e.target.checked });
      return;
    }
    setRequestData({ ...requestData, [name]: value });
  };


  return (
    <Typography textAlign={"center"}>
      <FormControl>
        <Box
          component="form"
          justifyContent="center"
          alignItems="center"
          display="flex"
          margin="normal"
          sx={{
            "& .MuiTextField-root": { m: 1, width: "40ch" },
            "& > :not(style)": { m: 1, width: "40ch" },
          }}
          noValidate
          autoComplete="off"
        >
          <div>
            <FormLabel for="company_name">Information for request</FormLabel>
            <TextField
              readOnly
              label="Company Name"
              name="company_name"
              value={requestData.company_name}
              onChange={handleChange}
            ></TextField>

            <TextField
              readOnly
              label="Phone Number"
              name="phone_number"
              value={requestData.phone_number}
              onChange={handleChange}
            ></TextField>

            <TextField
              readOnly
              label="Email"
              name="email"
              value={requestData.email}
              onChange={handleChange}
            ></TextField>

            <TextField
              readOnly
              label="PO Number"
              name="po_number"
              value={requestData.po_number}
              onChange={handleChange}
            ></TextField>

            <TextField
              readOnly
              label="Warehouse"
              name="warehouse"
              value={requestData.warehouse}
              onChange={handleChange}
            ></TextField>

            <TextField
              readOnly
              label="Load Type"
              name="load_type"
              value={requestData.load_type}
              onChange={handleChange}
            ></TextField>

            {requestData.container_drop ? (
              <TextField
                readOnly
                label="Container Number"
                name="container_number"
                value={requestData.container_number}
                onChange={handleChange}
              />
            ) : null}

            <FormControlLabel
              control={<Checkbox />}
              label="Delivery"
              name="delivery"
              checked={requestData.delivery}
              onChange={handleChange}
            />

            <DateTimeField readOnly label="Request Time" value={requestData.date_time} />

            <TextField
              readOnly
              label="Trailer Number"
              name="trailer_number"
              value={requestData.trailer_number}
              onChange={handleChange}
            />

            <TextField
              readOnly
              label="Driver Phone #"
              name="driver_phone_number"
              value={requestData.driver_phone_number}
              onChange={handleChange}
            />

            <TextField
              readOnly
              label="Dock Number"
              name="dock_number"
              value={requestData.dock_number}
              onChange={handleChange}
            />

            <TextField
              readOnly
              label="Checked-In Time"
              value={requestData.check_in_time} // This data is not yet a part of the request (Expected: request.checkedTime)
              // On change will be handled by buttons below that update the request
            />

            <DateTimeField
              readOnly
              label="Docked Time"
              value={requestData.docked_time} // This data is not yet a part of the request (Expected: request.dockTime)
              // On change will be handled by buttons below that update the request
            />

            <DateTimeField
              readOnly
              label="Completed Time"
              value={requestData.completed_time} // This data is not yet a part of the request (Expected: request.compleTime)
              // On change will be handled by buttons below that update the request
            />

            <TextField
              readOnly
              multiline
              rows={4}
              label="Notes"
              name="note_section"
              value={requestData.note_section}
              onChange={handleChange}
            />

            {formButton}
          </div>
        </Box>
      </FormControl>
    </Typography>
  );
