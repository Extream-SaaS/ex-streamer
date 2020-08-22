const { spawn } = require("child_process");

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