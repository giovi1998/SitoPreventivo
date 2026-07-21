export async function removeWhiteBackground(base64: string, tolerance = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    // Se jsdom (test), ritorna mock
    if (typeof window === 'undefined' || !window.document || !window.document.createElement) {
      resolve(base64);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          // If pixel is near white, make it transparent
          if (data[i] >= tolerance && data[i + 1] >= tolerance && data[i + 2] >= tolerance) {
            data[i + 3] = 0; // Alpha
          }
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('Canvas processing failed (CORS?)', e);
        resolve(base64);
      }
    };
    img.onerror = () => {
      reject(new Error('Failed to load image for background removal'));
    };
    img.src = base64;
  });
}
