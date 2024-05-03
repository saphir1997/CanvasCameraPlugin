/**
 * CanvasCamera.js
 * PhoneGap iOS and Android Cordova Plugin to capture Camera streaming into an HTML5 Canvas.
 *
 * VirtuoWorks <contact@virtuoworks.com>.
 *
 * MIT License
 */

#import <Cordova/CDVPlugin.h>
#import <objc/message.h>
#import <UIKit/UIKit.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <AVFoundation/AVFoundation.h>
#import <ImageIO/ImageIO.h>
#import <AssetsLibrary/AssetsLibrary.h>

#import "CameraRenderController.h"

#pragma mark - CanvasCamera Public Constants

static NSString *const CCUseKey                         = @"use";
static NSString *const CCFpsKey                         = @"fps";
static NSString *const CCXOffsetKey                     = @"x";
static NSString *const CCYOffsetKey                     = @"y";
static NSString *const CCWidthKey                       = @"width";
static NSString *const CCHeightKey                      = @"height";
static NSString *const CCCanvasKey                      = @"canvas";
static NSString *const CCCaptureKey                     = @"capture";
static NSString *const CCPreviewKey                     = @"preview";
static NSString *const CCFlashModeKey                   = @"flashMode";
static NSString *const CCHasThumbnailKey                = @"hasThumbnail";
static NSString *const CCGenerateOutputOnlyOnRequestKey = @"generateOutputOnlyOnRequest";
static NSString *const CCDisableFullsizeKey             = @"disableFullsize";
static NSString *const CCThumbnailRatioKey              = @"thumbnailRatio";
static NSString *const CCLensOrientationKey             = @"cameraFacing";

static NSString *const CCFocusModeKey                   = @"focusMode";
static NSString *const CCFocusDistanceKey               = @"focusDistance";

#pragma mark - CanvasCamera Public Interface

@interface CanvasCamera : CDVPlugin <AVCaptureVideoDataOutputSampleBufferDelegate>

// Public Access
@property (readwrite, strong) NSString *use;
@property (readwrite, assign) NSInteger fps;
@property (readwrite, assign) CMTime firstFrameTime;
@property (readwrite, assign) NSInteger width;
@property (readwrite, assign) NSInteger height;
@property (readwrite, assign) NSInteger canvasHeight;
@property (readwrite, assign) NSInteger canvasWidth;
@property (readwrite, assign) NSInteger captureHeight;
@property (readwrite, assign) NSInteger captureWidth;
@property (readwrite, assign) CGFloat previewXOffset;
@property (readwrite, assign) CGFloat previewYOffset;
@property (readwrite, assign) CGFloat previewWidth;
@property (readwrite, assign) CGFloat previewHeight;

@property (readwrite, assign) BOOL hasThumbnail;
@property (readwrite, assign) BOOL generateOutputOnlyOnRequest;
@property (readwrite, assign) BOOL disableFullsize;
@property (readwrite, assign) CGFloat thumbnailRatio;

@property (readwrite, assign) AVCaptureDevicePosition devicePosition;

@property (readwrite, assign) BOOL isPreviewing;
@property (readwrite, assign) BOOL isProcessingPreview;
@property (readwrite, assign) BOOL isRecording;
@property (readwrite, assign) BOOL captureFullsizeOnce;
@property (readwrite, assign) BOOL captureThumbnailOnce;

@property (readwrite, assign) UIInterfaceOrientation recordingOrientation;
@property (readwrite, assign) CVPixelBufferRef pixelBuffer;

- (void)startCapture:(CDVInvokedUrlCommand *)command;
- (void)stopCapture:(CDVInvokedUrlCommand *)command;
- (void)startVideoRecording:(CDVInvokedUrlCommand *)command;
- (void)stopVideoRecording:(CDVInvokedUrlCommand *)command;
- (void)requestSingleFullsize:(CDVInvokedUrlCommand *)command;
- (void)requestSingleThumbnail:(CDVInvokedUrlCommand *)command;
- (void)flashMode:(CDVInvokedUrlCommand *)command;
- (void)cameraPosition:(CDVInvokedUrlCommand *)command;
- (void)setZoom:(CDVInvokedUrlCommand *)command;
- (void)setFocus:(CDVInvokedUrlCommand *)command;
- (void)setExposureCompensation:(CDVInvokedUrlCommand *)command;
- (void)setPointOfInterest:(CDVInvokedUrlCommand *)command;
- (void)setPreviewFrame:(CDVInvokedUrlCommand *)command;

- (NSString *)filenameSuffix;

@property (nonatomic) CameraRenderController *cameraRenderController;

@end

