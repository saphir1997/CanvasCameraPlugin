#import <UIKit/UIKit.h>
#import <GLKit/GLKit.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <QuartzCore/QuartzCore.h>
#import <CoreImage/CoreImage.h>
#import <ImageIO/ImageIO.h>

@interface CameraRenderController : UIViewController {
  GLuint _renderBuffer;
  CVOpenGLESTextureCacheRef _videoTextureCache;
  CVOpenGLESTextureRef _lumaTexture;
}

@property (nonatomic) CIContext *ciContext;
@property (nonatomic) CIImage *latestFrame;
@property (nonatomic) EAGLContext *context;
@property (nonatomic) NSLock *renderLock;

- (void)drawImage:(CIImage *)image;
- (CGRect)updateFrameSize:(CGRect)rectDimensions respectBoundaries:(CGRect)boundaries aspectRatio:(CGFloat)targetAspectRatio;
+ (CGSize)calculateAspectRatio:(CGSize)origSize targetSize:(CGSize)targetSize;

@end
