if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const { spawn } = require("child_process");
const fs = require('fs');
const dir = './tmp';

// listens to ex-encoder queue for creating streams
// Imports the Google Cloud client library
const {PubSub} = require('@google-cloud/pubsub');
const {Storage} = require('@google-cloud/storage');
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
    const messageHandler = async (message, internal=false) => {
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
                    message.ack();
                }
            });
        } else if (body.command === 'complete') {
            // kill the process
            if (!processes[body.payload.id]) {
                // not found in this instance, move to the next
                message.ack();
            } else {
                processes[body.payload.id].stdin.pause();
                processes[body.payload.id].kill();
                delete processes[body.payload.id];
                message.ack();
            }
        } else if (body.command === 'encode') {
            if (!body.user) {
                // its a message that doesn't contain everything
                console.log(body);
                message.ack();
                return true;
            }
            // create folder and download source
            if (!fs.existsSync(`${dir}/${body.payload.id}-${body.user.token}`)){
                fs.mkdirSync(`${dir}/${body.payload.id}-${body.user.token}`);
            }

            // download file from cloud storage
            const storage = new Storage();
            const bucket = storage.bucket('ex-streamer');

            const fileRef = bucket.file(`playback/tmp/${body.payload.input_file}`);

            await fileRef.download({
                destination: `${dir}/${body.payload.id}-${body.user.token}/${payload.input_file}`
            });


            // generate the yaml files
            fs.writeFile(`${dir}/${body.payload.id}-${body.user.token}/input.yaml`, `inputs:
  - name: ${dir}/${body.payload.id}-${body.user.token}/${payload.input_file}
    media_type: video
    - name: ${dir}/${body.payload.id}-${body.user.token}/${payload.input_file}
    media_type: audio`, (err) => {
                if (!err) {
                    if (processes[body.payload.id]) {
                        // kill the first instance and reinitiate
                        processes[body.payload.id].stdin.pause();
                        processes[body.payload.id].kill();
                    }
                    processes[body.payload.id] = spawn('shaka-streamer', [
                        `-i${dir}/${body.payload.id}-${body.user.token}/input.yaml`,
                        '-ptmp/output_vod.yaml',
                        `-cgs://ex-streamer/playback/${body.payload.id}`
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
                    message.ack();
                }
            });
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
