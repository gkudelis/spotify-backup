FROM python:3.7-stretch

COPY . .

CMD [ "python", "-m", "http.server" ]
