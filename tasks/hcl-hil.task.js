var gulp = require('gulp');

var spawn = require('child_process').spawn;
var fs = require('fs');

var createOutputDirectory = require("./shared").createOutputDirectory;

function generateHclContainer(done) {
  var docker = spawn('docker', [
    'build',
    '-t', 'gopher-hcl-gopherjs',
    '-f', 'hcl-hil/gopherjs.Dockerfile',
    'hcl-hil'], { stdio: 'inherit' });

  docker
    .on('error', (err) => {
      // this is such a common question by first-time
      // committers so that we should handle it and
      // show a proper error message

      log.error(`${chalk.red('ERROR')}: Cannot launch "docker": ${chalk.bold(err)}.`);
      log.error(` ${chalk.yellow('INFO')}: Docker is required for building, you can install it from https://www.docker.com`);

      throw err;
    })
    .on('close', (code) => {
      if (code !== 0) {
        done(new Error(`docker failed with code ${code}`));
      } else {
        done();
      }
    });
}

function generateTranspiledJs(done) {
  var docker = spawn('docker', [
    'run',
    '--rm', 'gopher-hcl-gopherjs'
  ], { stdio: ['ignore', 'pipe', 'inherit'] });

  var stream = fs.createWriteStream('hcl-hil/transpiled.js', { flags: 'w+' });

  docker.stdout.pipe(stream);
  docker.on('close', (code) => {
    if (code !== 0) {
      done(new Error(`docker run gopher-hcl-gopherjs failed with code ${code}`));
    } else {
      done();
    }
  });
}

function generateClosureContainer(done) {
  var docker = spawn('docker', [
    'build',
    '-t', 'gopher-hcl-closure-compiler',
    '-f', 'hcl-hil/closure.Dockerfile',
    'hcl-hil'], { stdio: 'inherit' });

  docker.on('close', (code) => {
    if (code !== 0) {
      done(new Error(`docker failed with code ${code}`));
    } else {
      done();
    }
  });
}

function generateHclHilJs(done) {
  var docker = spawn('docker', [
    'run',
    '--rm', 'gopher-hcl-closure-compiler'
  ], { stdio: ['ignore', 'pipe', 'inherit'] });

  var stream = fs.createWriteStream('out/src/hcl-hil.js', { flags: 'w+' });

  docker.stdout.pipe(stream);
  docker.on('close', (code) => {
    if (code !== 0) {
      done(new Error(`docker run gopher-hcl-gopherjs failed with code ${code}`));
    } else {
      done();
    }
  });
}

gulp.task('generateHclHilJs',
  gulp.series(
    createOutputDirectory,
    generateHclContainer,
    generateTranspiledJs,
    generateClosureContainer,
    generateHclHilJs));
