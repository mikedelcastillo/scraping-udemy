const {exec} = require('child_process');

module.exports = (command) => new Promise((resolve, reject) => {
  exec(command, (err, stdout, stderr) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(stdout, stderr);
  });
});
