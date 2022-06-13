/**
* CanvasCamera.js
* PhoneGap iOS and Android Cordova Plugin to capture Camera streaming into an
* HTML5 Canvas.
*
* VirtuoWorks <contact@virtuoworks.com>.
*
* MIT License
*
* Default user options :
*  {
*    width: 352,
*    height: 288,
*    canvas: {
*      width: 352,
*      height: 288
*    },
*    capture: {
*      width: 352,
*      height: 288
*    },
*    fps: 30,
*    use: 'file',
*    flashMode: false,
*    hasThumbnail: true,
*    thumbnailRatio: 1/6,
*    cameraFacing: 'front'
*  }
**/
'use strict';

/* eslint no-var: 0 */

var exec = require('cordova/exec');

window.requestAnimationFrame = window.requestAnimationFrame ||
                               window.mozRequestAnimationFrame ||
                               window.webkitRequestAnimationFrame ||
                               window.msRequestAnimationFrame;

var CanvasCamera = function() {
  this.canvas = {};
  this.options = {};
  this.onCapture = null;
  this.currentFlashMode = false;
  this.nativeClass = 'CanvasCamera';
};

CanvasCamera.prototype.dispatch = (function() {
  var events = [
    'beforeFrameRendering',
    'afterFrameRendering',
    'beforeFrameInitialization',
    'afterFrameInitialization',
    'beforeRenderingPresets',
    'afterRenderingPresets',
  ];

  events.forEach(function(eventName) {
    CanvasCamera.prototype[eventName] = function(listener) {
      var listenerName = (this.nativeClass + '-' + eventName).toLowerCase();
      window.addEventListener(listenerName, function(e) {
        listener.call(e.detail.caller, e, e.detail.data, this);
      }.bind(this));
    };
  });

  return function(eventName, caller, data) {
    var listenerName = (this.nativeClass + '-' + eventName).toLowerCase();
    var event = new CustomEvent(listenerName, {
      detail: {
        caller: caller,
        data: data || {},
      },
    });
    window.dispatchEvent(event);
  };
}());

CanvasCamera.prototype.createFrame = (function(image, element, renderer) {
  CanvasCamera.Frame = function(image, element, renderer) {
    this.sx = 0;
    this.sy = 0;
    this.sWidth = 0;
    this.sHeight = 0;
    this.dx = 0;
    this.dy = 0;
    this.dWidth = 0;
    this.dHeight = 0;

    this.image = image || null;
    this.element = element || null;
    this.renderer = renderer || null;
  };

  CanvasCamera.Frame.prototype.initialize = function() {
    if (this.image && this.element) {
      this.renderer.canvasCamera.dispatch('beforeframeinitialization', this);

      let difference = this.renderer.canvasCamera.getRotationDifference(this.renderer.rotation);
      let isOrthogonal = (!(difference % 180 === 0)); // If orthogonal to the window orientation

      // The X coordinate of the top left corner of the sub-rectangle of the
      // source image to draw into the destination context.
      this.sx = 0;
      // The Y coordinate of the top left corner of the sub-rectangle of the
      // source image to draw into the destination context.
      this.sy = 0;
      // The width of the sub-rectangle of the source image to draw into the
      // destination context. If not specified, the entire rectangle from the
      // coordinates specified by sx and sy to the bottom-right corner of the
      // image is used.
      this.sWidth = parseFloat(this.image.width);
      // The height of the sub-rectangle of the source image to draw into the
      // destination context.
      this.sHeight = parseFloat(this.image.height);
      // The X coordinate in the destination canvas at which to place the
      // top-left corner of the source image.
      this.dx = 0;
      // The Y coordinate in the destination canvas at which to place the
      // top-left corner of the source image.
      this.dy = 0;
      // The width to draw the image in the destination canvas. This allows
      // scaling of the drawn image. If not specified, the image is not scaled
      // in width when drawn.
      this.dWidth = parseFloat((isOrthogonal) ? this.element.height : this.element.width); // Swap when orthogonal
      // The height to draw the image in the destination canvas. This allows
      // scaling of the drawn image. If not specified, the image is not scaled
      // in height when drawn.
      this.dHeight = parseFloat((isOrthogonal) ? this.element.width : this.element.height); // Swap when orthogonal

      var hRatio = this.dWidth / this.sWidth;
      var vRatio = this.dHeight / this.sHeight;
      this.ratio = Math.max(hRatio, vRatio);

      this.dx = (this.dWidth - this.sWidth * this.ratio) / 2;
      this.dy = (this.dHeight - this.sHeight * this.ratio) / 2;

      this.dWidth = this.sWidth * this.ratio;
      this.dHeight = this.sHeight * this.ratio;

      this.renderer.canvasCamera.dispatch('afterframeinitialization', this);
    }

    return this;
  };

  CanvasCamera.Frame.prototype.recycle = function() {
    for (var property in this) {
      if (this.hasOwnProperty(property)) {
        delete this[property];
      }
    }
  };

  var frame = function(image, element, renderer) {
    return new CanvasCamera.Frame(image, element, renderer);
  };

  return function(image, element, renderer) {
    return frame(image, element, renderer).initialize();
  };
}());

