const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

function writeFile(filename, data) {
  const outputDir = argv['outputDir'] ? path.resolve(process.cwd(), argv['outputDir']) : path.resolve(process.cwd());
  fs.writeFile(path.join(outputDir, filename), data, function (err) {
    if (err) {
      return console.log(err);
    }
  });
}

module.exports = { writeFile };