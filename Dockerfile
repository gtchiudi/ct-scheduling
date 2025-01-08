# Use the official Python image as the base image
FROM python:alpine

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
# RUN apt-get update \
#     && apt-get install -y --no-install-recommends \
#     build-essential \
#     libpq-dev \
#     && rm -rf /var/lib/apt/lists/*

# Copy the requirements file to the container
COPY ./backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt
COPY ./backend .

RUN python manage.py collectstatic --noinput
# Copy the rest of the application code to the container

EXPOSE 8000

CMD ["python", "-m", "gunicorn", "server.wsgi:application", "--bind", "0.0.0.0:8000", "-k", "uvicorn.workers.UvicornWorker"]