CanvasCamera.prototype.createRenderer = (function(element, canvasCamera) {
  CanvasCamera.Renderer = function(element, canvasCamera) {
    this.initProperties = function(element, canvasCamera) {
      this.data = null;
      this.size = null;
      this.image = null;
      this.context = null;
      this.orientation = null;
      this.rotation = null;
  
      this.buffer = [];
  
      this.available = true;
      this.fullscreen = false;
      this.drawOffscreen = false;
  
      this.element = element || null;
      this.canvasCamera = canvasCamera || null;
  
      this.onAfterDraw = null;
      this.onBeforeDraw = null;
  
      this.drawFunction = null;
      this.handleError = null;
      this.handleOrientationChange = null;
    }.bind(this);
    this.initProperties(element, canvasCamera);
  };

  CanvasCamera.Renderer.prototype.initialize = function() {
    if (this.element) {
      this.context = this.element.getContext('2d');

      this.image = new Image();
      this.image.crossOrigin = 'Anonymous';

      this.drawFunction = function(event) {
        var frame = this.canvasCamera.createFrame(
            this.image,
            this.element,
            this
        );

        this.resize().clear();
        if (this.onBeforeDraw) {
          this.onBeforeDraw(frame);
        }
        this.draw(frame);
        if (this.onAfterDraw) {
          this.onAfterDraw(frame);
        }

        frame.recycle();
        frame = null;

        this.enable();
      }.bind(this);
      this.image.addEventListener('load', this.drawFunction);

      this.handleError = function(event) {
        this.clear().enable();
      }.bind(this);
      this.image.addEventListener('error', this.handleError);

      this.handleOrientationChange = function(event) {
        this.onOrientationChange();
        this.drawFunction();
      }.bind(this);
      window.addEventListener('orientationchange', this.handleOrientationChange);
    }
    return this;
  };

  CanvasCamera.Renderer.prototype.getCanvasOrientation = function() {
    if (this.element) {
      if (this.element.width > this.element.height) {
        return 'landscape';
      }
    }
    return 'portrait';
  };

  CanvasCamera.Renderer.prototype.onOrientationChange = function() {
    if (this.canvasCamera.getUIOrientation() !== this.getCanvasOrientation()) {
      this.invert();
      this.canvasCamera.flashMode(this.canvasCamera.currentFlashMode); //Set the flash mode again after turning, because it turns off on configuration change
    }
    this.buffer = [];
  };

  CanvasCamera.Renderer.prototype.clear = function() {
    this.context.clearRect(0, 0, this.element.width, this.element.height);

    return this;
  };

  CanvasCamera.Renderer.prototype.draw = function(frame) {
    this.canvasCamera.dispatch('beforeframerendering', this, frame);

    if (frame) {
      let degrees = this.canvasCamera.getRotationDifference(this.rotation);
      if (degrees != 0) { // Needs to be rotated
        let angle = degrees * (Math.PI / 180.0);
        this.context.setTransform(1, 0, 0, 1, this.element.width/2, this.element.height/2);
        this.context.rotate(angle);

        // Move center to the middle of the destination
        frame.dx -= (frame.dWidth / 2);
        frame.dy -= (frame.dHeight / 2);
      } else {
        this.context.setTransform(1, 0, 0, 1, 0, 0); // Reset the whole transformation matrix
      }

      this.context.drawImage(
          frame.image,
          frame.sx,
          frame.sy,
          frame.sWidth,
          frame.sHeight,
          frame.dx,
          frame.dy,
          frame.dWidth,
          frame.dHeight
      );
    }

    this.canvasCamera.dispatch('afterframerendering', this, frame);

    return this;
  };

  CanvasCamera.Renderer.prototype.bufferize = function(data) {
    if (this.enabled()) {
      this.buffer.push(data);
      this.run();
    }

    return this;
  };

  CanvasCamera.Renderer.prototype.run = function() {
    if (this.enabled()) {
      window.requestAnimationFrame(function(timestamp) {
        if (this.buffer.length) {
          this.render(this.buffer.pop());
          this.buffer = [];
        }
      }.bind(this));
    }

    return this;
  };

  CanvasCamera.Renderer.prototype.render = function(data) {
    if (this.enabled()) {
      if (this.canvasCamera &&
        this.canvasCamera.options &&
        this.canvasCamera.options.use) {
        if (data && data[this.canvasCamera.options.use]) {
          this.data = data;
          if (data.hasOwnProperty('orientation') && data.orientation) {
            this.orientation = data.orientation;
          }
          if (data.hasOwnProperty('rotation') && data.rotation) {
            this.rotation = data.rotation;
          }

          if (this.image) {
            // type can be 'data' or 'file'
            switch (this.canvasCamera.options.use) {
              case 'file':
                // If we are using cordova-plugin-ionic-webview plugin which
                // replaces the default UIWebView with WKWebView.
                if (window.Ionic &&
                    window.Ionic.WebView &&
                    window.Ionic.WebView.convertFileSrc) {
                  data[
                      this.canvasCamera.options.use
                  ] = window.Ionic.WebView.convertFileSrc(data[
                      this.canvasCamera.options.use
                  ]);
                }
                // add a random seed to prevent browser caching.
                this.image.src = data[
                    this.canvasCamera.options.use
                ] + '?seed=' +
                Math.round((new Date()).getTime() * Math.random() * 1000);
                break;
              default:
                this.image.src = data[this.canvasCamera.options.use];
            }
          }

          this.disable();
        }
      }
    }

    return this;
  };

  CanvasCamera.Renderer.prototype.enable = function() {
    this.available = true;

    return this;
  };

  CanvasCamera.Renderer.prototype.disable = function() {
    this.available = false;

    return this;
  };

  CanvasCamera.Renderer.prototype.invalidate = function() {
    if (this.image != null) {
      this.image.removeEventListener('load', this.drawFunction);
      this.image.removeEventListener('error', this.handleError);
    }

    window.removeEventListener('orientationchange', this.handleOrientationChange);

    this.initProperties(null, null); //Reset all properties to free resources

    return this;
  };

  CanvasCamera.Renderer.prototype.enabled = function() {
    return this.available;
  };

  CanvasCamera.Renderer.prototype.disabled = function() {
    return !this.available;
  };

  CanvasCamera.Renderer.prototype.invert = function() {
    if (this.size) {
      var iSize = {};
      if (this.size.width && !isNaN(this.size.width)) {
        if (this.fullscreen) {
          iSize.width = parseFloat(window.innerHeight);
        } else {
          if (this.canvasCamera.options.drawOffscreen || parseFloat(this.size.height) <= parseFloat(window.innerHeight)) {
            iSize.width = parseFloat(this.size.height);
          } else {
            iSize.width = parseFloat(window.innerHeight);
          }
        }
      }
      if (this.size.height && !isNaN(this.size.height)) {
        if (this.fullscreen) {
          iSize.height = parseFloat(window.innerWidth);
        } else {
          if (this.canvasCamera.options.drawOffscreen || parseFloat(this.size.width) <= parseFloat(window.innerWidth)) {
            iSize.height = parseFloat(this.size.width);
          } else {
            iSize.height = parseFloat(window.innerWidth);
          }
        }
      }
      this.size = iSize;
    }

    return this;
  };

  CanvasCamera.Renderer.prototype.resize = function() {
    if (this.size) {
      var pixelRatio = this.canvasCamera.options.drawOffscreen ? 1 : (window.devicePixelRatio || 1);
      if (this.size.width && !isNaN(this.size.width)) {
        if (this.canvasCamera.options.drawOffscreen || (!this.fullscreen &&
            parseFloat(this.size.width) <= parseFloat(window.innerWidth))) {
          this.element.width = parseFloat(this.size.width * pixelRatio);
          this.element.style.width = parseFloat(this.size.width) + 'px';
        } else {
          this.element.width = parseFloat(window.innerWidth * pixelRatio);
          this.element.style.width = parseFloat(window.innerWidth) + 'px';
        }
      } else {
        this.element.width = parseFloat(window.innerWidth * pixelRatio);
        this.element.style.width = parseFloat(window.innerWidth) + 'px';
      }
      if (this.size.height && !isNaN(this.size.height)) {
        if (this.canvasCamera.options.drawOffscreen || (!this.fullscreen &&
            parseFloat(this.size.height) <= parseFloat(window.innerHeight))) {
          this.element.height = parseFloat(this.size.height * pixelRatio);
          this.element.style.height = parseFloat(this.size.height) + 'px';
        } else {
          this.element.height = parseFloat(window.innerHeight * pixelRatio);
          this.element.style.height = parseFloat(window.innerHeight) + 'px';
        }
      } else {
        this.element.height = parseFloat(window.innerHeight * pixelRatio);
        this.element.style.height = parseFloat(window.innerHeight) + 'px';
      }
    }

    return this;
  };

  CanvasCamera.Renderer.prototype.setSize = function(size, auto) {
    this.fullscreen = !!auto || false;
    if (size && size.width && size.height) {
      if (!isNaN(parseFloat(size.width)) && !isNaN(parseFloat(size.height))) {
        this.size = size;
        if (!this.canvasCamera.options.drawOffscreen && !this.fullscreen) {
          // If size is higher than windows size, set size to fullscreen.
          if (parseFloat(size.width) >= parseFloat(window.innerWidth) &&
              parseFloat(size.height) >= parseFloat(window.innerHeight)) {
            this.fullscreen = true;
          }
        }
      }
    }

    return this;
  };

  CanvasCamera.Renderer.prototype.setOnBeforeDraw = function(onBeforeDraw) {
    if (onBeforeDraw && typeof onBeforeDraw === 'function') {
      this.onBeforeDraw = onBeforeDraw;
    }

    return this;
  };

  CanvasCamera.Renderer.prototype.setOnAfterDraw = function(onAfterDraw) {
    if (onAfterDraw && typeof onAfterDraw === 'function') {
      this.onAfterDraw = onAfterDraw;
    }

    return this;
  };

  var renderer = function(element, canvasCamera) {
    return new CanvasCamera.Renderer(element, canvasCamera);
  };

  return function(element, canvasCamera) {
    return renderer(element, canvasCamera).initialize();
  };
}());

