# Use the official Python image as the base image
FROM python:alpine

# Environment variables to optimize Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONBUFFERED=1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
# Uncomment the following block if needed for your application:
# RUN apk add --no-cache \
#     build-base \
#     libpq-dev \
#     gcc \
#     musl-dev \
#     postgresql-dev

# Create a virtual environment in a standard location
RUN python -m venv /opt/venv

# Ensure the virtual environment's bin directory is in the PATH
ENV PATH="/opt/venv/bin:$PATH"

# Copy the requirements file to the container
COPY ./backend/requirements.txt .

# Install Python dependencies into the virtual environment
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code to the container
COPY ./backend .

# Collect static files (for Django projects)
RUN python manage.py collectstatic --noinput

# Expose the application port
EXPOSE 8000

# Use Gunicorn with Uvicorn workers to serve the application
CMD ["python", "-m", "gunicorn", "server.wsgi:application", "--bind", "0.0.0.0:8000", "-k", "uvicorn.workers.UvicornWorker"]