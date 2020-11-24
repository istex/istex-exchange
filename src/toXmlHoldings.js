'use strict';

const convert        = require('xml-js'),
      {xmlHoldings}  = require('config-component').get(module),
      {model}        = require('./reviewModel')
;

/*
 * @see https://github.com/istex/istex-google-scholar
 * @note For some reasons you can't use {spaces} on xmlHoldings creation without puting standalone="no"
 * @see https://stackoverflow.com/questions/58996045/internal-dtd-validation-using-notepad
 */
module.exports.toXmlHoldings = function({spaces, dtd} = {}) {

  return function(s) {
    let isFirst = true;
    return s.map((exchangeData) => {
              let prepend = '';
              if (isFirst) {
                isFirst = false;
                prepend = _getXmlHoldingsStart({dtd});
              }
              return `${prepend}${_exchangeDataToJsNonCompact(exchangeData, {spaces})}`;
            })
            .append(_getXmlHoldingsEnd())
      ;
  };
};

function _getXmlHoldingsStart ({dtd = xmlHoldings.dtd} = {}) {
  const prolog       = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                       + `<!DOCTYPE institutional_holdings PUBLIC "-//GOOGLE//Institutional Holdings 1.0//EN" "${dtd}">`,
        rootStartTag = '<institutional_holdings>';

  return prolog + rootStartTag;
}

function _getXmlHoldingsEnd(){
  const rootEndTag = '</institutional_holdings>';

  return rootEndTag;
}

function _exchangeDataToJsNonCompact ({
                                        coverages,
                                        reviewData: {[model.title]: title, [model.issn]: issn, [model.isbn]: isbn}
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

  coverages
    .forEach(({date_first_issue_online, ...rest}) => {
      // the element <from><year> is mandatory
      if (!date_first_issue_online) return;

      const coverage = {
        type    : 'element',
        name    : 'coverage',
        elements: []
      };

      coverage.elements.push(_buildFrom({date_first_issue_online, ...rest}));

      if (_coverageContainsToValue({...rest})) coverage.elements.push(_buildTo({...rest}));

      item.elements.push(coverage);
    });

  root.elements.push(item);

  return convert.js2xml(root, js2xmlOptions);
}

function _buildFrom ({
                       num_first_issue_online : issue,
                       num_first_vol_online   : volume,
                       date_first_issue_online: year
                     }) {
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


function _buildTo ({
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
