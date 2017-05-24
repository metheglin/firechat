"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FirstDamGate = function () {
  function FirstDamGate(fps) {
    _classCallCheck(this, FirstDamGate);

    this.opened = true;
    this.fps = fps;
    this.frameTime = 1000 / fps;
  }

  _createClass(FirstDamGate, [{
    key: "execute",
    value: function execute(f) {
      if (!this.opened) return;
      f();
      this.close();
      setTimeout(this.open.bind(this), this.frameTime);
    }
  }, {
    key: "open",
    value: function open() {
      this.opened = true;
    }
  }, {
    key: "close",
    value: function close() {
      this.opened = false;
    }
  }]);

  return FirstDamGate;
}();

var LastDamGate = function () {
  function LastDamGate(fps) {
    _classCallCheck(this, LastDamGate);

    this.opened = true;
    this.fps = fps;
    this.frameTime = 1000 / fps;
    this.threadCount = 0;
  }

  _createClass(LastDamGate, [{
    key: "execute",
    value: function execute(f) {
      if (this.threadCount > 0) {
        this.close();
      }
      this.threadCount++;
      setTimeout(function () {
        if (this.opened) {
          f();
        }
        this.threadCount--;
        if (this.threadCount <= 1) {
          this.open();
        }
      }.bind(this), this.frameTime);
    }
  }, {
    key: "open",
    value: function open() {
      this.opened = true;
    }
  }, {
    key: "close",
    value: function close() {
      this.opened = false;
    }
  }]);

  return LastDamGate;
}();