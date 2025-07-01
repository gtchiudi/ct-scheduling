FROM node:22-alpine AS dev
WORKDIR /ct-scheduling/frontend
COPY frontend/package*.json .
RUN npm install
COPY frontend/ .
RUN npm run build

# Use the official Python image as the base image
FROM python:3.11-alpine

# Environment variables to optimize Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONBUFFERED=1

# Set the working directory in the container
WORKDIR /ct-scheduling/backend
RUN apk add --no-cache gcc musl-dev libffi-dev postgresql-dev

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=dev /ct-scheduling/frontend/build ./static

COPY ./backend .

RUN cp ./static/index.html ./templates/

# Collect static files (for Django projects)
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Use Gunicorn with Uvicorn workers to serve the application
CMD ["gunicorn", "server.wsgi:application", "--bind", "0.0.0.0:8000", "--workers=4"]