CanvasCamera.prototype.initialize = function(fcanvas, tcanvas) {
  if (fcanvas && fcanvas.getContext) {
    this.canvas.fullsize = this.createRenderer(fcanvas, this);
  } else if (fcanvas && fcanvas.fullsize && fcanvas.fullsize.getContext) {
    this.canvas.fullsize = this.createRenderer(fcanvas.fullsize, this);
  }

  if (tcanvas && tcanvas.getContext) {
    this.canvas.thumbnail = this.createRenderer(tcanvas, this);
  } else if (fcanvas && fcanvas.thumbnail && fcanvas.thumbnail.getContext) {
    this.canvas.thumbnail = this.createRenderer(fcanvas.thumbnail, this);
  }
};

CanvasCamera.prototype.start = function(userOptions, onError, onSuccess) {
  this.options = userOptions;
  this.setRenderingPresets();
  if (userOptions != null) {
    this.currentFlashMode = userOptions.flashMode || false;
  }

  if (onSuccess && typeof onSuccess === 'function') {
    this.onCapture = onSuccess;
  }

  this.enableRenderers();
  exec(this.capture.bind(this), function(error) {
    this.disableRenderers();
    if (onError && typeof onError === 'function') {
      onError(error);
    }
  }.bind(this), this.nativeClass, 'startCapture', [this.options]);
};

