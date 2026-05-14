git clone https://github.com/JC0510004/FREE_Ricky.git

cd FREE_RICKY

code .

docker-compose up --build

docker exec -it free_ricky_backend python manage.py migrate

http://localhost:5173