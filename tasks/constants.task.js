var gulp = require('gulp');
var fs = require('fs');
var log = require('fancy-log');
var chalk = require('chalk');

var createOutputDirectory = require("./shared").createOutputDirectory;

function generateConstantsKeyfile(done) {
  let contents = {
    APPINSIGHTS_KEY: process.env.APPINSIGHTS_KEY
  };

  if (!contents.APPINSIGHTS_KEY) {
    if (process.env.CI || process.argv.indexOf("--require-appinsights-key") !== -1) {
      log.error(`${chalk.red('ERROR')}: AppInsights Key missing in CI build`);
      done(new Error("AppInsights Key missing in CI build, set APPINSIGHTS_KEY environment variable"));
    } else {
      log.warn(` ${chalk.yellow('WARN')}: AppInsights Key not bundled, this build will NOT emit metrics.`);
    }
  } else {
    log.info(` ${chalk.green('INFO')}: AppInsights Key bundled, this build will emit metrics`);
  }

  fs.writeFile('out/src/constants.json', JSON.stringify(contents), done);
}

gulp.task("generateConstantsKeyfile", gulp.series(createOutputDirectory, generateConstantsKeyfile));