CanvasCamera.prototype.stop = function(onError, onSuccess) {
  this.disableRenderers();
  this.invalidateRenderers();
  this.currentFlashMode = false; //Turn off flash after finishing recording
  exec(function(data) {
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(data);
    }
  }, function(error) {
    if (onError && typeof onError === 'function') {
      onError(error);
    }
  }, this.nativeClass, 'stopCapture', []);
};

CanvasCamera.prototype.startVideoRecording = function(onError, onSuccess) {
  exec(function(data) {
    if (onSuccess && typeof onSuccess === 'function') {
      let videoURL;
      //Set the URL in the correct format, if we are in ionic
      if (data != null && data.output != null && data.output.video != null) {
        videoURL = data.output.video;
        // If we are using cordova-plugin-ionic-webview plugin which
        // replaces the default UIWebView with WKWebView.
        if (window.Ionic &&
          window.Ionic.WebView &&
          window.Ionic.WebView.convertFileSrc) {
            videoURL = window.Ionic.WebView.convertFileSrc(videoURL);
        }
        // add a random seed to prevent browser caching.
        videoURL = videoURL + '?seed=' + Math.round((new Date()).getTime() * Math.random() * 1000);
      }
      onSuccess({...data, videoURL});
    }
  }, function(error) {
    if (onError && typeof onError === 'function') {
      onError(error);
    }
  }, this.nativeClass, 'startVideoRecording', []);
};

