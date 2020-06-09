'use strict';

const should              = require('should'),
      {exchange}          = require('../src/exchange'),
      {toKbart}           = require('../src/toKbart'),
      {findDocumentsBy}   = require('../src/reviewManager'),
      {MONOGRAPH, SERIAL} = require('../src/dataModel')
;

describe('Exchange', function() {
  it('Should compute exchange data', function(done) {

    const maxSize              = 100,
          expectedMaxTimeByDoc = 260, //ms
          minTimeout           = 5000,
          parallel             = 5,
          expectedTimeout      =
            Math.round(
              Math.max(
                maxSize * expectedMaxTimeByDoc / Math.log(Math.min(parallel, 5) + 1),
                minTimeout)
            )
    ;

    this.timeout(expectedTimeout);
    console.info('Expected timeout: ', expectedTimeout);

    this.timeout(Math.max(maxSize * expectedMaxTimeByDoc, minTimeout));

    const {pipeline, info} = exchange({parallel: 50, doProfile: true, doWarn: true});
    const onFinished = onceDone(done);

    findDocumentsBy({type: SERIAL, maxSize})
      .pipe(pipeline)
      .stopOnError(onFinished)
      .done(function() {
        info();
        onFinished();
      })
    ;


  });

  it.only('Should stream kbart stringified exchange data', function(done) {
    const maxSize              = 100,
          expectedMaxTimeByDoc = 260, //ms
          minTimeout           = 5000,
          parallel             = 5,
          expectedTimeout      =
            Math.round(
              Math.max(
                maxSize * expectedMaxTimeByDoc / Math.log(Math.min(parallel, 5) + 1),
                minTimeout)
            )
    ;

    this.timeout(expectedTimeout);
    console.info('Expected timeout: ', expectedTimeout);
    const {pipeline, info} = exchange({parallel, doProfile: true, doWarn: true});
    const onFinished = onceDone(done);

    findDocumentsBy({
                      type: SERIAL,
                      maxSize
                      //uri:'ark:/67375/8Q1-0S5X5C92-M'
                    })
      .pipe(pipeline)
      //.tap((data)=>{console.log(data)})
      .pipe(toKbart)
      //.tap((data)=>{console.log(data)})
      .stopOnError(onFinished)
      .done(() => {
        info();
        onFinished();
      })
    ;

  });
});

// Helpers
function onceDone (cb) {
  let called = false;
  return (err) => {
    if (called) return;
    called = true;
    cb(err);
  };
}
