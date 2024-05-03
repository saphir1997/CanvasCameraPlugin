#import "CameraRenderController.h"
#import <CoreVideo/CVOpenGLESTextureCache.h>
#import <GLKit/GLKit.h>
#import <OpenGLES/ES2/glext.h>

//Inspired by https://github.com/cordova-plugin-camera-preview/cordova-plugin-camera-preview

#ifdef DEBUG
static BOOL const LOGGING                    = YES;
#else
static BOOL const LOGGING                    = NO;
#endif

@implementation CameraRenderController
@synthesize context = _context;

- (CameraRenderController *)init {
  if (self = [super init]) {
    self.renderLock = [[NSLock alloc] init];
  }
  return self;
}

- (void)loadView {
  GLKView *glkView = [[GLKView alloc] init];
  [glkView setBackgroundColor:[UIColor blackColor]];
  [self setView:glkView];
}

- (void)viewDidLoad {
  [super viewDidLoad];

  @try {
    self.context = [[EAGLContext alloc] initWithAPI:kEAGLRenderingAPIOpenGLES2];

    if (!self.context) {
      if (LOGGING) NSLog(@"[ERROR][CanvasCamera][initializeCameraRenderController]: Failed to create ES context");
    }

    CVReturn err = CVOpenGLESTextureCacheCreate(kCFAllocatorDefault, NULL, self.context, NULL, &_videoTextureCache);
    if (err) {
      if (LOGGING) NSLog(@"[ERROR][CanvasCamera][initializeCameraRenderController]: Error at CVOpenGLESTextureCacheCreate %d", err);
      return;
    }

    GLKView *view = (GLKView *)self.view;
    view.context = self.context;
    view.drawableDepthFormat = GLKViewDrawableDepthFormat24;
    view.contentMode = UIViewContentModeScaleToFill;

    glGenRenderbuffers(1, &_renderBuffer);
    glBindRenderbuffer(GL_RENDERBUFFER, _renderBuffer);

    self.ciContext = [CIContext contextWithEAGLContext:self.context];

    self.view.userInteractionEnabled = NO;
  } @catch (NSException *exception) {
    if (LOGGING) NSLog(@"[ERROR][CanvasCamera][initializeCameraRenderController]: %@", exception.reason);
  }

  if (LOGGING) NSLog(@"[DEBUG][CanvasCamera][initializeCameraRenderController]: Successfully initialized CameraRenderController!");
}

-(void)drawImage:(CIImage *)ciImage {
  __block CIImage *image = ciImage;

  dispatch_block_t block = ^{
    if ([self.renderLock tryLock]) {
      CGSize imageSize = image.extent.size;
      CGSize frameSize = self.view.frame.size;
      CGSize scaledSizeAspect = [CameraRenderController calculateAspectRatio:imageSize targetSize:frameSize];

      //Scale pixels to points for non native resolutions
      CGFloat pointScale;
      UIScreen *windowScreen;

      //Get the displaying screen using new methods or old fallback
      if (@available(iOS 13.0, *)) {
        UIWindow *firstWindow = [[[UIApplication sharedApplication] windows] firstObject];
        if (firstWindow != nil) {
          UIWindowScene *windowScene = firstWindow.windowScene;
          if (windowScene != nil){
            windowScreen = windowScene.screen;
          }
        }
      } 
      
      //Fallback to deprecated method
      if (windowScreen == nil) {
        windowScreen = [UIScreen mainScreen];
      }

      if ([windowScreen respondsToSelector:@selector(nativeScale)]) {
        pointScale = [windowScreen nativeScale];
      } else {
        pointScale = [windowScreen scale];
      }
      
      // Calculate the offset to center the image in the target rect
      CGFloat offsetX = (frameSize.width - scaledSizeAspect.width) / 2;
      CGFloat offsetY = (frameSize.height - scaledSizeAspect.height) / 2;

      self.latestFrame = image;
      
      //Define the target rect using the pointScale to draw in correct size
      CGRect dest = CGRectMake(offsetX * pointScale, offsetY * pointScale, scaledSizeAspect.width * pointScale, scaledSizeAspect.height * pointScale);

      [self.ciContext drawImage:image inRect:dest fromRect:[image extent]]; //This method automatically scales image to fit in the specified containing inRect
      [self.context presentRenderbuffer:GL_RENDERBUFFER];
      [(GLKView *)(self.view)display];
      
      //Release image
      image = nil;
      [self.renderLock unlock];
    }
  };
  
  //Ensure to always run in main thread, if not in main thread, dispatch, otherwise run directly to not cause deadlock
  if ([NSThread isMainThread]) {
      block();
  } else {
      dispatch_async(dispatch_get_main_queue(), block);
  }
}

