FROM python:3.12

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD sh -c "python manage.py makemigrations api --noinput && python manage.py migrate --noinput && gunicorn -w 1 --threads 2 -b 0.0.0.0:8000 config.wsgi:application"