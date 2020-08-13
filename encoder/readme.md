# Converter

Converter is used to take an RTMP source and convert it to an mpegts stream that is then published to a UDP source

ffmpeg in App Engine Flexible triggered by onPublish event in `incoming` microservice - publish to event queue subscribed by worker
concept here: https://medium.com/google-cloud/scalable-video-transcoding-with-app-engine-flexible-621f6e7fdf56

## Commands

### start

message: `start`

data:
```JSON
{
  "input": "rtmp://",
  "video": {
    "codec": "libx264"
  },
  "audio": {
    "codec": "copy",
    "bitrate": "128k"
  },
  "output": "udp://"
}
```

returned message:
```JSON
{
  "id": "uuid",
  "status": "started | failed"
}
```


### status

message: `status`

data:
```JSON
{
  "id": "uuid"
}

returned message:

```JSON
{
  "frame": 0,
  "fps": 0,
  "speed": "1x",
  "time": "00:01:21",
  "size": {
    "video": "20301kb",
    "audio": "1599kb"
  }
}
```

### stop

message `stop`

data:
```JSON
{
  "id": "uuid",
  "when": "now | time in seconds"
}
```

returned message:
```JSON
{
  "status": "stopped | stopping | error"
}
```