ARG GCLOUD_AUTH="/usr/src/app/service-accounts/stoked-reality.json"

FROM ubuntu:18.04

RUN apt-get update &&\
    apt-get -y install libssl1.1 expat curl git python3 build-essential &&\
    curl -sL https://deb.nodesource.com/setup_14.x | bash - &&\
    apt-get -y install nodejs &&\
    ln -s /usr/bin/nodejs /usr/local/bin/node

ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/local/lib64:/usr/lib:/usr/lib64:/lib:/lib64

WORKDIR /usr/src/app

COPY . .

COPY --from=jrottenberg/ffmpeg:4.3.1-ubuntu1804 /usr/local/ /usr/local/

RUN npm ci

EXPOSE 1935 8000

ENV GOOGLE_APPLICATION_CREDENTIALS=$GCLOUD_AUTH

ENV NODE_ENV=production

CMD ["npm","start"]