CanvasCamera.prototype.stopVideoRecording = function(onError, onSuccess) {
  exec(function(data) {
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(data);
    }
  }, function(error) {
    if (onError && typeof onError === 'function') {
      onError(error);
    }
  }, this.nativeClass, 'stopVideoRecording', []);
};


CanvasCamera.prototype.requestSingleFullsize = function(onError, onSuccess) {
  exec(function(data) {
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(data);
    }
  }, function(error) {
    if (onError && typeof onError === 'function') {
      onError(error);
    }
  }, this.nativeClass, 'requestSingleFullsize', []);
};

CanvasCamera.prototype.flashMode = function(flashMode, onError, onSuccess) {
  this.currentFlashMode = flashMode;
  exec(function(data) {
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(data);
    }
  }, function(error) {
    if (onError && typeof onError === 'function') {
      onError(error);
    }
  }, this.nativeClass, 'flashMode', [flashMode]);
};

CanvasCamera.prototype.cameraPosition = function(
    cameraFacing,
    onError,
    onSuccess
) {
  this.disableRenderers();
  exec(function(data) {
    this.enableRenderers();
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(data);
    }
  }.bind(this), function(error) {
    if (onError && typeof onError === 'function') {
      onError(error);
    }
  }, this.nativeClass, 'cameraPosition', [cameraFacing]);
};

CanvasCamera.prototype.capture = function(data) {
  if (data && data.output && data.output.images) {
    if (data.output.images.fullsize &&
        data.output.images.fullsize[this.options.use]) {
      if (this.canvas.fullsize) {
        this.canvas.fullsize.bufferize(data.output.images.fullsize);
      }
    }
    if (data.output.images.thumbnail &&
      data.output.images.thumbnail[this.options.use]) {
      if (this.canvas.thumbnail) {
        this.canvas.thumbnail.bufferize(data.output.images.thumbnail);
      }
    }
  }

  if (this.onCapture && typeof this.onCapture === 'function') {
    this.onCapture(data);
  }
};

CanvasCamera.prototype.enableRenderers = function() {
  if (this.canvas && typeof this.canvas === 'object') {
    for (var renderer in this.canvas) {
      if (this.canvas.hasOwnProperty(renderer)) {
        if (this.canvas[renderer].disabled()) {
          this.canvas[renderer].enable();
        }
      }
    }
  }
};

CanvasCamera.prototype.disableRenderers = function() {
  if (this.canvas && typeof this.canvas === 'object') {
    for (var renderer in this.canvas) {
      if (this.canvas.hasOwnProperty(renderer)) {
        if (this.canvas[renderer].enabled()) {
          this.canvas[renderer].disable();
        }
      }
    }
  }
};

