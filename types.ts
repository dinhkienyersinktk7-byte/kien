
export interface RenderHistoryItem {
  id: number;
  timestamp: string;
  images: string[];
  prompt: string;
}

export interface EditHistoryItem {
  id: number;
  timestamp: string;
  sourceImage: SourceImage;
  maskImage: SourceImage;
  referenceImage?: SourceImage | null;
  prompt: string;
  resultImage: string;
}

export interface SourceImage {
  base64: string;
  mimeType: string;
}

export interface GeneratedPrompts {
  medium: string[];
  closeup: string[];
  interior: string[];
}