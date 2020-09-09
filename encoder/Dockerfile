FROM gcr.io/google_appengine/python

ARG packager_version=v2.4.3
ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/local/lib64


RUN apt-get -y update && apt-get -y install curl
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash

RUN apt-get update -qq && apt-get -y install nodejs && apt-get autoremove -y && apt-get clean -y
RUN mkdir /opt/encoder
WORKDIR /opt/encoder
COPY --from=jrottenberg/ffmpeg:4.3.1-ubuntu1604 /usr/local/ /usr/local/
COPY . .
RUN npm install pm2 -g
RUN npm ci

EXPOSE 8888
CMD ["npm", "start"]