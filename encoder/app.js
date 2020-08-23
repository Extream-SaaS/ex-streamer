if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const { spawn } = require("child_process");
const fs = require('fs');
const dir = './tmp';

// listens to ex-encoder queue for creating streams
// Imports the Google Cloud client library
const {PubSub} = require('@google-cloud/pubsub');
const grpc = require('grpc');
const projectId = 'stoked-reality-284921';

const pubsub = new PubSub({grpc, projectId});

const processes = {};

function pull(
    subscriptionName = 'ex-streamer-encoder',
    timeout = 60
) {
    const subscription = pubsub.subscription(subscriptionName);
    let messageCount = 0;
    const messageHandler = message => {
        console.log(`Received message ${message.id}:`);
        messageCount += 1;
        const body = message.data ? JSON.parse(Buffer.from(message.data, 'base64').toString()) : null;
        // if activate then run
        // if complete then find the running process and kill it
        if (body.command === 'activate') {
            // generate the yaml files
            if (!fs.existsSync(`${dir}/${body.payload.id}-${body.user.token}`)){
                fs.mkdirSync(`${dir}/${body.payload.id}-${body.user.token}`);
            }
            fs.writeFile(`${dir}/${body.payload.id}-${body.user.token}/input.yaml`, `inputs:
  - name: ${body.payload.streamUrl}
    media_type: video
  - name: ${body.payload.streamUrl}
    media_type: audio`, (err) => {
                if (!err) {
                    processes[body.payload.id] = spawn('shaka-streamer', [
                        `-i${dir}/${body.payload.id}-${body.user.token}/input.yaml`,
                        '-ptmp/output.yaml',
                        `-cgs://ex-streamer/${body.payload.configuration.mode}/${body.payload.id}`
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
                    message.ack();
                } else {
                    message.nack();
                }
            });
        } else if (body.command === 'complete') {
            // kill the process
            if (!processes[body.payload.id]) {
                message.nack();
            } else {
                processes[body.payload.id].stdin.pause();
                processes[body.payload.id].kill();
                message.ack();
            }
        }
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
