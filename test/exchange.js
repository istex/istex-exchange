'use strict';

const should            = require('should'),
      {exchange}        = require('../src/exchange'),
      {findDocumentsBy} = require('../src/reviewManager'),
      hl                = require('highland')
;

describe('Exchange', function() {
  it('Should compute exchange data', function(_done) {

    const maxSize = 50;
    this.timeout(maxSize * 125);
    const {pipeline, done} = exchange();

    findDocumentsBy({type: 'serial', maxSize: 50})
      .pipe(pipeline)
      .tap(hl.log)
      .done(() => {
        done();
        _done();
      })
    ;
  });
});
