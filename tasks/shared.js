const mkdirp = require('mkdirp');

module.exports = {
  createOutputDirectory: function createOutputDirectory(done) {
    mkdirp('out/src', done);
  }
};