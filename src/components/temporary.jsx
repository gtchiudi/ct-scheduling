export function EditForm({ request, closeModal }) {
  const queryClient = useQueryClient();
  const [warehouseData] = useAtom(warehouseDataAtom);
  const [, updateWarehouseData] = useAtom(updateWarehouseDataAtom);
  // [accessToken] = useAtom(accessTokenAtom);

  React.useEffect(() => {
    updateWarehouseData();
  }, [updateWarehouseData]);

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
    notes: request.note_section || "",
    date_time: dayjs(request.date_time) || new dayjs(),
    delivery: request.delivery || false,
    trailerNum: request.trailer_number || "",
  });
  const load_types = [
    {
      value: "Full",
    },
    {
      value: "LTL",
    },
    {
      value: "Container",
    },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "container_drop" || name === "delivery") {
      setRequestData({ ...requestData, [name]: e.target.checked });
      return;
    }
    setRequestData({ ...requestData, [name]: value });
  };

  const handleDateChange = (date) => {
    setRequestData({
      ...requestData,
      date_time: date,
    });
  };

  const handleApprove = () => {
    requestData.approved = true;
    requestData.date_time = requestData.date_time.format(
      "YYYY-MM-DD HH:mm:ss.SSSSSS[Z]"
    );
    approveRequest();
  };

  const approveRequest = async () => {
    try {
      const response = await axios.put(
        `/api/request/${requestData.id}/`,
        requestData
      );
      queryClient.invalidateQueries("pendingRequests");
      closeModal();
    } catch (error) {
      console.error("Error updating request:", error);
      closeModal();
    }
  };

  return (
    <FormControl>
      <Stack
        spacing={2}
        alignContent={"center"}
        textAlign={"center"}
        display={"flex"}
        sx={{
          "& .MuiTextField-root": { m: 1, width: "40ch" },
          "& > :not(style)": { m: 1, width: "40ch" },
          maxHeight: "90vh",
          maxWidth: "60vw",
        }}
        noValidate
        autoComplete="off"
      >
        <TextField
          label="Company Name"
          name="company_name"
          value={requestData.company_name}
          onChange={handleChange}
        ></TextField>

        <TextField
          label="Phone Number"
          name="phone_number"
          value={requestData.phone_number}
          onChange={handleChange}
        ></TextField>

        <TextField
          label="Email"
          name="email"
          value={requestData.email}
          onChange={handleChange}
        ></TextField>

        <TextField
          label="PO Number"
          name="po_number"
          value={requestData.po_number}
          onChange={handleChange}
        ></TextField>

        <TextField
          select
          id="warehouse"
          label="Warehouse"
          name="warehouse"
          variant="filled"
          value={requestData.warehouse}
          onChange={handleChange}
        >
          {warehouseData.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          id="load_type"
          label="Load Type"
          name="load_type"
          variant="filled"
          value={requestData.load_type}
          onChange={handleChange}
        >
          {load_types.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.value}
            </MenuItem>
          ))}
        </TextField>

        <div>
          {requestData.load_type === "Container" ? (
            <Box>
              <FormControlLabel
                control={<Checkbox />}
                label="Select for Container Drop"
                name="container_drop"
                checked={requestData.container_drop}
                onChange={handleChange}
              />
              <TextField
                label="Container Number"
                name="container_number"
                value={requestData.container_number}
                onChange={handleChange}
              ></TextField>
            </Box>
          ) : null}
        </div>

        <DateTimePicker
          value={dayjs(requestData.date_time)}
          onChange={(newValue) => handleDateChange(newValue)}
        />
        <Box>
          <FormControlLabel
            control={<Checkbox />}
            label="Delivery"
            name="delivery"
            checked={requestData.delivery}
            onChange={handleChange}
          />
        </Box>
        <Button onClick={handleApprove}>Approve Request</Button>
      </Stack>
    </FormControl>
  );
}
