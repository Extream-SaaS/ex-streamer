ARG GCLOUD_AUTH="/usr/src/app/service-accounts/stoked-reality.json"

FROM node:lts-alpine

RUN apk add --no-cache --update libcrypto1.1 libssl1.1 libgomp expat git python3

ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/local/lib64:/usr/lib:/usr/lib64:/lib:/lib64

WORKDIR /usr/src/app

COPY package*.json ./

COPY . .

COPY --from=jrottenberg/ffmpeg:4.3.1-alpine311 /usr/local/ /usr/local/

EXPOSE 1935 8000

ENV GOOGLE_APPLICATION_CREDENTIALS=$GCLOUD_AUTH

CMD ["npm","start"]
