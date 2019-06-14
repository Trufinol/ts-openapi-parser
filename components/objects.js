const { writeFile } = require('../utils/files');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

let swagger;

class APIClasses {
  constructor() {
    const swaggerDir = argv['outputDir'] ? path.resolve(process.cwd(), argv['outputDir']) : path.resolve(process.cwd());
    swagger = require(path.join(swaggerDir, 'swagger.json'));
    this.foundClasses = [];
    this.foundEnums = [];
    this.createAPIClasses();
  }

  createAPIClasses() {
    let definitions = this.processDefinitions();
    this.parseEnumsInParameters();
    this.sortArrays();
    // this.writeClasses();
    this.writeInterfaces();
    this.writeEnums();

    console.log('Processed Definitions');
  }

  sortArrays() {
    this.foundClasses = this.foundClasses.sort((a, b) => this.stringSort(a, b, 'name'));
    this.foundEnums = this.foundEnums.sort((a, b) => this.stringSort(a, b, 'name'))
  }

  processDefinitions() {
    let {
      components: {
        schemas
      }
    } = swagger;

    let out = Object.keys(schemas);
    for (let key of out) {
      this.foundClasses.push(this.readClass(key, schemas[key]));
    }
  }

  readClass(className, definition) {
    return {
      name: className,
      attributes: this.readAttributes(className, definition.properties)
    }
  }

  readAttributes(className, properties) {
    let result = [];
    if (properties) {
      for (let key of Object.keys(properties)) {
        result.push(this.readAttribute(className, key, properties[key]))
      }
    }

    return result;
  }

  readAttribute(className, attributeName, value) {
    // console.log(attributeName, value);
    let optional = this.analyseOptionalFlag(value);
    let type = this.analyseTypes(className, attributeName, value);
    return {
      name: attributeName,
      optional: optional,
      type: type
    }
  }

  analyseOptionalFlag(obj) {
    let mapOptional = {
      'boolean': () => true,
      'string': () => (obj.minLength === undefined),
      'default': () => true
    }

    return (mapOptional[obj.type] || mapOptional.default)();
  }

  analyseTypes(className, attributeName, obj) {
    // FIXME: Dummy approach for dummy error.
    if (attributeName === 'suppressed') {
      return 'any';
    }
    if (obj['$ref']) {
      return `API_${obj['$ref'].split('/')[3]}`;
    } else if (obj['enum']) {
      return this.processEnum(className, attributeName, obj.enum);
    } else {
      let mapTypes = {
        'string': () => 'string',
        'integer': () => 'number',
        'number': () => 'number',
        'boolean': () => 'boolean',
        'array': () => {
          return `${this.analyseTypes(className, attributeName, obj.items)}[]`
        },
        'object': () => {
          if (obj.additionalProperties) {
            return `{ [key: string ]: ${this.analyseTypes(className, attributeName, obj.additionalProperties)} }`;
          } else {
            return 'Object';
          }
        }
      };

      try {
        return mapTypes[obj.type]();
      } catch (err) {
        console.error("Failed Analysis", err, obj);
      }
    }

    return 'test';
  }

  processEnum(className, attributeName, val, addToApiClasses = true) {
    // let entry = this.foundEnums.find((item) => {
    //   for (let check in val) {
    //     if (!item.value.includes(val[check])) {
    //       return false;
    //     }
    //   }
    //   return true;
    // });
    // if (entry) {
    //   return entry.name;
    // } else {
    let outName = `API_${className.replace('-', '_').toUpperCase()}_${attributeName.toUpperCase()}`
    this.foundEnums.push({
      name: outName,
      value: val,
      addToApiClasses
    })
    return outName;
    // }
  }


  parseEnumsInParameters() {
    let {
      paths
    } = swagger;
    let buffer = [];
    for (let path in paths) {
      for (let method in paths[path]) {

        if (paths[path][method].parameters) {
          const enums = paths[path][method].parameters.filter(item => item.schema && item.schema.enum)
            .map(item => ({
              // NOTE: maybe use operationId instead of tag
              className: paths[path][method].tags ? paths[path][method].tags[0] : 'Null_',
              attributeName: item.name,
              values: item.schema.enum
            }));
          if (enums.length) {
            buffer = buffer.concat(enums);
          }
        }
      }
    }
    let enumsMap = {};
    buffer.forEach(item => {
      const key = item.className + item.attributeName;
      if (!enumsMap[key]) {
        enumsMap[key] = item;
      }
    });
    Object.values(enumsMap).forEach(item => this.processEnum(item.className, item.attributeName, item.values, false));
  }

  stringSort(a, b, namespace) {
    if (`${a[namespace]}`.toLowerCase() < `${b[namespace]}`.toLowerCase()) {
      return -1;
    }
    if (`${a[namespace]}`.toLowerCase() > `${b[namespace]}`.toLowerCase()) {
      return 1;
    }
    return 0;
  }

  getSortedAttributes(attributes) {
    return attributes.sort((a, b) => {
      if (a.optional === b.optional) {
        return this.stringSort(a, b, 'name');
      }
      if (a.optional) {
        return 1
      } else {
        return -1
      }
    });
  }

  writeInterfaces() {
    let interfaceDefinitions = '';
    for (let item of this.foundClasses) {

      let attributes = this.getSortedAttributes(item.attributes).map((item) => {
        return `\t${item.name}${item.optional ? '?' : ''}: ${item.type}`;
      }).join(';\n');

      interfaceDefinitions += `interface API_${item.name} {\n${attributes}\n}\n`;
    }

    for (let item of this.foundEnums) {
      let values = item.value.join('" | "');
      interfaceDefinitions += `type ${item.name} = "${values}";\n`;
    }

    writeFile('API_interfaces.d.ts', interfaceDefinitions);
  }

  writeClasses() {
    let header = `//tslint:disable \n`;

    let enumImport = this.foundEnums.filter(item => item.addToApiClasses).map((val) => {
      return `import { ${val.name} } from 'General/APIEnums';`
    });
    let imports = enumImport.join('\n');

    let classDefinitions = '';

    for (let item of this.foundClasses) {
      let attributes = this.getSortedAttributes(item.attributes).map((item) => {
        return `\t\tpublic ${item.name}${item.optional ? '?' : ''}: ${item.type}`;
      }).join(',\n');

      classDefinitions += `export class API_${item.name} {\n\tconstructor(\n${attributes}\n\t) { }\n}\n`;
    }

    let classesOutput = `${header}\n${imports}\n${classDefinitions}`
    writeFile('APIClasses.ts', classesOutput);
  }

  writeEnums() {
    let enumList = this.foundEnums.map((val) => {
      let entries = val.value.map((item) => {
        let varName = `${item}`.toUpperCase().replace(' ', '_');
        return `    ${varName} = '${item}',`
      });
      return `export enum ${val.name.toUpperCase()} {\n${entries.join('\n')}\n}`;
    });
    writeFile('APIEnums.ts', enumList.join('\n'));
  }

  //Definitions


}

module.exports = {
  APIClasses
};