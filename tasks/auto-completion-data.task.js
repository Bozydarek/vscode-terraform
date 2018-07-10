//
// this file preprocesses the auto-completion data from vim-terraform-completion and bundles it
//

const gulp = require('gulp');
const path = require('path');
const log = require('fancy-log');
const download = require("./download");
const decompress = require('gulp-decompress');
const merge = require('gulp-merge-json');
const transform = require('gulp-json-transform');
const fs = require('fs');

const jsonSpace = process.argv.indexOf("--beautify-index-data") ? 2 : 0;

gulp.task('get-vim-terraform-completion-data', () => {
  const url = 'https://github.com/juliosueiras/vim-terraform-completion/archive/master.zip';

  return download(url)
    .pipe(decompress())
    .pipe(gulp.dest("out/tmp/vim-terraform-completion"));
});

function transformKind(data, path) {
  // this is the existing kinds from the original data:
  const knownKinds = ["Bool", "Bool(O)", "Bool(R)", "Float", "Float(O)", "Float(R)", "Int", "Int(O)", "Int(R)", "List", "List(B)", "List(O)", "List(O)(B)", "List(R)", "List(R)(B)", "Map", "Map(O)", "Map(O)(B)", "Map(R)", "Map(R)(B)", "Map(B)", "Set", "Set(B)", "Set(O)", "Set(O)(B)", "Set(R)", "Set(R)(B)", "String", "String(O)", "String(R)"];

  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === "object") {
      transformKind(value, path.concat([key]));
    } else if (key === "kind") {
      if (knownKinds.indexOf(value) === -1) {
        throw new Error(`Invalid kind: ${value} at ${path.join(", ")}`);
      }

      try {
        const regex = /([A-Za-z]+)(\([OR]\))?(\(B\))?/;
        const match = value.match(regex);

        const type = match[1].toLowerCase();
        const required_or_optional = match[2];
        const block = match[3];

        data.type = type;
        data.block = block === "(B)";
        if (path.indexOf("attributes") === -1) {
          // nonsensical for attributes
          data.required = required_or_optional === "(O)";
        }
      } catch (e) {
        throw new Error(`Exception: ${e} at ${path.join(", ")}`);
      }
    }
  });
}

gulp.task('copy-provider-data', gulp.series('get-vim-terraform-completion-data', () => {
  return gulp.src([
    'out/tmp/vim-terraform-completion/vim-terraform-completion-master/community_provider_json/**/*.json',
    'out/tmp/vim-terraform-completion/vim-terraform-completion-master/provider_json/**/*.json'
  ])
    .pipe(transform((data, file) => {
      if (file.path.indexOf("community_provider_json") !== -1) {
        data.__meta = { type: "community_provider" };
      } else {
        data.__meta = { type: "provider" };
      }

      // transform 'kind' into type et al
      transformKind(data, [file.path]);

      return data;
    }, jsonSpace))
    .pipe(gulp.dest('out/src/data/providers'));
}));

gulp.task('create-provider-index', gulp.series('copy-provider-data', () => {
  return gulp.src('out/src/data/providers/**/*.json')
    .pipe(merge({
      fileName: 'provider-index.json',
      edit: (json, file) => {
        const dirSegments = path.dirname(file.path).split(path.sep);

        const providerName = path.basename(file.path, '.json');
        const providerVersion = dirSegments[dirSegments.length - 1];

        var result = {
          providers: {
            [providerName]: {
              versions: {
                [providerVersion]: {
                  path: path.relative(file.base, file.path)
                }
              },
              meta: json.__meta
            }
          }
        };

        for (const group of ['resources', 'datas', 'unknowns']) {
          result.providers[providerName].versions[providerVersion][group] = Object.keys(json[group] || {});
        }

        return result;
      }
    }))
    .pipe(transform((data) => {
      // jshint loopfunc: true

      var all = { resources: {}, datas: {}, unknowns: {} };
      const providers = Object.keys(data.providers);
      for (const provider of providers) {
        // 1. mark the latest version for quicker lookup

        const versions = Object.keys(data.providers[provider].versions);
        if (versions.length === 1) {
          data.providers[provider].latest = versions[0];
        } else if (versions.indexOf('master') !== -1) {
          data.providers[provider].latest = 'master';
        } else {
          const parsedVersions = versions.map((v) => {
            const match = v.match(/v?([0-9]+)\.([0-9]+)(\.([0-9]+))?/);
            if (!match) {
              log(`Unparseable version ${v} for ${provider}`);
              return null;
            }

            return {
              sort: parseInt(match[1]) * 1000000 +
                parseInt(match[2]) * 1000 +
                parseInt(match[4] || 0),
              version: v
            };
          })
            .filter((v) => !!v)
            .sort((left, right) => {
              if (left.sort < right.sort)
                return -1;
              if (left.sort === right.sort)
                return 0;
              return 1;
            })
            .reverse();

          data.providers[provider].latest = parsedVersions[0].version;
        }

        // 2. create a view of all resources
        for (const version of versions) {
          for (const group of Object.keys(all)) {
            for (const type of data.providers[provider].versions[version][group]) {
              all[group][`${provider}_${type}`] = true;
            }
          }
        }
      }

      // create a view of all resources
      data.views = { all: {} };
      for (const group of Object.keys(all)) {
        data.views.all[group] = Object.keys(all[group]);
      }

      log(`Created provider autocompletion index for ${providers.length} providers`);
      return data;
    }, jsonSpace))
    .pipe(gulp.dest('out/src/data'));
}));