const rp = require('request-promise');
const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

async function fetchSwaggerJSON() {
  console.log('argv: ', argv);

  const url = argv['url'];
  const swaggerDir = argv['outputDir'] ? path.resolve(process.cwd(), argv['outputDir']) : path.resolve(process.cwd());

  console.log(`Fetching Swagger at ${url}`);
  try {
    await new Promise((res, rej) => {
      rp(`${url}`).then(json => {
        try {
          JSON.parse(json);
          fs.writeFile(path.join(swaggerDir, 'swagger.json'), json, (err) => {
            if (err) {
              rej(err);
            }
            res(json);
          });
        } catch (err) {
          rej(err);
        }
      });
    });
  } catch (err) {
    console.error(JSON.stringify(err), `Error:`, url);
    throw err;
  }
}

module.exports = { fetchSwaggerJSON };