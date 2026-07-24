declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    vfs: Record<string, string>;
    fonts?: Record<string, unknown>;
    createPdf(docDefinition: any): {
      getBlob(cb: (blob: Blob) => void): void;
      getBuffer(): Promise<Uint8Array>;
      download(filename?: string | undefined): void;
    };
  };
  export default pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfsFonts: Record<string, string>;
  export default vfsFonts;
}

declare module 'file-saver' {
  const saveAs: (blob: Blob, filename: string) => void;
  export default saveAs;
  export { saveAs };
}
