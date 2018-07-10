var gulp = require('gulp');
var fs = require('fs');
var log = require('fancy-log');
var chalk = require('chalk');

var createOutputDirectory = require("./shared").createOutputDirectory;

function generateReleaseNotes(done) {
  fs.readFile('./CHANGELOG.md', (err, data) => {
      if (err) {
          log.error(`${chalk.red('ERROR')}: could not read CHANGELOG.md: ${err}`);
          done(err);
      }

      const regex = new RegExp(/^# ([0-9]).([0-9]).([0-9]).*/);
      const lines = data.toString().split('\n');

      const firstHeaderLine = lines.findIndex((l) => l.match(regex));
      if (firstHeaderLine === -1) {
          log.error(`${chalk.red('ERROR')}: could not find first header`);
          done(new Error("could not find first header"));
      }

      const secondHeaderLine = lines.findIndex((l, index) => {
          return firstHeaderLine < index && l.match(regex);
      });

      fs.writeFile("out/LAST_RELEASE.md", lines.slice(firstHeaderLine, secondHeaderLine).join("\n"), (err) => {
          if (err) {
              log.error(`${chalk.red('ERROR')}: could not write out/LAST_RELEASE.md: ${err}`);
              done(err);
          } else {
              done();
          }
      });
  });
}

gulp.task('generateReleaseNotes', gulp.series(createOutputDirectory, generateReleaseNotes));

