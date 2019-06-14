const { writeFile } = require('../utils/files');
const argv = require('minimist')(process.argv.slice(2));
const path = require('path');

const swaggerDir = argv['outputDir'] ? path.resolve(process.cwd(), argv['outputDir']) : path.resolve(process.cwd());

let swagger;

class APIPaths {

  constructor() {
    console.log('Process Paths');
    swagger = require(path.join(swaggerDir, 'swagger.json'));
    let pathData = this.createAPIPaths();
    this.printData(pathData);
  }

  createAPIPaths() {
    let {
      paths
    } = swagger;
    let output = {};
    for (let path in paths) {
      for (let endpoint in paths[path]) {
        let data = paths[path][endpoint];
        let processedData = this.processEndpoint(data);
        if (!output[processedData.tag]) {
          output[processedData.tag] = [];
        }
        output[processedData.tag].push({
          name: processedData.name,
          path: path,
          type: endpoint
        });

      }
    }
    return output;
  }

  readTags(tags) {
    tags = tags ? tags : ['undefined'];
    let value = tags[0].replace('-', '_').replace(/\s/g, '_');
    return value;
  }

  // API path processor function
  // 
  processPath(path) {
    // return (/^(?:(\W|)api)/).test(path)
    //     ? path.replace(/{([^{]*)}/g, '${$1}')
    //     : PATH_PREFIX + path.replace(/{([^{]*)}/g, '${$1}');
    if (path.startsWith('/')) {
      return path.substring(1).replace(/{([^{]*)}/g, '${$1}');
    } else {
      return path.replace(/{([^{]*)}/g, '${$1}');
    }
  }

  processEndpoint(val) {
    if (!val.tags) {
      val.tags = ['undefined']
    }
    console.log('TAG NOT FOUND: ', val);

    return {
      tag: this.readTags(val.tags),
      name: val.operationId,
    }
  }

  printData(data) {
    let output = '';
    output += `/* tslint:disable:max-line-length */\n/* tslint:disable:variable-name */\n`;

    let tags = [];
    for (let val in data) {
      let tag = '';
      tag += `    ${val.toUpperCase()}: {\n`;
      for (let path of data[val]) {
        const regex = /\{([^\{\}]*)\}/g;
        const str = path.path;
        let m;
        let variableMatches = [];
        while ((m = regex.exec(str)) !== null) {
          // This is necessary to avoid infinite loops with zero-width matches
          if (m.index === regex.lastIndex) {
            regex.lastIndex++;
          }

          // The result can be accessed through the `m`-variable.
          m.forEach((match, groupIndex) => {
            if (groupIndex > 0) {
              variableMatches.push(`${match}: number | string`);
            }
          });
        }
        let variables = variableMatches.join(', ') || '';
        let processedPath = this.processPath(path.path);
        tag += `        ${path.name}: (${variables}) => \`${processedPath}\`,`;
        tag += `\n`;
      }
      tag += `    }`;
      tags.push(tag);

    }
    output += `export const API_URL = {\n${tags.join(',\n')}\n};`;
    writeFile('APIEndpoints.ts', output);
  }

}

module.exports = {
  APIPaths
}