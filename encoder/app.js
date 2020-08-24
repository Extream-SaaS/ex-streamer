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

const activateObj = {
    domain: 'client',
    action: 'rtmp',
    command: 'activate',
    payload: {
        itinerary: '90fea305-ecf2-420b-b143-b8496180a963',
        configuration: {
            actor: '091e8b52-8506-4512-b75e-149ee51c4f04',
            mode: 'record',
            broadcast: true
        },
        updatedBy: '091e8b52-8506-4512-b75e-149ee51c4f04',
        id: 'cREtpfUXYiS8wdSSDELV',
        addedBy: '091e8b52-8506-4512-b75e-149ee51c4f04',
        end_date: { _seconds: 1598342400, _nanoseconds: 0 },
        title: 'Itinerary live stream 1',
        start_date: { _seconds: 1598256000, _nanoseconds: 0 },
        type: 'rtmp',
        updatedAt: { _seconds: 1598256006, _nanoseconds: 384000000 },
        addedAt: { _seconds: 1598141520, _nanoseconds: 469000000 },
        streamUrl: "rtmp://incoming.stream.extream.app/recorder/cREtpfUXYiS8wdSSDELV-3af435e5d505c4d349ae07161408375b43fb7c9e"
    },
    user: {
        id: "091e8b52-8506-4512-b75e-149ee51c4f04",
        username: "tester",
        fields: {
            custom: "fields"
        },
        token: "3af435e5d505c4d349ae07161408375b43fb7c9e"
    }
};

function pull(
    subscriptionName = 'ex-streamer-encoder',
    timeout = 60
) {
    const subscription = pubsub.subscription(subscriptionName);
    let messageCount = 0;
    const messageHandler = (message, internal=false) => {
        console.log(`Received message ${message.id}:`);
        messageCount += 1;
        const body = message.data ? JSON.parse(Buffer.from(message.data, 'base64').toString()) : message;
        // if activate then run
        // if complete then find the running process and kill it
        if (body.command === 'activate') {
            if (!body.user) {
                // its a message that doesn't contain everything
                console.log(body);
                message.ack();
                return true;
            }
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
                    if (processes[body.payload.id]) {
                        // kill the first instance and reinitiate
                        processes[body.payload.id].stdin.pause();
                        processes[body.payload.id].kill();
                    }
                    processes[body.payload.id] = spawn('shaka-streamer', [
                        `-i${dir}/${body.payload.id}-${body.user.token}/input.yaml`,
                        '-ptmp/output.yaml',
                        `-cgs://ex-streamer/${body.payload.configuration.mode}/${body.payload.id}`
                    ]);
                    processes[body.payload.id].stdout.on("data", data => {
                        console.log(`stdout: ${data}`);
                    });
                    
                    processes[body.payload.id].stderr.on("data", data => {
                        console.error(`stderr: ${data}`);
                    });
                    
                    processes[body.payload.id].on('error', (error) => {
                        console.log(`error: ${error.message}`);
                    });
                    
                    processes[body.payload.id].on("close", code => {
                        console.log(`child process exited with code ${code}`);
                    });
                    if (!internal) {
                        message.ack();
                    }
                } else if (!internal) {
                    message.nack();
                }
            });
        } else if (body.command === 'complete') {
            // kill the process
            if (!processes[body.payload.id]) {
                // not found in this instance, move to the next
                message.nack();
            } else {
                processes[body.payload.id].stdin.pause();
                processes[body.payload.id].kill();
                delete processes[body.payload.id];
                message.ack();
            }
        }
    };
    if (process.env.NODE_ENV !== 'production') {
        messageHandler(activateObj, true);
    } else {
        subscription.on('message', messageHandler);
        // regurgitate the handler occasionally \\
        setTimeout(() => {
            subscription.removeListener('message', messageHandler);
            console.log(`${messageCount} message(s) received. Refreshing.`);
            pull(subscriptionName, timeout);
        }, timeout * 1000);
    }
}

pull();
