# Converter

Converter is used to take an RTMP source and convert it to an mpegts stream that is then published to a UDP source

ffmpeg in App Engine Flexible triggered by onPublish event in `incoming` microservice - publish to event queue subscribed by worker
concept here: https://medium.com/google-cloud/scalable-video-transcoding-with-app-engine-flexible-621f6e7fdf56

To run locally: `docker run -v ${PWD}:/opt/encoder -it extreamapp/extreamer-encoder:v0.1.3 npm run dev` this uses the latest docker image and the local files

To deploy to gcloud: `gcloud app deploy`
