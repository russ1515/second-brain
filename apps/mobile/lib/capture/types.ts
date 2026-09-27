export type CaptureMode = 'photo' | 'document' | 'qr' | 'avatar';

export interface CapturedImage {
  uri: string;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  size: number | null;
  file?: File;
}

export interface CameraCaptureProps {
  mode: CaptureMode;
  onCapture?: (image: CapturedImage) => void;
  onQr?: (value: string) => void;
  onCancel: () => void;
  onImport?: () => void;
}
