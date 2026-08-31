import mammoth from "mammoth";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type UploadedCv =
  | { kind: "text"; text: string }
  /** Handed to Claude as a document. It reads layout, so two-column CVs survive. */
  | { kind: "pdf"; bytes: Uint8Array };

export class UploadError extends Error {}

const DOCX_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * Turn an uploaded CV into something the writer can read. Text extractors
 * scramble multi-column PDF layouts, so PDFs are passed through whole and
 * Claude reads them directly; .docx goes through mammoth, which is reliable.
 */
export async function readCvUpload(file: File): Promise<UploadedCv> {
  if (file.size === 0) throw new UploadError("That file looks empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("That file is over 10MB. A CV shouldn't be.");
  }

  const name = file.name.toLowerCase();
  const type = file.type;

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return { kind: "pdf", bytes: new Uint8Array(await file.arrayBuffer()) };
  }

  if (DOCX_TYPES.includes(type) || name.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    if (!value.trim()) {
      throw new UploadError("We couldn't find any text in that document.");
    }
    return { kind: "text", text: value };
  }

  // The old binary .doc format isn't readable here. Say so plainly.
  if (name.endsWith(".doc")) {
    throw new UploadError(
      "That's the old .doc format. Save it as PDF or .docx and try again.",
    );
  }

  if (type.startsWith("text/") || /\.(txt|md|rtf)$/.test(name)) {
    const text = await file.text();
    if (!text.trim()) throw new UploadError("That file looks empty.");
    return { kind: "text", text };
  }

  throw new UploadError("We can read PDF, .docx and plain text. Not that, sorry.");
}
