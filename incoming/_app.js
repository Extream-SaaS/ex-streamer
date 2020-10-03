// listens to incoming rtmp streams. verifies the user against ex-auth using axios
// sends to the ex-streamer an 'activation' action
// listens to the ex-streamer-incoming queue for activation responses
const {PubSub} = require('@google-cloud/pubsub');
const grpc = require('grpc');
const projectId = 'stoked-reality-284921';
const axios = require('axios');
const exauthURL = process.env.EXAUTH;
const exstreamerURL = process.env.EXSTREAMER;

// TODO: send the pod IP address or other identifier so that when receiving requests, check the identifier to ensure this pod is the right one for that made the request.

// Instantiates a client
const pubsub = new PubSub({grpc, projectId});

const NodeMediaServer = require('./');

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    mediaroot: './media',
    webroot: './www',
    allow_origin: '*',
    api: true
  },
  auth: {
    api: true,
    api_user: 'admin',
    api_pass: 'DNdHipVUM4'
  },
  trans: {
    ffmpeg: '/usr/local/bin/ffmpeg',
    tasks: [
      {
        app: 'rehearsal',
        vc: "copy",
        vcParam: [],
        ac: "aac",
        acParam: ['-ab', '64k', '-ac', '1', '-ar', '44100'],
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        dash: true,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
      },
      {
        app: 'recorder',
        mp4: true,
        mp4Flags: '[movflags=frag_keyframe+empty_moov]',
      }
    ]
  }
};

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

pull();

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

let nms = new NodeMediaServer(config);
nms.run();

nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('prePublish', async (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  try {
    const StreamObj = StreamPath.split('/');
    const userId = StreamObj[StreamObj.length - 1];
    const token = userId.split('-')[1];
    const user = await verifyUser(token);
    push('ex-streamer', {
      domain: 'client',
      action: 'rtmp',
      command: 'activate',
      payload: {
        id: userId.split('-')[0],
        sessionId: id,
        streamUrl: `${exstreamerURL}${StreamPath}`
      },
      user
    });
  } catch (error) {
    console.log('error', error);
    const session = nms.getSession(id);
    session.reject();
  }
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // user has begin publishing. Lets invoke packager and ffmpeg
  
});

nms.on('donePublish', async (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  try {
    const StreamObj = StreamPath.split('/');
    const userId = StreamObj[StreamObj.length - 1];
    const token = userId.split('-')[1];
    const user = await verifyUser(token);
    push('ex-streamer', {
      domain: 'client',
      action: 'rtmp',
      command: 'complete',
      payload: {
        id: userId.split('-')[0],
        sessionId: id,
        streamUrl: [exstreamerURL, StreamPath]
      },
      user
    });
  } catch (error) {
    console.log('error', error);
    const session = nms.getSession(id);
    session.reject();
  }
});

nms.on('prePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postPlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

