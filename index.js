const { fetchSwaggerJSON } = require('./utils/fetch');
const { APIPaths } = require('./components/paths');
const { APIClasses } = require('./components/objects');
// const { APIStores } = require('./Components/Stores');

async function run() {
  await fetchSwaggerJSON();
  new APIPaths();
  new APIClasses();
}

module.exports = run;