- (CGRect)updateFrameSize:(CGRect) rectDimensions respectBoundaries:(CGRect) boundaries aspectRatio:(CGFloat) targetAspectRatio {
  //Adjust the rect to be bigger than 0!
  CGSize adjustedSize = CGSizeMake(
                                  (rectDimensions.size.width > 0.0) ? rectDimensions.size.width : boundaries.size.width,
                                  (rectDimensions.size.height > 0.0) ? rectDimensions.size.height : boundaries.size.height
                                  );
  CGSize adjustedAspectSize = adjustedSize;
  if (targetAspectRatio) {
    CGFloat adjustedAspectRatio = adjustedSize.width / adjustedSize.height;
    if (adjustedAspectRatio > targetAspectRatio) {
        // Aspect ratio of rectDimensions is wider than the target rect
        adjustedAspectSize = CGSizeMake(
          adjustedSize.height * targetAspectRatio,
          adjustedSize.height
        );
    } else if (adjustedAspectRatio < targetAspectRatio) {
        // Aspect ratio of rectDimensions is taller than the target rect
        adjustedAspectSize = CGSizeMake(
          adjustedSize.width,
          adjustedSize.width / targetAspectRatio
        );
    }
  }
  //Center it inside the rectangle from origin
  CGFloat offsetX = ((adjustedSize.width - adjustedAspectSize.width) / 2);
  CGFloat offsetY = ((adjustedSize.height - adjustedAspectSize.height) / 2);
  CGRect adjustedRect = CGRectMake(rectDimensions.origin.x + offsetX, rectDimensions.origin.y + offsetY, adjustedAspectSize.width, adjustedAspectSize.height);

  //Intersect with boundaries to always contain it! If not contained (bigger than available space -> runs into errors!)
  __block CGRect rect = CGRectIntersection(adjustedRect, boundaries);

  dispatch_block_t block = ^{
    self.view.frame = rect; 
  };
  
  //Ensure to always run in main thread, if not in main thread, dispatch, otherwise run directly to not cause deadlock
  if ([NSThread isMainThread]) {
      block();
  } else {
      dispatch_sync(dispatch_get_main_queue(), block);
  }

  return self.view.frame;
}

- (void)viewDidUnload {
  [super viewDidUnload];

  if ([EAGLContext currentContext] == self.context) {
    [EAGLContext setCurrentContext:nil];
  }
  self.context = nil;
}

- (void)didReceiveMemoryWarning {
  [super didReceiveMemoryWarning];
  // Release any cached data, images, etc. that aren't in use.
}

//Calculates a rect that preserves the original aspect ratio and fits it into targetSize
+ (CGSize)calculateAspectRatio:(CGSize)origSize targetSize:(CGSize)targetSize {
    CGSize newSize = CGSizeMake(targetSize.width, targetSize.height);

    if (newSize.width <= 0 && newSize.height <= 0) {
        // If no new width or height were specified return the original bitmap
        newSize.width = origSize.width;
        newSize.height = origSize.height;
    } else if (newSize.width > 0 && newSize.height <= 0) {
        // Only the width was specified
        newSize.height = (CGFloat) ((newSize.width / origSize.width) * origSize.height);
    } else if (newSize.width <= 0 && newSize.height > 0) {
        // only the height was specified
        newSize.width = (CGFloat) ((newSize.height / origSize.height) * origSize.width);
    } else {
        // If the user specified both a positive width and height
        // (potentially different aspect ratio) then the width or height is
        // scaled so that the image fits while maintaining aspect ratio.
        // Alternatively, the specified width and height could have been
        // kept and Bitmap.SCALE_TO_FIT specified when scaling, but this
        // would result in whitespace in the new image.
        CGFloat newRatio = (CGFloat) (newSize.width /  newSize.height);
        CGFloat origRatio = (CGFloat) (origSize.width / origSize.height);

        if (origRatio > newRatio) {
            newSize.height = (CGFloat) ((newSize.width * origSize.height) / origSize.width);
        } else if (origRatio < newRatio) {
            newSize.width = (CGFloat) ((newSize.height * origSize.width) / origSize.height);
        }
    }

    return newSize;
}
@end
