/**
 * Module dependencies
 */

var Batch = require('batch');
var each = require('./each');
var path = require('path');
var type;

try {
  type = require('type-component');
} catch (e) {
  type = require('type');
}
var stack = require('./stack');
var set = require('./utils').set;

exports.map = function(input, concurrency, done) {
  var self = this;

  if (type(concurrency) === 'function') {
    done = concurrency;
    concurrency = undefined;
  };

  var inputType = type(input);
  var obj;
  if (inputType === 'object') obj = {}
  	else if (inputType === 'array') obj = [];
  	else return done(new Error('Incompatible type for `map`: '+ inputType + '. input = ' + input));

  var batch = new Batch;

  if (concurrency) batch.concurrency(concurrency);

  var reduce = indexOf(self.stack, function(helper) {
    if (helper.title === 'reduce' || helper.title === 'collect') return true;
  });

  var substack = ~reduce
    ? self.stack.slice(0, reduce)
    : self.stack;

  each(input, function(value, key) {
    batch.push(function(next) {
      var ctx = {stack: substack};
      ctx.__proto__ = self;
      stack.call(ctx, substack.slice(0), value, function(err, value) {
        if (err) return next(err);
        set([key], value, obj);
        next();
      });
    });
  });

  batch.end(function(err) {
    if (err) return done(err);

    // We're reduceing the results
    if (~reduce) {
      // Discard the stack that we've already executed
      shift(self.stack, reduce);
      return done(null, obj);
    };

    // Set it on the render
    self.set(self.path, obj);
    // Take control of the stack
    self.exit();
  });
};

exports.reduce =
exports.collect = function(input, done) {
  done(null, input);
};

exports.log = function(input, done) {
  console.log(this.path + '[' + this.title + ']', input);
  done(null, input);
};

exports.partial = function(input, partial, done) {
	var self = this;
	self.partialTemplates = [];
	
	if (!self.jsont) {
		self.jsont = require('./')();
	}
	
	var myPartial = path.normalize(partial);
	myPartial = path.resolve(myPartial);
	
	if (!self.partialTemplates[myPartial]) {
		var jsontReq = require(myPartial + ".json");
		self.partialTemplates[myPartial] = self.jsont.compile(jsontReq);
		delete self.jsont;
	}
	
	self.partialTemplates[myPartial](input, done);
};

function shift(arr, count) {
  for (var i = 0; i < count; ++i) {
    arr.shift();
  }
};

function indexOf(arr, fn) {
  for (var i = 0, len = arr.length; i < len; ++i) {
    if (fn(arr[i], i)) return i;
  }
  return -1;
};
