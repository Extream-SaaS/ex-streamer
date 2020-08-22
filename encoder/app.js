const { spawn } = require("child_process");

// listens to ex-encoder queue for creating streams

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
// Imports the Google Cloud client library
const {PubSub} = require('@google-cloud/pubsub');
const grpc = require('grpc');
const projectId = 'stoked-reality-284921';

const pubsub = new PubSub({grpc, projectId});

function pull(
    subscriptionName = 'ex-gateway-subscription',
    timeout = 60
) {
const subscription = pubsub.subscription(subscriptionName);
    let messageCount = 0;
    const messageHandler = message => {
        console.log(`Received message ${message.id}:`);
        messageCount += 1;
        const body = message.data ? JSON.parse(Buffer.from(message.data, 'base64').toString()) : null;
        if (rooms[body.user.token]) {
        console.log('pushing to socket', body.socketId, Object.keys(rooms));
        const socket = rooms[body.user.token].socket;
        socket.emit(`${body.domain}_${body.action}_${body.command}`, body);
        } else {
        // socket not found
        console.log('socket not found', body);
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
  




// content of these files needs writing dynamically
const streamer = spawn('shaka-streamer', [
    '-itmp/input.yaml',
    '-ptmp/output.yaml',
    '-cgs://extreamer/stream01'
]);

streamer.stdout.on("data", data => {
    console.log(`stdout: ${data}`);
});

streamer.stderr.on("data", data => {
    console.log(`stderr: ${data}`);
});

streamer.on('error', (error) => {
    console.log(`error: ${error.message}`);
});

streamer.on("close", code => {
    console.log(`child process exited with code ${code}`);
});