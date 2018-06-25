
const requireg = require('requireg');
const { cropLongData } = require('@kronoslive/codeceptjs-utils');

let mochawesome;
let utils;

let SwiftMock;

class Swift extends Helper {
  constructor(config) {
    super(config);
    SwiftMock = requireg('swift-mock');
    this._validateConfig(config);
  }

  _validateConfig(config) {
    this.options = {
      saveIncomingMessages: true,
      delete: true,
    };

    this.isRunning = false;
    this.isFinished = false;

    this.receivedMessages = {};

    // override defaults with config
    Object.assign(this.options, config);

    if (!this.options.in || !this.options.in) {
      throw new Error(`
        Swift requires at input folder and output folder to be set.
        Check your codeceptjs config file to ensure this is set properly
          {
            "helpers": {
              "Swift": {
                "in": "Input folder",
                "out": "Output folder"
              }
            }
          }
        `);
    }
  }

  // eslint-disable-next-line consistent-return
  static _checkRequirements() {
    try {
      requireg('swift-mock');
    } catch (e) {
      return ['swift-mock'];
    }
    // eslint-disable-next-line consistent-return
  }

  _beforeSuite(test, mochawesomeHelper) {
    mochawesome = mochawesomeHelper || this.helpers.Mochawesome;
    utils = this.helpers.Utils;
  }

  _runSwift() {
    if (this.isRunning) {
      return true;
    }
    if (this.isFinished) {
      return true;
    }
    this.swift = new SwiftMock(this.options);
    this.isRunning = true;

    return this.swift.run();
  }

  async sendSwiftMessage(data, filenamePrefix) {
    await this._runSwift();
    return this.swift.send(data, filenamePrefix);
  }

  async subscribeToSwiftMessage(predicate, callback, options = { logging: true }) {
    await this._runSwift();
    const loggingFn = (msg) => {
      if (options.logging) {
        mochawesome.addMochawesomeContext({
          title: 'Received Swift message',
          value: {
            body: msg,
          },
        });
      }

      return predicate(msg);
    };
    return this.swift.on(loggingFn, callback);
  }

  async expectSwiftMessageUntil(predicate, timeout) {
    await this._runSwift();
    const seen = {};
    let predicateErr;

    return utils.waitUntil(() => Promise.resolve((this.swift.getMessages() || [])
      .find((msg, i) => {
        try {
          if (!seen[i]) {
            seen[i] = true;
            return predicate(msg);
          }
          return false;
        } catch (err) {
          predicateErr = err;
          return true;
        }
      })), timeout, 'timeout', 100)
      .then(() => {
        if (predicateErr) {
          throw new Error(`predicate return err (${predicateErr.code}), but it should return boolean value`);
        }
        mochawesome.addMochawesomeContext({
          title: 'Wait swift message with predicate',
          value: predicate.toString(),
        });
        mochawesome.addMochawesomeContext({
          title: 'Latest swift message',
          value: cropLongData((this.swift.getMessages())[(this.swift.getMessages()).length - 1]),
        });
      }).catch((err) => {
        mochawesome.addMochawesomeContext({
          title: 'Wait swift message with predicate',
          value: predicate.toString(),
        });
        mochawesome.addMochawesomeContext({
          title: 'Latest swift message',
          value: cropLongData((this.swift.getMessages())[(this.swift.getMessages()).length - 1]),
        });
        if (err.message === 'timeout') {
          throw new Error(`swift timeout while expecting message with predicate${predicate.toString()}`);
        } else throw err;
      });
  }

  async dontExpectSwiftMessageUntil(predicate, timeout) {
    await this._runSwift();
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const found = (this.swift.getMessages() || []).find(predicate);

        if (found !== undefined) {
          reject(new Error(`Found some not expected: ${found}`));
        } else {
          resolve();
        }
      }, timeout);
    });
  }

  async _finishTest() {
    if (!this.isRunning) {
      return true;
    }

    this.isFinished = true;
    this.isRunning = false;

    return this.swift.watcher.close();
  }

  _failed() {

  }

  async _after() {
    if (!this.isRunning) {
      return true;
    }

    await this.swift.cleanListeners();
    await this.swift.cleanMessages();
    return true;
  }
}

module.exports = Swift;
