var gulp = require('gulp');
var tslint = require('gulp-tslint');
var ts = require('gulp-typescript');
var sourcemaps = require('gulp-sourcemaps');
var using = require('gulp-using');
var path = require('path');
var log = require('fancy-log');
var chalk = require('chalk');
var mocha = require('gulp-mocha');
var hub = require('gulp-hub');

var registry = new hub(['./tasks/*.task.js']);
gulp.registry(registry);

// copy autocompletion data
function copyAutocompletionData() {
    return gulp.src('src/data/*.json')
    .pipe(using({ prefix: 'Bundling auto-completion data', filesize: true }))
    .pipe(gulp.dest('out/src/data'));
}

// copy templates
function copyHtmlTemplates() {
    return gulp.src('src/ui/*.html')
        .pipe(using({ prefix: 'Bundling html templates', filesize: true }))
        .pipe(gulp.dest('out/src/ui'));
}

// tslint
function lint() {
    return gulp.src(['src/**/*.ts', 'test/**/*.ts'])
    .pipe(tslint())
    .pipe(tslint.report());
}
gulp.task(lint);

// compile
function compile() {
    var project = ts.createProject('tsconfig.json');

    return     project.src()
    .pipe(sourcemaps.init())
    .pipe(project())
    .pipe(sourcemaps.mapSources((sourcePath, file) => {
        let relativeLocation = path.join(path.relative(path.join('out', path.dirname(file.relative)), '.'), 'src/');
        let relativeLocationToFile = path.join(relativeLocation, sourcePath);
        return relativeLocationToFile;
    }))
    .pipe(sourcemaps.write('.', {
        includeContent: false
    }))
    .pipe(gulp.dest('out'));
}
gulp.task(compile);

// unit tests
// WARNING: unit tests do not have good coverage yet, also run integration tests
function test() {
    return gulp.src(['test/**/*.unit.test.ts'], { read: false })
        .pipe(mocha({
            reporter: 'spec',
            ui: 'tdd',
            require: 'ts-node/register'
        }));
}
gulp.task(test);

function testNoFail() {
    return test()
    .on('error', (err) => {
        log.error(`${chalk.red('ERROR')}: ${err.message}`);
    });
}

// release notes

// compile
gulp.task('build',
    gulp.series(
        'generateHclHilJs',
        copyAutocompletionData,
        copyHtmlTemplates,
        'generateConstantsKeyfile',
        'generateReleaseNotes',
        'compile'));

// watch
function watch() {
    return gulp.watch(['src/**/*.ts', 'src/ui/*.html', 'test/**/*.ts'],
            gulp.series(copyHtmlTemplates, lint, testNoFail, compile));
}
gulp.task('watch', gulp.series('build', testNoFail, watch));

// default
gulp.task('default', gulp.series('build', 'lint', 'test'));
