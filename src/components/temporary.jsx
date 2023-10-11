<TextField
readOnly
label="Company Name"
value={requestData.company_name}
></TextField>

<TextField
readOnly
label="Phone Number"
value={_phone}
></TextField>
  
<TextField
readOnly
label="Email"
value={_email}
></TextField> 

<TextField
readOnly
label="PO Number"
value={_po_number}
></TextField>

<TextField
readOnly
label="Warehouse"
value={_warehouse}
></TextField>

<TextField
readOnly
label="Load Type"
value={_load_type}
></TextField>

<FormControlLabel
control={<Checkbox />}
label="Delivery"
checked={_delivery} />