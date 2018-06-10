const path = require('path');
const ROOT = './udemy';

module.exports = {
  ROOT,
  TEMP: path.join(ROOT, 'downloading'),
  COURSES: path.join(ROOT, 'courses'),
  DATA: path.join(ROOT, 'data'),
};
