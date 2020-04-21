'use strict';

const
  _           = require('lodash'),
  trans       = require('./trans'),
  colors      = require('./myColors'), // jshint ignore:line
  packageJson = require('../package.json')
;


const appName = _.get(packageJson, 'name', 'myApp');

module.exports.logInfo = logInfo;
module.exports.logError = logError;
module.exports.logWarning = logWarning;
module.exports.logDebug = logDebug;
module.exports.logSuccess = logSuccess;

function logError (err) {
  const message = typeof err === 'string' ? arguments : [err.message || '', err];
  console.error('%s [%s] [%s] %s',
                appName.bold.danger,
                'Error',
                _getDate(),
                ...(_.map(message, trans))
  )
  ;
}

function logSuccess () {
  console.info('%s [%s] [%s] %s',
               appName.bold.success,
               'Success',
               _getDate(),
               ...(_.map(arguments, trans))
  );
}

function logInfo () {
  console.info('%s [%s] [%s] %s',
               appName.bold.info,
               'Info',
               _getDate(),
               ...(_.map(arguments, trans))
  );
}

function logWarning (err) {
  if (process.env.NODE_ENV === 'test') return;
  const message = typeof err === 'string' ? arguments : [err.message || '', err];
  console.warn('%s [%s] [%s] %s',
               appName.bold.warning,
               'Warning',
               _getDate(),
               ...(_.map(message, trans))
  );
}

function logDebug () {
  if (['test', 'production'].includes(process.env.NODE_ENV)) return;
  console.info('%s [%s] [%s] %s',
               appName.bold.primary,
               'Debug',
               _getDate(),
               ...(_.map(arguments, trans))
  );
}

function _getDate () {
  return new Date(Date.now()).toLocaleString(undefined, {timeZoneName: 'short'});
}
