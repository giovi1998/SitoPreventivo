import { GlobalWorkerOptions } from 'pdfjs-dist';

export function setupPdfWorker() {
  try {
    const workerUrl = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    try {
      GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
    } catch {
      console.warn('PDF.js worker non disponibile, parsing potrebbe fallire per PDF complessi.');
    }
  }
}
