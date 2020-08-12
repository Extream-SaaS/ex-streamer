# Converter

Converter is used to take an RTMP source and convert it to an mpegts stream that is then published to a UDP source

ffmpeg in App Engine Flexible triggered by onPublish event in `incoming` microservice

## Commands

### start

POST `/start`

Request Payload:
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

Response Payload:
```JSON
{
  "id": "uuid",
  "status": "started | failed"
}
```

### status

GET `/status/{id}`

Response Payload:

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

PATCH `/stop/{id}`

Request Payload:
```JSON
{
  "when": "now | time in seconds"
}
```

Response Payload:
```JSON
{
  "status": "stopped | stopping | error"
}
```