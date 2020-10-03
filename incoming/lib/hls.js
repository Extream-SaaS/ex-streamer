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
  console.log('get vod target', streamName, streams);
  if (!streams.has(streamName)) return false;
  return `vod-${streams.get(streamName).id}.m3u8`;
};

// HLS - test4/720p/index.m3u8
const handlePlaylist = async (type, path, mediaRoot, streams, streamName, appName) => {
  console.log('handlePlaylist', path);
  const uploadBucket = storage.bucket(process.env.ASSETS_BUCKET);
  if (type === 'add' && !streams.get(streamName).abr) {
    // create the ABR file
    nodeEvent.emit("newHlsStream", streamName);
  }
  try {
    await uploadBucket.upload(path, {
      destination: path,
      contentType: 'application/x-mpegURL',
      validation: 'crc32c',
      metadata: {
        cacheControl: 'public, max-age=10',
      },
    });
  } catch(err) {
    console.log('======= ERROR UPLOADING FILE ========', err);
  }
};

// HLS - test4/720p/index.m3u8
const handlePlaylistCopy = async (path, mediaRoot, streams, streamName, appName) => {
  console.log('handlePlaylist copy', path);
  if (await fs.exists(path)) {
    console.log('====== path ======', path);
    const liveM3u8 = await fs.readFile(path);

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
      try {
        await fs.writeFile(vodPath, vodM3u8);
        await uploadBucket.upload(path, {
          destination: `recording/${streamName}/${appName}/${vodFilename}`,
          contentType: 'application/x-mpegURL',
          validation: 'crc32c',
        });
      } catch(err) {
        console.log('======= ERROR UPLOADING FILE ========', err);
      }
    }
  }
};

const handleSegmentCopy = async (path) => {

};

// TS  - media/test4/720p/20200504-1588591755.ts
const handleSegment = async (path) => {
  const uploadBucket = storage.bucket(process.env.ASSETS_BUCKET);
  try {
    await uploadBucket.upload(path, {
      destination: path,
      validation: 'crc32c',
    });
  } catch(err) {
    console.log('======= ERROR UPLOADING FILE ========', err);
  }
};

const handleABR = async (path) => {
  console.log('====== HANDLE LIVE.m3u8 ======', path);
  const uploadBucket = storage.bucket(process.env.ASSETS_BUCKET);
  try {
    await uploadBucket.upload(path, {
      destination: path,
      contentType: 'application/x-mpegURL',
      validation: 'crc32c',
    });
  } catch(err) {
    console.log('======= ERROR UPLOADING FILE ========', err);
  }
};

// ABR - media/test4/live.m3u8
// HLS - media/test4/720p/index.m3u8
// TS  - media/test4/720p/20200504-1588591755.ts
// [360p, 480p, 720p]

const onFile = async (absolutePath, type, mediaRoot, streams) => {
  try {
    const path = _.trim(_.replace(absolutePath, mediaRoot, ''), '/');
    const paths = _.split(path, '/');
    const streamName = _.nth(paths, 1);
    const appName = _.nth(paths, 2);
    console.log(type, path);
    // only send adds for video
    if (_.endsWith(path, '.ts') && type === 'add') {
      const stream = streams.get(streamName);
      const record = stream.record;
      // TODO: Handle recording on demand
      await handleSegment(path);

      if (_.isEqual(appName, VOD_APP_NAME) && record) {
        // TODO: Copy target VOD rate to the new directory on gcloud
        await handleSegmentCopy(path);
        await handlePlaylistCopy(
          _.join(_.union(_.initial(_.split(path, '/')), ['index.m3u8']), '/'),
          mediaRoot,
          streams,
          streamName,
          appName);
  
      }
    } else if (_.endsWith(path, 'live.m3u8') && type === 'add') {
      // get this file copied over as its our initial adaptive stream
      await handleABR(path);
    } else if (_.endsWith(path, 'index.m3u8')) {
      await handlePlaylist(
        type,
        _.join(_.union(_.initial(_.split(path, '/')), ['index.m3u8']), '/'),
        mediaRoot,
        streams,
        streamName,
        appName);
    }
  } catch (err) {
    console.log(err);
  }
};

const streamHls = (config, streams) => {
  const mediaRoot = config.http.mediaroot;
  console.log(`Start watcher - ${process.env.NODE_ENV}, ${mediaRoot}`);
  chokidar.watch(mediaRoot, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 5000,
      pollInterval: 100
    }
  }).on('add', (path) => onFile(path, 'add', mediaRoot, streams))
    .on('change', (path) => onFile(path, 'change', mediaRoot, streams));
};

module.exports = {
  streamHls,
  on
};