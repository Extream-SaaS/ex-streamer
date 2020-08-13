```bash
ffmpeg -re \
-i rtmp://localhost/live/input_stream \
-acodec libfaac -ab 128k -vcodec libx264 -s 640x360 -b:v 500k -preset medium -vprofile baseline -r 25 \
-f flv rtmp://localhost/live/medium_500k \
-acodec libfaac -ab 128k -vcodec libx264 -s 480x272 -b:v 300k -preset medium -vprofile baseline -r 25 \
-f flv rtmp://localhost/live/medium_300k \
-acodec libfaac -ab 128k  -c:v libx264 -s 320x200 -b:v 150k -preset:v fast -profile:v baseline -level 1.2 -r 25 \
-f flv rtmp://localhost/live/medium_150k -acodec libfaac -vn -ab 48k \
-f flv rtmp://localhost/live/audio_only
```

```bash
'in=udp://127.0.0.1:40000,stream=video,init_segment=h264_360p_init.mp4,segment_template=h264_360p_$Number$.m4s' \
  'in=udp://127.0.0.1:40000,stream=video,init_segment=h264_480p_init.mp4,segment_template=h264_480p_$Number$.m4s' \
  'in=udp://127.0.0.1:40000,stream=video,init_segment=h264_720p_init.mp4,segment_template=h264_720p_$Number$.m4s' \
```
```bash
packager \
  'in=udp://127.0.0.1:40000,stream=audio,init_segment=audio_init.mp4,segment_template=audio_$Number$.m4s' \
  'in=udp://127.0.0.1:40000,stream=video,init_segment=h264_1080p_init.mp4,segment_template=h264_1080p_$Number$.m4s' \
  --mpd_output h264.mpd
  ```


  Shaka Packager in kubernetes cluster with auto scaling (node.js api internally on the docker container)