CanvasCamera.prototype.invalidateRenderers = function() {
  if (this.canvas && typeof this.canvas === 'object') {
    for (var renderer in this.canvas) {
      if (this.canvas.hasOwnProperty(renderer)) {
        this.canvas[renderer].invalidate();
      }
    }
  }
};

CanvasCamera.prototype.setRenderingPresets = function() {
  this.dispatch('beforerenderingpresets', this);

  switch (this.options.use) {
    case 'data':
    case 'file':
      break;
    default:
      this.options.use = 'file';
  }

  if (this.options.onBeforeDraw &&
    typeof this.options.onBeforeDraw === 'function') {
    if (this.canvas.fullsize) {
      this.canvas.fullsize.setOnBeforeDraw(this.options.onBeforeDraw);
    } else if (this.canvas.thumbnail) {
      this.canvas.thumbnail.setOnBeforeDraw(this.options.onBeforeDraw);
    }
  }

  if (this.options.onAfterDraw &&
    typeof this.options.onAfterDraw === 'function') {
    if (this.canvas.fullsize) {
      this.canvas.fullsize.setOnAfterDraw(this.options.onAfterDraw);
    } else if (this.canvas.thumbnail) {
      this.canvas.thumbnail.setOnAfterDraw(this.options.onAfterDraw);
    }
  }

  var size = this.getUISize();
  this.setRenderersSize(size);

  this.dispatch('afterrenderingpresets', this);

  return this;
};

CanvasCamera.prototype.getUISize = function() {
  var size = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  if (this.options) {
    var canvasWidth;
    var canvasHeight;
    // Check if canvas height and width are set.
    if (this.options.canvas) {
      if (this.options.canvas.width && this.options.canvas.height) {
        canvasWidth = parseFloat(this.options.canvas.width);
        canvasHeight = parseFloat(this.options.canvas.height);
      }
    }
    // Check if capture and canvas height and width are set.
    if (this.options.width && this.options.height) {
      canvasWidth = parseFloat(this.options.width);
      canvasHeight = parseFloat(this.options.height);
    }
    // Assign height and width to UI size object.
    if (!isNaN(canvasWidth) && !isNaN(canvasHeight)) {
      size.auto = false;
      if (this.getUIOrientation() === 'portrait') {
        size.width = canvasHeight;
        size.height = canvasWidth;
      } else {
        size.width = canvasWidth;
        size.height = canvasHeight;
      }
    }
  }

  return size;
};

CanvasCamera.prototype.getUIOrientation = function() {
  if (isNaN(window.orientation)) {
    return 'landscape';
  } else {
    if (window.orientation % 180 === 0) {
      return 'portrait';
    } else {
      return 'landscape';
    }
  }
};

CanvasCamera.prototype.getRotationDifference = function(rotation) {
  if (isNaN(window.orientation)) {
    return 0;
  } else {
    let difference = (rotation - window.orientation) % 360;
    // Treat angles above 180 as negative angles in the opposite direction
    if (difference > 180) {
      return (-360 + difference);
    } else if (difference < -180) {
      return (360 + difference);
    } else {
      return difference;
    }
  }
};

CanvasCamera.prototype.setRenderersSize = function(size) {
  if (size.width && size.height) {
    if (this.canvas.fullsize || this.canvas.thumbnail) {
      var canvasWidth = parseFloat(size.width);
      var canvasHeight = parseFloat(size.height);
      if (!isNaN(canvasWidth) && !isNaN(canvasHeight)) {
        if (this.canvas.fullsize) {
          this.options.disableFullsize = false;
          this.canvas.fullsize.setSize({
            width: canvasWidth,
            height: canvasHeight,
          }, size.auto);
        } else {
          this.options.disableFullsize = true;
        }
        if (this.canvas.thumbnail) {
          var thumbnailRatio;
          if (this.options.thumbnailRatio) {
            thumbnailRatio = parseFloat(this.options.thumbnailRatio);
          }
          if (isNaN(thumbnailRatio)) {
            thumbnailRatio = 1/6;
            this.options.thumbnailRatio = 1/6;
          }
          this.options.hasThumbnail = true;
          this.canvas.thumbnail.setSize({
            width: canvasWidth * thumbnailRatio,
            height: canvasHeight * thumbnailRatio,
          });
        }
      }
    }
  }

  return this;
};

module.exports = new CanvasCamera();
