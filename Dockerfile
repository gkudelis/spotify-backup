FROM python:3.7-stretch
WORKDIR /app
COPY . .
CMD [ "python", "-u", "-m", "http.server" ]
