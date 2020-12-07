'use strict';

const convert         = require('xml-js'),
      hl              = require('highland'),
      bytes           = require('bytes'),
      {xmlHoldings}   = require('config-component').get(module),
      {model, SERIAL} = require('./reviewModel')
;

/*
 * @see https://github.com/istex/istex-google-scholar
 * @note For some reasons you can't use {spaces} on xmlHoldings creation without puting standalone="no"
 * @see https://stackoverflow.com/questions/58996045/internal-dtd-validation-using-notepad
 * @see https://stackoverflow.com/questions/5578645/what-does-the-standalone-directive-mean-in-xml
 */
module.exports.toXmlHoldings = function({sizeLimit, spaces, dtd} = {}) {
  return function(s) {
    return s.map((exchangeData) => {return _exchangeDataToXmlHoldingsItem(exchangeData, {spaces});})
            .consume(_wrapItemsBySizeLimit({sizeLimit, prepend: _getXmlHoldingsStart({dtd})}))
      ;
  };
};

//
// private helpers
//

function _wrapItemsBySizeLimit ({
                                  sizeLimit = bytes(String(xmlHoldings.maxXmlHoldingsSize)),
                                  prepend = _getXmlHoldingsStart(),
                                  append = _getXmlHoldingsEnd()
                                } = {}) {
  let doPrepend = true;
  let totalLength = 0;
  let doBatch = true;

  if (sizeLimit === 0) doBatch = false;

  sizeLimit = Math.max(sizeLimit - prepend.length - append.length, 1);


  return function _batch (err, x, push, next) {
    if (err) {
      push(err);
      next();
    }
    else if (x === hl.nil) {
      if (!doPrepend) {
        push(null, append);
      }
      push(null, x);
    }
    else {
      if (doBatch && !doPrepend && (totalLength + x.length) >= sizeLimit) {
        push(null, append);
        doPrepend = true;
        totalLength = 0;
      }

      if (doPrepend) {
        push(null, prepend);
        doPrepend = false;
      }

      totalLength += x.length;
      push(null, x);

      next();
    }
  };
}

function _exchangeDataToXmlHoldingsItem ({
                                           coverages,
                                           reviewData: {
                                             [model.title]: title,
                                             [model.issn] : issn,
                                             [model.isbn] : isbn,
                                             [model.type] : type
                                           }
                                         },
                                         {spaces = xmlHoldings.spaces} = {}) {

  const js2xmlOptions = {
    spaces
  };
  const root = {elements: []};
  const item =
          {
            type      : 'element',
            name      : 'item',
            attributes: {
              type: 'electronic'
            },
            elements  : [
              {
                type    : 'element',
                name    : 'title',
                elements: [
                  {
                    type: 'text',
                    text: title
                  }
                ]

              }
            ]
          }
  ;

  if (issn) {
    item.elements.push(
      {
        type    : 'element',
        name    : 'issn',
        elements: [
          {
            type: 'text',
            text: issn
          }
        ]

      });
  }

  if (isbn) {
    item.elements.push(
      {
        type    : 'element',
        name    : 'isbn',
        elements: [
          {
            type: 'text',
            text: isbn
          }
        ]

      });
  }

  // Serial coverage
  if (type === SERIAL) {
    coverages
      .forEach(({
                  num_first_issue_online : issue,
                  num_first_vol_online   : volume,
                  date_first_issue_online: year,
                  ...rest
                }) => {

        // the element <from><year> is mandatory
        if (!year) return;

        const coverage = _buildCoverageElement();
        coverage.elements.push(_buildFromElement({year, volume, issue}));

        if (_coverageContainsToValue(rest)) coverage.elements.push(_buildToElement(rest));

        item.elements.push(coverage);
      });
  }


  root.elements.push(item);

  return convert.js2xml(root, js2xmlOptions);
}

function _getXmlHoldingsStart ({dtd = xmlHoldings.dtd} = {}) {
  const prolog       = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                       + '<!DOCTYPE institutional_holdings PUBLIC "-//GOOGLE//Institutional Holdings 1.0//EN" '
                       + `"${dtd}">`,
        rootStartTag = '<institutional_holdings>';

  return prolog + rootStartTag;
}

function _getXmlHoldingsEnd () {
  return '</institutional_holdings>';
}

function _buildCoverageElement () {
  return {
    type    : 'element',
    name    : 'coverage',
    elements: []
  };
}


function _buildFromElement ({year, volume, issue}) {
  const from = {
    type    : 'element',
    name    : 'from',
    elements: []
  };

  // year is mandatory
  from.elements.push(_buildTextElement('year', year));
  if (volume != null) from.elements.push(_buildTextElement('volume', volume));
  if (issue != null) from.elements.push(_buildTextElement('issue', issue));

  return from;
}


function _coverageContainsToValue ({
                                     num_last_issue_online,
                                     num_last_vol_online,
                                     date_last_issue_online
                                   }) {
  return date_last_issue_online != null || num_last_vol_online != null || num_last_issue_online != null;
}


function _buildToElement ({
                            num_last_issue_online : issue,
                            num_last_vol_online   : volume,
                            date_last_issue_online: year
                          }) {
  const to = {
    type    : 'element',
    name    : 'to',
    elements: []
  };

  if (year != null) to.elements.push(_buildTextElement('year', year));
  if (volume != null) to.elements.push(_buildTextElement('volume', volume));
  if (issue != null) to.elements.push(_buildTextElement('issue', issue));

  return to;
}

function _buildTextElement (name, text) {
  return {
    type    : 'element',
    name,
    elements: [
      {
        type: 'text',
        text
      }
    ]
  };
}
