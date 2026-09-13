// MediPulse Camera & Image QR Scanner Engine
// Supports Native BarcodeDetector, Camera Video Streams, and Drag & Drop Image Decoding

(function(root) {
  class CameraQRScanner {
    constructor(videoElement, canvasElement, options = {}) {
      this.video = videoElement;
      this.canvas = canvasElement || document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.onScanSuccess = options.onScanSuccess || (() => {});
      this.onError = options.onError || (() => {});
      this.stream = null;
      this.isScanning = false;
      this.animationFrameId = null;
      this.barcodeDetector = null;

      if ('BarcodeDetector' in window) {
        try {
          this.barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch (e) {
          console.warn('[Scanner] BarcodeDetector init failed:', e);
        }
      }
    }

    async startCamera(facingMode = 'environment') {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access not supported on this browser or insecure context (HTTPS/localhost required).');
        }

        this.stopCamera();

        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.video.srcObject = this.stream;
        this.video.setAttribute('playsinline', 'true');
        await this.video.play();

        this.isScanning = true;
        this.scanLoop();
        return true;
      } catch (err) {
        this.onError(err);
        return false;
      }
    }

    stopCamera() {
      this.isScanning = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      if (this.video) {
        this.video.srcObject = null;
      }
    }

    async scanLoop() {
      if (!this.isScanning) return;

      if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        const found = await this.detectFrame(this.video);
        if (found) {
          this.stopCamera();
          return;
        }
      }

      this.animationFrameId = requestAnimationFrame(() => this.scanLoop());
    }

    async detectFrame(source) {
      // Method 1: Native BarcodeDetector (High performance on modern browsers)
      if (this.barcodeDetector) {
        try {
          const codes = await this.barcodeDetector.detect(source);
          if (codes && codes.length > 0) {
            const rawValue = codes[0].rawValue;
            if (rawValue) {
              this.onScanSuccess(rawValue);
              return true;
            }
          }
        } catch (err) {
          // fallback to canvas analysis
        }
      }

      // Method 2: Global jsQR if loaded via CDN
      if (window.jsQR) {
        try {
          const width = source.videoWidth || source.naturalWidth || source.width;
          const height = source.videoHeight || source.naturalHeight || source.height;
          if (width && height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx.drawImage(source, 0, 0, width, height);
            const imageData = this.ctx.getImageData(0, 0, width, height);
            const code = window.jsQR(imageData.data, width, height);
            if (code && code.data) {
              this.onScanSuccess(code.data);
              return true;
            }
          }
        } catch (e) {
          console.warn('[Scanner] jsQR decode error:', e);
        }
      }

      return false;
    }

    async scanImageFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const img = new Image();
          img.onload = async () => {
            // Try BarcodeDetector
            if (this.barcodeDetector) {
              try {
                const codes = await this.barcodeDetector.detect(img);
                if (codes && codes.length > 0) {
                  const result = codes[0].rawValue;
                  this.onScanSuccess(result);
                  return resolve(result);
                }
              } catch (err) {
                // proceed
              }
            }

            // Try jsQR
            if (window.jsQR) {
              try {
                this.canvas.width = img.width;
                this.canvas.height = img.height;
                this.ctx.drawImage(img, 0, 0);
                const imgData = this.ctx.getImageData(0, 0, img.width, img.height);
                const code = window.jsQR(imgData.data, img.width, img.height);
                if (code && code.data) {
                  this.onScanSuccess(code.data);
                  return resolve(code.data);
                }
              } catch (e) {
                // proceed
              }
            }

            // Fallback: Check if file name has patient code or prompt user
            const match = file.name.match(/MED-[A-Z]+-\d+/i) || file.name.match(/pat-\d+/i);
            if (match) {
              const code = match[0].toUpperCase();
              this.onScanSuccess(code);
              return resolve(code);
            }

            reject(new Error('Could not detect a valid QR code in this image. Please ensure the QR code is clear and well-lit.'));
          };
          img.onerror = () => reject(new Error('Invalid image file.'));
          img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
      });
    }
  }

  root.CameraQRScanner = CameraQRScanner;
})(typeof window !== 'undefined' ? window : globalThis);
