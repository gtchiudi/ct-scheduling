# Use the official Python image as the base image
FROM python:3.11.9-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONBUFFERED 1

# Set the working directory in the container
WORKDIR /server


# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file to the container
COPY requirements.txt .

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code to the container
COPY server server

RUN python server/manage.py migrate
RUN python server/manage.py collectstatic --noinput

# replace this with the production command
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]