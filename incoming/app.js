if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
// listens to incoming rtmp streams. verifies the user against ex-auth using axios
// sends to the ex-streamer an 'activation' action
// listens to the ex-streamer-incoming queue for activation responses

const {PubSub} = require('@google-cloud/pubsub');
const grpc = require('grpc');
const projectId = 'stoked-reality-284921';
const axios = require('axios');
const exauthURL = process.env.EXAUTH;
const exstreamerURL = process.env.EXSTREAMER;
const NodeMediaServer = require('node-media-server');
const _ = require('lodash');
const { join } = require('path');
const querystring = require('querystring');
const fs = require('./lib/fs');
const hls = require('./lib/hls');
const abr = require('./lib/abr');
const logger = require('./lib/logger');
const utils = require('./lib/utils');


const pubsub = new PubSub({grpc, projectId});
const LOG_TYPE = 3;
logger.setLogType(LOG_TYPE);

function push(
  topicName = 'ex-streamer',
  data = {}
) {

  async function publishMessage() {
    const dataBuffer = Buffer.from(JSON.stringify(data));

    const messageId = await pubsub.topic(topicName).publish(dataBuffer);
    return messageId;
  }

  return publishMessage();
}
function pull(
  nms,
  subscriptionName = 'ex-streamer-incoming',
  timeout = 60
) {
  const subscription = pubsub.subscription(subscriptionName);
  let messageCount = 0;
  const messageHandler = message => {
    console.log(`Received message ${message.id}:`);
    messageCount += 1;
    const body = message.data ? JSON.parse(Buffer.from(message.data, 'base64').toString()) : null;
    console.log(body);
    if (body.error || body.status === 'expired') {
      const session = nms.getSession(`${body.payload.sessionId}`);
      if (session) {
        session.reject();
      }
      console.log('rejecting session');
    }
    // "Ack" (acknowledge receipt of) the message
    message.ack();
  };
  subscription.on('message', messageHandler);
  // regurgitate the handler occasionally \\
  setTimeout(() => {
    subscription.removeListener('message', messageHandler);
    console.log(`${messageCount} message(s) received. Refreshing.`);
    pull(subscriptionName, timeout);
  }, timeout * 1000);
}

const verifyUser = async (token) => {
  const config = {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };
  const resp = await axios.get(`${exauthURL}/auth/user`, config);
  if (resp.status !== 200) {
    throw new Error('not logged in');
  }
  const exauthUser = resp.data;
  console.log('verify url', `${exauthURL}/auth/user`);
  return exauthUser;
};

