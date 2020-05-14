'use strict';

const should              = require('should'),
      {exchange}          = require('../src/exchange'),
      {findDocumentsBy}   = require('../src/reviewManager'),
      {MONOGRAPH, SERIAL} = require('../src/dataModel')
;

describe('Exchange', function() {
  it('Should compute exchange data', function(done) {

    const maxSize              = 100,
          expectedMaxTimeByDoc = 250, //ms
          minTimeout           = 5000
    ;

    this.timeout(Math.max(maxSize * expectedMaxTimeByDoc, minTimeout));

    const {pipeline, info} = exchange({parallel: 50, doProfile: true, doWarn: true});

    findDocumentsBy({type: SERIAL, maxSize})
      .pipe(pipeline)
      .done(() => {
        info();
        done();
      })
    ;
  });
});
