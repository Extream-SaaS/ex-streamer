# Extreamer

## Manager API
* RESTful API for managing streams and their consumers
* App Engine serverless functions
* Data stored in Firestore

### Commands
* Create RTMP stream
* * Payload
    ```json
    {
      "activation": "datetime",
      "duration": "number of days",
      "max_bitrate": "integer",
      "name": "string",
      "dedicated": true
    }
    ```
    If `dedicated` is set to `true` then we create a dedicated node in the cluster. Otherwise, we will use a shared node.
* * Returns:
    ```json
    {
      "id": "uuid",
      "inbound_url": "an RTMP URL",
      "outbound_url": "a DASH manifest URL",
      "expiration": "datetime",
      "options": {
        ...
      }
    }
    ```
* Update RTMP stream
* * Payload
    ```json
    {
      "activation": "datetime",
      "duration": "number of days",
      "max_bitrate": "integer",
      "name": "string",
      "dedicated": true
    }
    ```
    If `dedicated` is set to `true` then we create a dedicated node in the cluster. Otherwise, we will use a shared node.
* * Returns:
    ```json
    {
      "id": "uuid",
      "inbound_url": "an RTMP URL",
      "outbound_url": "a DASH manifest URL",
      "expiration": "datetime",
      "options": {
        ...
      }
    }
    ```
* Upload VOD file
* * Payload (multipart/form-data)
    ```form-data
    file=BINARY_CONTENT
    name=string
    activation=datetime
    duration=integer
    breakpoints[]=array of bitrate versions
    ```
* * Returns:
    ```json
    {
      "id": "uuid",
      "outbound_url": "a DASH manifest URL",
      "expiration": "datetime"
    }
## Inbound Content
* A node.js docker container with node-media-server
* * Single-tenant - docker container created for each RTMP creation

## Outbound Content
* On demand docker container with shaka packager installed to convert a UDP stream or video file to a DASH manifest and media segments
* Media segments and DASH manifest uploaded to cloud storage
* https://google.github.io/shaka-packager/html/tutorials/live.html#examples
* Front-end library to use Shaka Player to consume DASH manifest