// init RTMP server
const init = async () => {
  try {
    // Set the Node-Media-Server config.
    const config = {
      logType: LOG_TYPE,
      rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
      },
      http: {
        port: 8000,
        mediaroot: process.env.MEDIA_ROOT || './media',
        allow_origin: '*',
        api: true
      },
      auth: {
        api: true,
        api_user: 'admin',
        api_pass: 'DNdHipVUM4'
      },
      relay: {
        ffmpeg: process.env.FFMPEG_PATH || '/usr/local/bin/ffmpeg',
        tasks: [
          {
            app: 'live',
            mode: 'push',
            edge: `rtmp://127.0.0.1/hls`,
          },
          {
            app: 'recorder',
            mode: 'push',
            edge: `rtmp://127.0.0.1/hls?record=true`,
          },
        ],
      },
      trans: {
        ffmpeg: process.env.FFMPEG_PATH || '/usr/local/bin/ffmpeg',
        tasks: [
          {
            app: 'hls',
            hls: true,
            raw: [
              '-vf',
              'scale=w=640:h=360:force_original_aspect_ratio=decrease',
              '-c:a',
              'aac',
              '-ar',
              '48000',
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-profile:v',
              'main',
              '-crf',
              '20',
              '-sc_threshold',
              '0',
              '-g',
              '48',
              '-keyint_min',
              '48',
              '-hls_time',
              '10',
              '-hls_list_size',
              '30',
              '-hls_playlist_type',
              'event',
              '-hls_flags',
              'delete_segments',
              '-max_muxing_queue_size',
              '1024',
              '-start_number',
              '${timeInMilliseconds}',
              '-b:v',
              '800k',
              '-maxrate',
              '856k',
              '-bufsize',
              '1200k',
              '-b:a',
              '96k',
              '-hls_segment_filename',
              '${mediaroot}/${streamName}/360p/%03d.ts',
              '${mediaroot}/${streamName}/360p/index.m3u8',
              '-vf',
              'scale=w=842:h=480:force_original_aspect_ratio=decrease',
              '-c:a',
              'aac',
              '-ar',
              '48000',
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-profile:v',
              'main',
              '-crf',
              '20',
              '-sc_threshold',
              '0',
              '-g',
              '48',
              '-keyint_min',
              '48',
              '-hls_time',
              '10',
              '-hls_list_size',
              '30',
              '-hls_playlist_type',
              'event',
              '-hls_flags',
              'delete_segments',
              '-max_muxing_queue_size',
              '1024',
              '-start_number',
              '${timeInMilliseconds}',
              '-b:v',
              '1400k',
              '-maxrate',
              '1498k',
              '-bufsize',
              '2100k',
              '-b:a',
              '128k',
              '-hls_segment_filename',
              '${mediaroot}/${streamName}/480p/%03d.ts',
              '${mediaroot}/${streamName}/480p/index.m3u8',
              '-vf',
              'scale=w=1280:h=720:force_original_aspect_ratio=decrease',
              '-c:a',
              'aac',
              '-ar',
              '48000',
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-profile:v',
              'main',
              '-crf',
              '20',
              '-sc_threshold',
              '0',
              '-g',
              '48',
              '-keyint_min',
              '48',
              '-hls_time',
              '10',
              '-hls_list_size',
              '30',
              '-hls_playlist_type',
              'event',
              '-hls_flags',
              'delete_segments',
              '-max_muxing_queue_size',
              '1024',
              '-start_number',
              '${timeInMilliseconds}',
              '-b:v',
              '2800k',
              '-maxrate',
              '2996k',
              '-bufsize',
              '4200k',
              '-b:a',
              '128k',
              '-hls_segment_filename',
              '${mediaroot}/${streamName}/720p/%03d.ts',
              '${mediaroot}/${streamName}/720p/index.m3u8'
            ],
            ouPaths: [
              '${mediaroot}/${streamName}/360p',
              '${mediaroot}/${streamName}/480p',
              '${mediaroot}/${streamName}/720p'
            ],
            hlsFlags: '',
            cleanup: false,
          },
        ]
      },
    };

    // Construct the NodeMediaServer
    const nms = new NodeMediaServer(config);

    pull(nms);

    // Create the maps we'll need to track the current streams.
    this.dynamicSessions = new Map();
    this.streams = new Map();

    // Start the file watcher and sync.
    hls.streamHls(config, this.streams);

    //
    // HLS callbacks
    //
    hls.on('newHlsStream', async (name) => {
      // Create the ABR HLS playlist file.
      console.log('======== new hls stream ========');
      const stream = this.streams.get(name);
      stream.abr = true;
      this.streams.set(name, stream);
      await abr.createPlaylist(config.http.mediaroot, name);
    });

    //
    // RTMP callbacks
    //
    nms.on('preConnect', (id, args) => {
      logger.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
      // Pre connect authorization
      // let session = nms.getSession(id);
      // session.reject();
    });
    
    nms.on('postConnect', (id, args) => {
      logger.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
    });
    
    nms.on('doneConnect', (id, args) => {
      logger.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
    });
    
    nms.on('prePublish', async (id, StreamPath, args) => {
      logger.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
      try {
        if (StreamPath.indexOf('/recorder/') !== -1 || StreamPath.indexOf('/live/') !== -1) {
          const StreamObj = StreamPath.split('/');
          const streamKey = StreamObj[StreamObj.length - 1];
          const streamId = streamKey.split('-')[0];
          const token = streamKey.split('-')[1];
          const user = await verifyUser(token);
          push('ex-streamer', {
            domain: 'client',
            action: 'rtmp',
            command: 'activate',
            payload: {
              id: streamId,
              sessionId: id,
              streamUrl: `${exstreamerURL}${StreamPath}`
            },
            user
          });
        }
      } catch (error) {
        console.log('error', error);
        const session = nms.getSession(id);
        session.reject();
      }
    });
    
    nms.on('postPublish', async (id, StreamPath, args) => {
      logger.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
      if (StreamPath.indexOf('/hls/') !== -1) {
        const streamKey = StreamPath.split('/').pop();
        const name = streamKey.split('-')[0];
        this.streams.set(name, { id, record: (args.record && args.record === 'true'), abr: false });
      } else if (StreamPath.indexOf('/recorder/') !== -1 || StreamPath.indexOf('/live/') !== -1) {
        //
        // Start Relay to youtube, facebook, and/or twitch
        //
        if (args.youtube) {
          const params = utils.getParams(args, 'youtube_');
          const query = _.isEmpty(params) ? '' : `?${querystring.stringify(params)}`;
          const url = `rtmp://${process.env.YOUTUBE_URL}/${args.youtube}${query}`;
          const session = nms.nodeRelaySession({
            ffmpeg: config.relay.ffmpeg,
            inPath: `rtmp://127.0.0.1:${config.rtmp.port}${StreamPath}`,
            ouPath: url
          });
          session.id = `youtube-${id}`;
          session.on('end', (id) => {
            this.dynamicSessions.delete(id);
          });
          this.dynamicSessions.set(session.id, session);
          session.run();
        }
        if (args.facebook) {
          const params = utils.getParams(args, 'facebook_');
          const query = _.isEmpty(params) ? '' : `?${querystring.stringify(params)}`;
          const url = `rtmps://${process.env.FACEBOOK_URL}/${args.facebook}${query}`;
          session = nms.nodeRelaySession({
            ffmpeg: config.relay.ffmpeg,
            inPath: `rtmp://127.0.0.1:${config.rtmp.port}${StreamPath}`,
            ouPath: url
          });
          session.id = `facebook-${id}`;
          session.on('end', (id) => {
            this.dynamicSessions.delete(id);
          });
          this.dynamicSessions.set(session.id, session);
          session.run();
        }
        if (args.twitch) {
          const params = utils.getParams(args, 'twitch_');
          const query = _.isEmpty(params) ? '' : `?${querystring.stringify(params)}`;
          const url = `rtmp://${process.env.TWITCH_URL}/${args.twitch}${query}`;
          session = nms.nodeRelaySession({
            ffmpeg: config.relay.ffmpeg,
            inPath: `rtmp://127.0.0.1:${config.rtmp.port}${StreamPath}`,
            ouPath: url,
            raw: [
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-c:a',
              'copy',
              '-b:v',
              '3500k',
              '-maxrate',
              '3750k',
              '-bufsize',
              '4200k',
              '-s',
              '1280x720',
              '-r',
              '30',
              '-f',
              'flv',
              '-max_muxing_queue_size',
              '1024',
            ]
          });
          session.id = `twitch-${id}`;
          session.on('end', (id) => {
            this.dynamicSessions.delete(id);
          });
          this.dynamicSessions.set(session.id, session);
          session.run();
        }
      }
    });
    
    nms.on('donePublish', async (id, StreamPath, args) => {
      logger.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
      if (StreamPath.indexOf('/hls/') != -1) {
        const name = StreamPath.split('/').pop();
        // Wait a few minutes before deleting the HLS files on this Server
        // for this session
        const timeoutMs = _.isEqual(process.env.NODE_ENV, 'development') ?
          1000 : 
          2 * 60 * 1000;
        await utils.timeout(timeoutMs);
        // Only clean up if the stream isn't running.  
        // The user could have terminated then started again.
        try {
          // Cleanup directory
          logger.log('[Delete HLS Directory]', `dir=${join(config.http.mediaroot, name)}`);
          fs.rmdirSync(join(config.http.mediaroot, name));
        } catch (err) {
          logger.error(err);
        }
      } else if (StreamPath.indexOf('/recorder/') !== -1 || StreamPath.indexOf('/live/') !== -1) {
        //
        // Stop the Relay's
        //
        if (args.youtube) {
          let session = this.dynamicSessions.get(`youtube-${id}`);
          if (session) {
            session.end();
            this.dynamicSessions.delete(`youtube-${id}`);
          }
        }
        if (args.facebook) {
          let session = this.dynamicSessions.get(`facebook-${id}`);
          if (session) {
            session.end();
            this.dynamicSessions.delete(`facebook-${id}`);
          }
        }
        if (args.twitch) {
          let session = this.dynamicSessions.get(`twitch-${id}`);
          if (session) {
            session.end();
            this.dynamicSessions.delete(`twitch-${id}`);
          }
        }
      }
    });
    
    nms.on('prePlay', (id, StreamPath, args) => {
      logger.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
      // Pre play authorization
      // let session = nms.getSession(id);
      // session.reject();
    });
    
    nms.on('postPlay', (id, StreamPath, args) => {
      logger.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
    });
    
    nms.on('donePlay', (id, StreamPath, args) => {
      logger.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
    });

    // Run the NodeMediaServer
    nms.run();
  } catch (err) {
    logger.log('Can\'t start app', err);
    process.exit();
  }
};
init();