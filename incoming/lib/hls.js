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
      destination: `media${path}`,
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
    const vodFilename = 'vod.m3u8';
    const liveFilename = path.split('\\').pop().split('/').pop();
    const vodPath = path.replace(liveFilename, vodFilename);
    if (vodFilename) {
      if (await fs.exists(vodPath)) {
        // Read existing vod playlist.
        vodM3u8 = await fs.readFile(vodPath);
      } else {
        await fs.copyFile(path, vodPath);
      }
      vodM3u8 = m3u8.sync_m3u8(liveM3u8, vodM3u8, appName);
      const uploadBucket = storage.bucket(process.env.ASSETS_BUCKET);
      try {
        await fs.writeFile(vodPath, vodM3u8);
        await uploadBucket.upload(vodPath, {
          destination: `media${vodPath}`,
          contentType: 'application/x-mpegURL',
          validation: 'crc32c',
        });
      } catch(err) {
        console.log('======= ERROR UPLOADING FILE ========', err);
      }
    }
  }
};

// TS  - media/test4/720p/20200504-1588591755.ts
const handleSegment = async (path) => {
  const uploadBucket = storage.bucket(process.env.ASSETS_BUCKET);
  try {
    await uploadBucket.upload(path, {
      destination: `media${path}`,
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
      destination: `media${path}`,
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
    const streamName = _.nth(paths, 0);
    const appName = _.nth(paths, 1);
    console.log(type, path);
    // only send adds for video
    if (_.endsWith(path, '.ts') && type === 'add') {
      const stream = streams.get(streamName);
      const record = stream.record;
      // TODO: Handle recording on demand
      await handleSegment(absolutePath);

      if (_.isEqual(appName, VOD_APP_NAME) && record) {
        await handlePlaylistCopy(
          _.join(_.union(_.initial(_.split(absolutePath, '/')), ['index.m3u8']), '/'),
          mediaRoot,
          streams,
          streamName,
          appName);
  
      }
    } else if (_.endsWith(path, 'live.m3u8') && type === 'add') {
      // get this file copied over as its our initial adaptive stream
      await handleABR(absolutePath);
    } else if (_.endsWith(path, 'index.m3u8')) {
      await handlePlaylist(
        type,
        _.join(_.union(_.initial(_.split(absolutePath, '/')), ['index.m3u8']), '/'),
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
  console.log('chokidar instance', chokidar);
};

module.exports = {
  streamHls,
  on
};