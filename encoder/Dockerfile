FROM gcr.io/google_appengine/python

ARG packager_version=v2.4.3
ARG google_project_id=stoked-reality-284921
ARG google_service_account=stoked-reality.json
ENV LD_LIBRARY_PATH=/usr/local/lib:/usr/local/lib64


RUN apt-get -y update && apt-get -y install curl apt-transport-https gnupg ca-certificates
RUN echo "deb https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash
RUN curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
RUN apt-get update -qq && apt-get -y install python3-yaml nodejs expat libgomp1 google-cloud-sdk && apt-get autoremove -y && apt-get clean -y


RUN wget https://github.com/google/shaka-packager/releases/download/${packager_version}/packager-linux
RUN install -m 755 packager-linux /usr/bin/packager
RUN mkdir /opt/encoder
WORKDIR /opt/encoder
COPY --from=jrottenberg/ffmpeg:4.3.1-ubuntu1604 /usr/local/ /usr/local/
COPY . .
RUN npm install pm2 -g
RUN npm ci
RUN pip3 install --upgrade shaka-streamer
RUN gcloud auth activate-service-account --key-file=service-accounts/${google_service_account} --project=${google_project_id}

EXPOSE 8888
CMD ["npm", "start"]