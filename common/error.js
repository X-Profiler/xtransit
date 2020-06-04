'use strict';

class Parser {
  constructor(errexp, limit) {
    this.list = [];
    this.current = null;
    this.pending = '';
    this.limit = limit || 0;
    this.errexp = errexp;
  }

  expect(line, startWith) {
    return line.trim().includes(startWith);
  }

  execute(data) {
    this.pending += data;
    let index = this.pending.indexOf('\n');
    while (index !== -1) {
      const line = this.pending.slice(0, index);
      this.parse(line);
      this.pending = this.pending.slice(index + 1);
      index = this.pending.indexOf('\n');
    }
  }

  pushLog() {
    if (this.current) {
      this.list.push(this.current);
      if (this.limit > 0 && this.limit < this.list.length) {
        this.list.shift();
      }
    }
    this.current = null;
  }

  parse(line) {
    if (line.match(this.errexp)) { // error start
      this.pushLog();
      this.current = { stack: '', type: '', extra: '' };
      this.current.stack = line + '\n';
      const match = line.match(/([A-z]*Error)[:]? /);
      this.current.type = match && match[1] || 'Error';
      this.current.timestamp = Date.now();
    } else if (this.expect(line, 'at ')) {
      if (this.current) {
        this.current.stack += this.current.extra + line + '\n';
        this.current.extra = '';
      }
    } else if (line === '') {
      if (this.current) {
        this.current.extra + '\n';
      }
    } else {
      if (this.current) {
        this.current.extra += line + '\n';
      }
    }
  }

  parseStream(readable) {
    return new Promise((resolve, reject) => {
      let cleanup;

      const onData = data => {
        this.execute(data);
      };

      const onEnd = () => {
        cleanup();
        if (this.current && this.current.extra) {
          this.pushLog();
        }
        resolve(this.list);
        this.list = [];
      };

      /* istanbul ignore next */
      const onError = err => {
        cleanup();
        reject(err);
      };

      cleanup = function() {
        readable.removeListener('data', onData);
        readable.removeListener('end', onEnd);
        readable.removeListener('error', onError);
      };

      readable.on('data', onData);
      readable.on('end', onEnd);
      readable.on('error', onError);
    });
  }
}

module.exports = Parser;
