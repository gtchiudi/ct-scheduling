import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import {
  isAuthAtom,
  refreshAtom,
  warehouseDataAtom,
  updateWarehouseDataAtom,
} from "../components/atoms.jsx";
import { useQuery } from "@tanstack/react-query";
import { PropTypes } from "prop-types";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Paper from "@mui/material/Paper";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Button from "@mui/material/Button";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import Typography from "@mui/material/Typography";
import { visuallyHidden } from "@mui/utils";
import Form from "../components/Form.jsx";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import dayjs from "dayjs";

function descendingComparator(a, b, orderBy) {
  // used to sort table
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }

  return 0;
}

function getComparator(order, orderBy) {
  // used to sort table
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort(array, comparator) {
  // sort table by comparator
  const stabilizedThis = array.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) {
      return order;
    }
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

const headCells = [
  // table headers
  {
    id: "company_name",
    numeric: false,
    disablePadding: true,
    label: "Company Name",
  },
  {
    id: "email",
    numeric: false,
    disablePadding: false,
    label: "Email",
  },
  {
    id: "po_number",
    numeric: true,
    disablePadding: false,
    label: "PO Number",
  },
  {
    id: "warehouse",
    numeric: false,
    disablePadding: false,
    label: "Warehouse",
  },
  {
    id: "load_type",
    numeric: false,
    disablePadding: false,
    label: "Load Type",
  },
  {
    id: "date_time",
    numeric: false,
    disablePadding: false,
    label: "Date Time",
  },
  {
    id: "delivery",
    numeric: false,
    disablePadding: false,
    label: "Delivery/Pickup",
  },
];
function EnhancedTableHead(props) {
  const { order, orderBy, rowCount, onRequestSort } = props;
  const createSortHandler = (property) => (event) => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        <TableCell></TableCell>
        {headCells.map((headCell) => (
          <TableCell
            key={headCell.id}
            align={"left"}
            padding={headCell.disablePadding ? "none" : "normal"}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : "asc"}
              onClick={createSortHandler(headCell.id)}
            >
              {headCell.label}
              {orderBy === headCell.id ? (
                <Box component="span" sx={visuallyHidden}>
                  {order === "desc" ? "sorted descending" : "sorted ascending"}
                </Box>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}
EnhancedTableHead.propTypes = {
  onRequestSort: PropTypes.func.isRequired,
  order: PropTypes.oneOf(["asc", "desc"]).isRequired,
  orderBy: PropTypes.string.isRequired,
  rowCount: PropTypes.number.isRequired,
};

export default function PendingRequests() {
  const navigate = useNavigate(); // used to navigate to other pages
  const [, isAuth] = useAtom(isAuthAtom); // used to check if user is authenticated
  const [authorized, setAuthorized] = React.useState(isAuth()); // store if user is authorized
  const queryClient = useQueryClient(); // used to get query client
  const [refresh, setRefresh] = useAtom(refreshAtom); // used as refresh token tag for error 401 handling
  const [pauseQuery, setPause] = useState(false); // used to pause query
  const [warehouseData] = useAtom(warehouseDataAtom);
  const [, updateWarehouseData] = useAtom(updateWarehouseDataAtom);

  let rows = useState([]); // store rows of table
  React.useEffect(() => {
    updateWarehouseData();
    console.log(warehouseData);
  }, []);

  function getWarehouseNameById(id) {
    const warehouse = warehouseData.find((warehouse) => warehouse.id === id);
    return warehouse ? warehouse.name : "Warehouse not found";
  }

  React.useEffect(() => {
    // check authentication then set interval to check authentication every 30 seconds

    setPause(true);
    setAuthorized(isAuth());
    if (!authorized) {
      navigate("/Login");
    }
    const intervalId = setInterval(() => {
      setPause(true);
      setAuthorized(isAuth());
      if (!authorized) {
        navigate("/Login");
      }
      setPause(false);
    }, 30000);
    setPause(false);
    // Clean up the interval when the component unmounts
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const result = useQuery({
    // query to get pending requests
    queryKey: ["pendingRequests"],
    queryFn: async () =>
      await axios.get("/api/request", {
        // get all requests that are not approved
        params: {
          approved: "False",
        },
        withCredentials: true,
      }),
    refetchInterval: 30000, // refetch every 30 seconds
    retry: 1, // retry once
    retryDelay: 1000, // retry after 1 second
    enabled: !pauseQuery, // pause query if pauseQuery is true
    onError: (error) => {
      if (error.response && error.response.status === 401) {
        // Check if token refresh is already in progress
        setPause(true); // pause query
        if (!refresh) {
          // run if not already refreshing
          setRefresh(true); // set refresh to true
          setAuthorized(isAuth()); // check if user is authorized

          if (!authorized) {
            queryClient.cancelQueries(["pendingRequests"]); // cancel query
            navigate("/logout"); // navigate to logout
          }
        }
        queryClient.invalidateQueries(["pendingRequests"]); // invalidate query
        setPause(false); // unpause query
      }
    },
  });

  if (result.isSuccess) {
    rows = result.data.data;
  }

  const [open, setOpen] = React.useState(false);
  const [order, setOrder] = React.useState("asc");
  const [orderBy, setOrderBy] = React.useState("date_time");
  const [selected, setSelected] = React.useState([]);
  const [page, setPage] = React.useState(0);
  const [dense, setDense] = React.useState(false);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);

  // variables used for table functions

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const closeDialog = () => {
    // remove the selected request from the table and close dialog
    const updatedRows = rows.filter((row) => row.id !== selected.id);
    rows = updatedRows;
    setOpen(false);
  };

  const handleClick = (event, row) => {
    // set selected request and open dialog
    setSelected(row);
    setOpen(true);
  };

  const handleChangePage = (event, newPage) => {
    // change page
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    // change rows per page
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleChangeDense = (event) => {
    // change dense
    setDense(event.target.checked);
  };

  const isSelected = (row) => selected.id === row.id; // check if row is selected

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows = // check if there are no rows
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0;
  const visibleRows = React.useMemo(
    // get visible rows
    () =>
      stableSort(rows, getComparator(order, orderBy)).slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      ),
    [order, orderBy, page, rowsPerPage, rows]
  );

  return (
    <div>
      {open && ( // dialog open if open is true
        <Dialog open={open} onClose={closeDialog}>
          <DialogTitle textAlign={"center"}>
            Edit and Approve Request
          </DialogTitle>
          <DialogContent>
            <Form request={selected} closeModal={closeDialog} />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
          </DialogActions>
        </Dialog>
      )}
      {result.isLoading && ( // query is loading
        <div>
          <br />
          <Typography textAlign="center" variant="h2">
            Loading...
          </Typography>
        </div>
      )}
      {result.isError && ( // query has error
        <div>
          <br />
          <Typography textAlign="center" variant="h2">
            Error: {result.error.message}
          </Typography>
        </div>
      )}
      {result.isSuccess &&
        result.data.data.length === 0 && ( // no data
          <div>
            <br />
            <Typography textAlign="center" variant="h2">
              No Pending Requests
            </Typography>
          </div>
        )}
      {result.isSuccess &&
        result.data.data.length > 0 && ( // load/populate table
          <Box sx={{ width: "100%" }}>
            <Paper sx={{ width: "100%", mb: 2 }}>
              <TableContainer>
                <Table
                  sx={{ minWidth: 750 }}
                  aria-labelledby="tableTitle"
                  size={dense ? "small" : "medium"}
                >
                  <EnhancedTableHead
                    numSelected={selected.length}
                    order={order}
                    orderBy={orderBy}
                    onRequestSort={handleRequestSort}
                    rowCount={result.data.data.length}
                  />
                  <TableBody>
                    {visibleRows.map((row, index) => {
                      const isItemSelected = isSelected(row);
                      const labelId = `enhanced-table-checkbox-${index}`;

                      return (
                        <TableRow
                          hover
                          onClick={(event) => handleClick(event, row)}
                          role="request_popup"
                          aria-checked={isItemSelected}
                          tabIndex={-1}
                          key={row.id}
                          selected={isItemSelected}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell></TableCell>
                          <TableCell
                            component="th"
                            id={labelId}
                            scope="row"
                            padding="none"
                          >
                            {row.company_name}
                          </TableCell>
                          <TableCell align="left">{row.email}</TableCell>
                          <TableCell align="left">{row.po_number}</TableCell>
                          <TableCell align="left">
                            {getWarehouseNameById(row.warehouse)}
                          </TableCell>
                          <TableCell align="left">{row.load_type}</TableCell>
                          <TableCell align="left">
                            {dayjs(row.date_time).format("MM/DD/YYYY hh:mm A")}
                          </TableCell>
                          <TableCell align="left">
                            {row.delivery ? "Delivery" : "Pickup"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {emptyRows > 0 && (
                      <TableRow
                        style={{
                          height: (dense ? 33 : 53) * emptyRows,
                        }}
                      >
                        <TableCell colSpan={6} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={result.data.data.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </Paper>
            <FormControlLabel
              control={<Switch checked={dense} onChange={handleChangeDense} />}
              label="Dense padding"
            />
          </Box>
        )}
    </div>
  );
}
