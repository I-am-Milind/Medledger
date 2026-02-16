export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const payload = result.includes(',') ? (result.split(',')[1] ?? '') : result;
      resolve(payload);
    };
    reader.readAsDataURL(file);
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

export function dataUrlToBase64(dataUrl: string): string {
  if (!dataUrl) {
    return '';
  }
  return dataUrl.includes(',') ? (dataUrl.split(',')[1] ?? '') : dataUrl;
}

type PreviewKind = 'image' | 'pdf' | 'other';

function inferMimeFromBase64(payload: string): string {
  const normalized = payload.trim();
  if (normalized.startsWith('JVBERi0')) return 'application/pdf';
  if (normalized.startsWith('iVBORw0KGgo')) return 'image/png';
  if (normalized.startsWith('/9j/')) return 'image/jpeg';
  if (normalized.startsWith('R0lGOD')) return 'image/gif';
  if (normalized.startsWith('UklGR')) return 'image/webp';
  return 'application/octet-stream';
}

function getPreviewKind(mime: string): PreviewKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}

function parseDataUrlMime(dataUrl: string): string {
  const match = /^data:([^;,]+)[;,]/i.exec(dataUrl);
  return (match?.[1] ?? 'application/octet-stream').toLowerCase();
}

export function resolveStoredDocumentPreview(value: string): {
  src: string;
  mime: string;
  kind: PreviewKind;
} {
  if (!value) {
    return {
      src: '',
      mime: 'application/octet-stream',
      kind: 'other',
    };
  }

  if (value.startsWith('data:')) {
    const mime = parseDataUrlMime(value);
    return {
      src: value,
      mime,
      kind: getPreviewKind(mime),
    };
  }

  const mime = inferMimeFromBase64(value);
  return {
    src: `data:${mime};base64,${value}`,
    mime,
    kind: getPreviewKind(mime),
  };
}

export async function filesToBase64(files: FileList | null): Promise<string[]> {
  if (!files || files.length === 0) {
    return [];
  }
  const items = Array.from(files);
  return Promise.all(items.map((file) => fileToBase64(file)));
}
