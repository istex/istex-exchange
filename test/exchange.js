'use strict';

const should            = require('should'),
      {exchange}             = require('../src/exchange'),
      {findDocumentsBy} = require('../src/reviewManager'),
      hl                = require('highland')
;

describe('Exchange', function() {
  it('Should compute exchange data', function(done) {
    findDocumentsBy({type:'serial'})
      .pipe(exchange)
      .tap(hl.log)
      .done(done)
    ;
  });
});
