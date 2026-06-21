declare module 'pdfmake/build/pdfmake' {
  import type { TCreatedPdfSizeBuffer } from 'pdfmake/interfaces';
  const pdfMake: {
    vfs: Record<string, string>;
    fonts: Record<string, unknown>;
    createPdf(docDefinition: unknown): {
      getBlob(cb: (blob: Blob) => void): void;
      download(filename?: string): void;
    };
  };
  export default pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfsFonts: { pdfMake?: { vfs: Record<string, string> } };
  export default vfsFonts;
}

declare module 'file-saver' {
  export function saveAs(blob: Blob, filename: string): void;
}
