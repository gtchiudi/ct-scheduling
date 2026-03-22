#!/bin/sh
set -e

echo "Running Django migrations..."
python manage.py migrate --noinput

echo "Starting Gunicorn..."
exec gunicorn server.wsgi:application --bind 0.0.0.0:8000 --workers=4
