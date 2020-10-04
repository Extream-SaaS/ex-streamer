ARG GCLOUD_AUTH="/app/service-accounts/stoked-reality.json"

FROM node:lts-alpine

# RUN apk add --no-cache --update --virtual build-deps git python3 alpine-sdk build-base gcc && \
RUN apk add --no-cache --update --virtual build-deps git && \
    apk add --no-cache --upgrade libcrypto1.1 libssl1.1 libgomp expat && \
    mkdir /app && mkdir /files

ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/local/lib64:/usr/lib:/usr/lib64:/lib:/lib64

WORKDIR /app

COPY package.json ./

RUN npm i

COPY . .

COPY --from=jrottenberg/ffmpeg:4.3.1-alpine311 /usr/local/ /usr/local/

ENV NODE_ENV=production

RUN apk del build-deps

EXPOSE 1935 8000

ENV GOOGLE_APPLICATION_CREDENTIALS=$GCLOUD_AUTH

CMD ["npm","start"]
