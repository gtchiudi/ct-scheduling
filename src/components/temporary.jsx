<FormControl>
            <div>
              <FormLabel htmlFor="company_name">Request Edit</FormLabel>
              <br />
              <TextField
                required
                id="company_name"
                name="company_name"
                value={requestData.company_name}
                label="Company Name"
                variant="filled"
                onChange={handleChange}
              />
              <br />
              <TextField
                id="phone_number"
                name="phone_number"
                value={requestData.phone_number}
                label="Phone Number"
                variant="standard"
                onChange={handleChange}
              />
              <br />
              <TextField
                required
                id="email"
                name="email"
                value={requestData.email}
                label="E-mail"
                variant="filled"
                onChange={handleChange}
              />
              <br />
              <TextField
                required
                id="po_number"
                name="po_number"
                value={requestData.po_number}
                label="PO Number"
                variant="filled"
                onChange={handleChange}
              />
              <br />
              <TextField
                select
                required
                id="warehouse"
                name="warehouse"
                label="Warehouse"
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
              <br />
              <TextField
                select
                required
                id="load_type"
                name="load_type"
                label="Load Type"
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
              <br />
              <DatePicker
                value={requestData.date_time}
                onChange={handleDateChange}
              />
              <br />
              <Button onClick={AddDeliveryRequest} variant="contained">
                Approve
              </Button>
              
            </div>
          </FormControl>