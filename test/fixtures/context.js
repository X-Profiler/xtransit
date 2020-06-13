'use strict';

let errorText = '';
const baseContext = {
  logger: {
    error(message) {
      errorText = message;
    },
  },
};


exports = module.exports = baseContext;

exports.getErrorText = () => errorText;

exports.setErrorText = error => (errorText = error);
