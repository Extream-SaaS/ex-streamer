const _ = require('lodash');
const chokidar = require('chokidar');
const stream = require('stream');
const { join } = require('path');
const EventEmitter = require('events');
const fs = require('./fs');
const {Storage} = require('@google-cloud/storage');
const m3u8 = require('./m3u8');

const nodeEvent = new EventEmitter();

// Creates a client
const storage = new Storage();

const on = (eventName, listener) => {
  nodeEvent.on(eventName, listener);
};

const VOD_APP_NAME = '720p';

// Function to create a unique VOD filename for each stream
const getVodName = (streams, streamName) => {
  if (!streams.has(streamName)) return false;
  return `vod-${streams.get(streamName)}.m3u8`;
};

// HLS - test4/720p/index.m3u8
const handlePlaylist = async (path, mediaRoot, streams, streamName, appName) => {
  console.log('handlePlaylist', path);
  if (await fs.exists(join(mediaRoot, path))) {
    // Read 720p playlist
    const liveM3u8 = await fs.readFile(join(mediaRoot, path));

    // Put /vod.m3u8 with all segments and end tag.
    let vodM3u8;
    const vodFilename = getVodName(streams, streamName);
    if (vodFilename) {
      const vodPath = join(mediaRoot, streamName, vodFilename);
      if (await fs.exists(vodPath)) {
        // Read existing vod playlist.
        vodM3u8 = await fs.readFile(vodPath);
      } else {
        // New HLS Stream.
        console.log('emit newHlsStream event');
        nodeEvent.emit("newHlsStream", streamName);
      }
      vodM3u8 = m3u8.sync_m3u8(liveM3u8, vodM3u8, appName);
      const uploadBucket = storage.bucket(process.env.ASSETS_BUCKET);

      const file = uploadBucket.file(`${streamName}/${vodFilename}`);
      await fs.writeFile(vodPath, vodM3u8);
      fs.createReadStream(vodPath)
        .pipe(file.createWriteStream({ 
          gzip: true,
          contentType: 'application/x-mpegURL',
        }))
        .on('error', function(err) {})
        .on('finish', function() {
          // The file upload is complete.
      });
    }
  }
};

// TS  - media/test4/720p/20200504-1588591755.ts
const handleSegment = async (path, mediaRoot) => {
  const uploadBucket = storage.bucket(process.env.ASSETS_BUCKET);

      const file = uploadBucket.file(`${streamName}/${vodFilename}`);
      await fs.writeFile(vodPath, vodM3u8);
      fs.createReadStream(join(mediaRoot, path))
        .pipe(file.createWriteStream({ 
          gzip: true,
          contentType: 'application/x-mpegURL',
        }))
        .on('error', function(err) {})
        .on('finish', function() {
          // The file upload is complete.
      });
};

// ABR - media/test4/live.m3u8
// HLS - media/test4/720p/index.m3u8
// TS  - media/test4/720p/20200504-1588591755.ts
// [360p, 480p, 720p]

const onFile = async (absolutePath, type, mediaRoot, streams) => {
  try {
    const path = _.trim(_.replace(absolutePath, mediaRoot, ''), '/');
    if (_.endsWith(path, '.ts')) {
      const paths = _.split(path, '/');
      const streamName = _.nth(paths, 0);
      const appName = _.nth(paths, 1);
      if (_.isEqual(appName, VOD_APP_NAME)) {
        console.log(`File ${path} has been ${type}`);
        // Only upload 720p
        await handleSegment(path, mediaRoot);
        await handlePlaylist(
          _.join(_.union(_.initial(_.split(path, '/')), ['index.m3u8']), '/'),
          mediaRoot,
          streams,
          streamName,
          appName);
      }
    }
  } catch (err) {
    console.log(err);
  }
};

const recordHls = (config, streams) => {
  const mediaRoot = config.http.mediaroot;
  console.log(`Start watcher - ${process.env.NODE_ENV}, ${mediaRoot}`);
  chokidar.watch(mediaRoot, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 6000,
      pollInterval: 100
    }
  }).on('add', (path) => onFile(path, 'add', mediaRoot, streams))
    .on('change', (path) => onFile(path, 'change', mediaRoot, streams));
};

module.exports = {
  recordHls,
  on
};