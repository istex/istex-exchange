'use strict';

const hl            = require('highland'),
      {xmlHoldings} = require('@istex/config-component').get(module),
      fs            = require('fs-extra'),
      path          = require('path')
;

const fileSeparator = '<?xml';

/*
 * @see https://github.com/istex/istex-google-scholar/blob/master/resources/reference/institutional_links.xml
 */
module.exports.writeXmlHoldings = function({corpusName, type, outputPath} = {}) {

  return function(s) {
    return s.consume(_writeXmlHoldings({corpusName, type, outputPath}))
      ;
  };
};

//
// private helpers
//
function _writeXmlHoldings ({corpusName = 'istex', type = 'journals', outputPath = xmlHoldings.outputPath} = {}) {
  let fileIndex = -1;

  return function _write (err, x, push, next) {
    if (err) {
      push(err);
      next();
    }
    else if (x === hl.nil) {
      push(null, x);
    }
    else {
      let flag = 'a';
      if (x.startsWith(fileSeparator)) {
        flag = 'w';
        fileIndex++;
      }
      fs.outputFile(path.join(outputPath,
                              `institutional_holdings_${corpusName.toUpperCase()}_FRANCE_ISTEX${type.toUpperCase()}-${fileIndex}.xml`),
                    x,
                    {flag, encoding: 'utf-8'},
                    (err) => {
                      push(err);
                      next();
                    });
    }
  };
}


