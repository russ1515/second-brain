/** Minimal typing for the direct lib entrypoint of pdf-parse, which we import to
 *  avoid the package's debug-mode test-file read on the main entrypoint. */
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
  }
  function pdfParse(data: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}
