# Use the official Python image as the base image
FROM python:alpine

# Environment variables to optimize Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONBUFFERED=1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    libaio \
    build-base \
    python3-dev \
    musl-dev \
    gcc \
    libffi-dev \
    openssl-dev \
    freetype-dev \
    jpeg-dev \
    zlib-dev \
    mariadb-connector-c-dev \
    curl

# Create Oracle directory
RUN mkdir -p /opt/oracle

# Copy the manually downloaded Instant Client ZIP file
COPY ./backend/oracle_client/instantclient_23_7 /opt/oracle/

# Ensure the Oracle Client is properly linked
RUN ln -s /opt/oracle/instantclient_23_7/libclntsh.so /usr/lib/ && \
    ln -s /opt/oracle/instantclient_23_7/libclntsh.so.23.7 /usr/lib/

# Set environment variables for Oracle Instant Client
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_23_7:$LD_LIBRARY_PATH
ENV ORACLE_HOME=/opt/oracle/instantclient_23_7
ENV TNS_ADMIN=/opt/oracle/Wallet_ctschedulingeast

# Create a virtual environment in a standard location
RUN python -m venv /opt/venv

# Ensure the virtual environment's bin directory is in the PATH
ENV PATH="/opt/venv/bin:$PATH"

# Copy the requirements file to the container
COPY ./backend/requirements.txt .

RUN pip install --upgrade pip

# Install Python dependencies into the virtual environment
RUN pip install --no-cache-dir -r requirements.txt

# ENV TNS_ADMIN="/opt/oracle/Wallet_ctschedulingeast"

# Copy the rest of the application code to the container
COPY ./backend .

# Collect static files (for Django projects)
RUN python manage.py collectstatic --noinput

# Expose the application port
EXPOSE 8080

# Use Gunicorn with Uvicorn workers to serve the application
CMD ["python", "-m", "gunicorn", "server.wsgi:application", "--bind", "0.0.0.0:8000"]