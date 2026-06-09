FROM python:3.12

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["gunicorn", "-w", "4", "--threads", "2", "-b", "0.0.0.0:8000", "config.wsgi:application"]