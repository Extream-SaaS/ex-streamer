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
  subscriptionName = 'ex-streamer-outgoing',
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
          if (!fs.existsSync(`${dir}`)) {
              fs.mkdirSync(`${dir}`);
          }
          if (!fs.existsSync(`${dir}/${body.payload.id}`)) {
              fs.mkdirSync(`${dir}/${body.payload.id}`);
          }
          if (!fs.existsSync(`${dir}/${body.payload.id}/${body.user.id}`)) {
            fs.mkdirSync(`${dir}/${body.payload.id}/${body.user.id}`);
        }
          fs.writeFile(`${dir}/${body.payload.id}/${body.user.id}/index.m3u8`, `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=842x480
480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p.m3u8`, (err) => {
              if (!err) {
                  if (processes[body.payload.id+body.user.id]) {
                      // kill the first instance and reinitiate
                      processes[body.payload.id+body.user.id].stdin.pause();
                      processes[body.payload.id+body.user.id].kill();
                  }
                  console.log(body.user.username);
                  const textConfigSD = `drawtext=fontfile=./fonts/Montserrat-Medium.ttf:text='Transcoded for ${body.user.username}':fontcolor=white: fontsize=12: box=1: boxcolor=black@0.2: x=(w-text_w)/2: y=(h-text_h)/2: fix_bounds=1`;
                  const textConfig = `drawtext=fontfile=./fonts/Montserrat-Medium.ttf:text='Transcoded for ${body.user.username}':fontcolor=white: fontsize=24: box=1: boxcolor=black@0.2: x=(w-text_w)/2: y=(h-text_h)/2: fix_bounds=1`;
                  console.log([`ffmpeg`, [
                    '-re',
                    '-i', `${body.payload.streamUrl}`,
                    '-vf', `scale=w=842:h=480:force_original_aspect_ratio=decrease,${textConfigSD}`,
                    '-c:a', 'aac',
                    '-ar', '44100',
                    '-c:v', 'libx264',
                    '-profile:v', 'main',
                    '-crf', '20',
                    '-sc_threshold', '0',
                    '-g', '48',
                    '-keyint_min', '48',
                    '-hls_time', '4',
                    '-hls_playlist_type', 'event',
                    '-b:v', '1400k',
                    '-maxrate', '1498k',
                    '-bufsize', '2100k',
                    '-b:a', '128k',
                    '-hls_segment_filename', `${dir}/${body.payload.id}/${body.user.id}/480p_%03d.ts`,
                    `${dir}/${body.payload.id}/${body.user.id}/480p.m3u8`,
                    '-vf', `scale=w=1280:h=720:force_original_aspect_ratio=decrease,${textConfig}`,
                    '-c:a', 'aac',
                    '-ar', '44100',
                    '-c:v', 'libx264',
                    '-profile:v', 'main',
                    '-crf', '20',
                    '-sc_threshold', '0',
                    '-g', '48',
                    '-keyint_min', '48',
                    '-hls_time', '4',
                    '-hls_playlist_type', 'event',
                    '-b:v', '2800k',
                    '-maxrate', '2996k',
                    '-bufsize', '4200k',
                    '-b:a', '128k',
                    '-hls_segment_filename', `${dir}/${body.payload.id}/${body.user.id}/720p_%03d.ts`,
                    `${dir}/${body.payload.id}/720p.m3u8`].join(' ')]);
                  processes[body.payload.id+body.user.id] = spawn(`ffmpeg`, [
                      '-re',
                      '-i', `${body.payload.streamUrl}`,
                      '-vf', `scale=w=842:h=480:force_original_aspect_ratio=decrease,${textConfigSD}`,
                      '-c:a', 'aac',
                      '-ar', '44100',
                      '-c:v', 'libx264',
                      '-profile:v', 'main',
                      '-crf', '20',
                      '-sc_threshold', '0',
                      '-g', '48',
                      '-keyint_min', '48',
                      '-hls_time', '4',
                      '-hls_playlist_type', 'event',
                      '-b:v', '1400k',
                      '-maxrate', '1498k',
                      '-bufsize', '2100k',
                      '-b:a', '128k',
                      '-hls_segment_filename', `${dir}/${body.payload.id}/${body.user.id}/480p_%03d.ts`,
                      `${dir}/${body.payload.id}/${body.user.id}/480p.m3u8`,
                      '-vf', `scale=w=1280:h=720:force_original_aspect_ratio=decrease,${textConfig}`,
                      '-c:a', 'aac',
                      '-ar', '44100',
                      '-c:v', 'libx264',
                      '-profile:v', 'main',
                      '-crf', '20',
                      '-sc_threshold', '0',
                      '-g', '48',
                      '-keyint_min', '48',
                      '-hls_time', '4',
                      '-hls_playlist_type', 'event',
                      '-b:v', '2800k',
                      '-maxrate', '2996k',
                      '-bufsize', '4200k',
                      '-b:a', '128k',
                      '-hls_segment_filename', `${dir}/${body.payload.id}/${body.user.id}/720p_%03d.ts`,
                      `${dir}/${body.payload.id}/720p.m3u8`,
                    //   '-vf', `scale=w=1920:h=1080:force_original_aspect_ratio=decrease,${textConfig}`,
                    //   '-c:a', 'aac',
                    //   '-ar', '44100',
                    //   '-c:v', 'libx264',
                    //   '-profile:v', 'main',
                    //   '-crf', '20',
                    //   '-sc_threshold', '0',
                    //   '-g', '48',
                    //   '-keyint_min', '48',
                    //   '-hls_time', '4',
                    //   '-hls_playlist_type', 'event',
                    //   '-b:v', '5000k',
                    //   '-maxrate', '5350k',
                    //   '-bufsize', '7500k',
                    //   '-b:a', '192k',
                    //   '-hls_segment_filename', `${dir}/${body.payload.id}/${body.user.id}/1080p_%03d.ts`,
                    //   `${dir}/${body.payload.id}/${body.user.id}/1080p.m3u8`
                  ]);
                  // processes[body.payload.id] = spawn('ffmpeg', [
                  //     '-re',
                  //     `-i ${body.payload.streamUrl}`,
                  //     '-codec copy',
                  //     '-f hls',
                  //     '-hls_time 4',
                  //     '-hls_playlist_type event',
                  //     '-c:v libx264',
                  //     '-crf 21',
                  //     '-vf "scale=w=1920:h=1080:force_original_aspect_ratio=decrease"',
                  //     '-preset veryfast',
                  //     '-ac 2',
                  //     '-g 25',
                  //     '-sc_threshold 0',
                  //     '-c:a aac',
                  //     '-b:a 192k',
                  //     `${dir}/${body.payload.id}/index.m3u8`
                  // ]);
                  console.log(processes[body.payload.id+body.user.id]);
                  processes[body.payload.id+body.user.id].stdout.on("data", data => {
                      console.log(`stdout: ${data}`);
                  });
                  
                  processes[body.payload.id+body.user.id].stderr.on("data", data => {
                      console.error(`stderr: ${data}`);
                  });
                  
                  processes[body.payload.id+body.user.id].on('error', (error) => {
                      console.log(`error: ${error.message}`);
                  });
                  
                  processes[body.payload.id+body.user.id].on("close", code => {
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
