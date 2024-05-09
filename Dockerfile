# Use the official Python image as the base image
FROM python:3.11.9-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONBUFFERED 1

# Set the working directory in the container
WORKDIR /app


# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file to the container
COPY ./backend/requirements.txt .

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code to the container
COPY ./backend .

RUN python manage.py migrate
RUN python manage.py collectstatic --noinput

# Expose the port that Django runs on
EXPOSE 8000

# Start the Django development server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]