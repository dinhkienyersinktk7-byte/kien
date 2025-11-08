
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from './icons';
import { editImage } from '../services/geminiService';
import type { SourceImage, EditHistoryItem } from '../types';

const dataUrlToSourceImage = (dataUrl: string): SourceImage | null => {
    const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (match && match[1] && match[2]) {
        return { mimeType: match[1], base64: match[2] };
    }
    return null;
}

const ImageViewerModal: React.FC<{ imageUrl: string; onClose: () => void; }> = ({ imageUrl, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface-4)]/80 backdrop-blur-lg border border-[var(--border-1)] rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-[var(--bg-interactive)] text-white rounded-full p-2 hover:bg-[var(--bg-interactive-hover)] transition-transform duration-200 hover:scale-110 z-10"
          aria-label="Close"
        >
          <Icon name="x-mark" className="w-6 h-6" />
        </button>
        <div className="p-2 flex-grow overflow-auto flex items-center justify-center">
            <img src={imageUrl} alt="Fullscreen view" className="max-w-full max-h-full object-contain rounded-md" />
        </div>
      </div>
    </div>
  );
};

const ImageCompareSlider: React.FC<{ beforeImage: string | null; afterImage: string; }> = ({ beforeImage, afterImage }) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const handleMove = useCallback((clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        setSliderPosition(percent);
    }, []);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        isDragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDragging.current) {
            handleMove(e.clientX);
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        isDragging.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    if (!beforeImage) {
        return <img src={afterImage} alt="Result" className="max-w-full max-h-full object-contain rounded-md" />;
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full select-none overflow-hidden rounded-md cursor-ew-resize group/slider"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            <img
                src={beforeImage}
                alt="Before"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                draggable={false}
            />
            <div
                className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
                <img
                    src={afterImage}
                    alt="After"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    draggable={false}
                />
            </div>
            <div
                className="absolute top-0 bottom-0 w-1 bg-white/50 pointer-events-none z-10"
                style={{ left: `calc(${sliderPosition}% - 0.5px)` }}
            ></div>
            <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-[var(--bg-surface-4)]/80 backdrop-blur-sm border-2 border-white/50 rounded-full flex items-center justify-center text-white pointer-events-none shadow-lg transition-transform group-hover/slider:scale-110 z-10"
                style={{ left: `${sliderPosition}%` }}
            >
                <Icon name="arrows-right-left" className="w-5 h-5" />
            </div>

            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-md pointer-events-none z-10">
                Ảnh Gốc
            </div>
            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-md pointer-events-none z-10"
                 style={{ opacity: sliderPosition > 60 ? 1 : 0, transition: 'opacity 0.2s' }}
            >
                Kết Quả
            </div>
        </div>
    );
};

// A self-contained modal component for a focused, zoomed-in editing experience.
const ZoomEditorModal: React.FC<{
    image: SourceImage;
    initialDrawingData: ImageData | null;
    onClose: () => void;
    onSave: (finalDrawingData: ImageData) => void;
}> = ({ image, initialDrawingData, onClose, onSave }) => {
    const [brushSize, setBrushSize] = useState(40);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingHistory, setDrawingHistory] = useState<ImageData[]>([]);
    
    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Draw the main image and initial mask onto the modal's canvases
    useEffect(() => {
        const imageEl = new Image();
        imageEl.src = `data:${image.mimeType};base64,${image.base64}`;
        imageEl.onload = () => {
            [imageCanvasRef, drawingCanvasRef].forEach(ref => {
                if (ref.current) {
                    ref.current.width = imageEl.width;
                    ref.current.height = imageEl.height;
                }
            });
            const imgCtx = imageCanvasRef.current?.getContext('2d');
            imgCtx?.drawImage(imageEl, 0, 0);

            if (initialDrawingData) {
                const drawCtx = drawingCanvasRef.current?.getContext('2d');
                drawCtx?.putImageData(initialDrawingData, 0, 0);
                setDrawingHistory([initialDrawingData]);
            }
        };
    }, [image, initialDrawingData]);

    const getMousePos = (canvas: HTMLCanvasElement, evt: React.MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (evt.clientX - rect.left) * (canvas.width / rect.width),
            y: (evt.clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e: React.MouseEvent) => {
        setIsDrawing(true);
        const pos = getMousePos(drawingCanvasRef.current!, e);
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing) return;
        const pos = getMousePos(drawingCanvasRef.current!, e);
        const ctx = drawingCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = `rgba(236, 72, 153, 0.7)`;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };

    const stopDrawing = () => {
        const canvas = drawingCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.closePath();
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setDrawingHistory(prev => [...prev, imageData]);
        }
        setIsDrawing(false);
    };
    
    const handleUndo = () => {
        if (drawingHistory.length === 0) return;
        const newHistory = drawingHistory.slice(0, -1);
        setDrawingHistory(newHistory);
        const canvas = drawingCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (newHistory.length > 0) {
                ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
            }
        }
    };

    const handleSave = () => {
        const canvas = drawingCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if(canvas && ctx) {
            const finalData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            onSave(finalData);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[var(--bg-surface-4)]/90 border border-[var(--border-1)] rounded-xl shadow-2xl w-full h-full flex flex-col relative" onClick={e => e.stopPropagation()}>
                {/* Header Controls */}
                <div className="flex-shrink-0 p-3 bg-[var(--bg-surface-3)]/50 border-b border-[var(--border-1)] flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                           <Icon name="brush" className="w-5 h-5"/> Cỡ Bút:
                           <input
                                type="range"
                                min="5" max="150"
                                value={brushSize}
                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                className="w-32 accent-indigo-500"
                            />
                            <span>{brushSize}px</span>
                        </label>
                        <button onClick={handleUndo} disabled={drawingHistory.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-[var(--text-interactive)] bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-2)] rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed">
                            <Icon name="arrow-uturn-left" className="w-4 h-4"/> Hoàn Tác
                        </button>
                    </div>
                     <button onClick={handleSave} className="px-4 py-1.5 text-sm font-bold text-[var(--text-interactive)] bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] rounded-md transition">
                        Lưu & Đóng
                    </button>
                </div>
                {/* Canvas Area */}
                <div ref={containerRef} className="flex-grow w-full h-full p-4 overflow-auto flex items-center justify-center">
                    <div className="relative w-max h-max">
                         <canvas ref={imageCanvasRef} className="max-w-full max-h-full object-contain block" />
                         <canvas 
                            ref={drawingCanvasRef}
                            className="absolute inset-0 w-full h-full object-contain cursor-crosshair"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                         />
                    </div>
                </div>
                 <button onClick={onClose} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/80 transition">
                    <Icon name="x-mark" className="w-5 h-5"/>
                </button>
            </div>
        </div>
    );
};

const ReferenceImageUpload: React.FC<{
  image: SourceImage | null;
  onUpload: (image: SourceImage) => void;
  onRemove: () => void;
}> = ({ image, onUpload, onRemove }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = (e.target?.result as string).split(',')[1];
            if (base64) {
              onUpload({ base64, mimeType: file.type });
            }
        };
        reader.readAsDataURL(file);
    } else {
        alert("Vui lòng tải lên một tệp ảnh hợp lệ (PNG, JPG, WEBP).");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  if (image) {
    return (
      <div className="relative group">
        <img src={`data:${image.mimeType};base64,${image.base64}`} alt="Reference" className="w-full h-40 object-cover rounded-md" />
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 bg-black/50 rounded-full text-white hover:bg-black/80 p-0.5 transition-colors opacity-0 group-hover:opacity-100 z-10"
          aria-label="Remove reference image"
        >
          <Icon name="x-circle" className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full border-2 border-dashed rounded-lg p-4 flex items-center justify-center h-40 text-center text-[var(--text-secondary)] text-sm hover:border-[var(--border-interactive)] transition-colors ${isDraggingOver ? 'border-[var(--border-interactive)] bg-[var(--bg-surface-2)]' : 'border-[var(--border-2)]'}`}
      >
        + Thêm ảnh tham khảo (Vật liệu/Style)
      </button>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
    </>
  );
};


interface ImageEditorProps {
    initialImage: SourceImage | null;
    onClearInitialImage: () => void;
    onEditComplete: (details: {
        sourceImage: SourceImage;
        maskImage: SourceImage;
        referenceImage: SourceImage | null;
        prompt: string;
        resultImage: string;
    }) => void;
    historyItemToRestore: EditHistoryItem | null;
    onHistoryRestored: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ 
    initialImage, 
    onClearInitialImage, 
    onEditComplete, 
    historyItemToRestore,
    onHistoryRestored,
}) => {
  const [image, setImage] = useState<SourceImage | null>(null);
  const [referenceImage, setReferenceImage] = useState<SourceImage | null>(null);
  const [prompt, setPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(40);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isResultFullscreen, setIsResultFullscreen] = useState(false);
  const [drawingHistory, setDrawingHistory] = useState<ImageData[]>([]);

  const sourceImageCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceDrawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const sourceImageUrlForSlider = image ? `data:${image.mimeType};base64,${image.base64}` : null;

  const clearMask = useCallback(() => {
    const canvas = sourceDrawingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setDrawingHistory([]);
  }, []);

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        if (base64) {
          setImage({ base64, mimeType: file.type });
          setResultImage(null);
          setReferenceImage(null);
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert("Vui lòng tải lên một tệp ảnh hợp lệ (PNG, JPG, WEBP).");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const drawImageOnCanvas = useCallback(() => {
    if (!image || !sourceImageCanvasRef.current || !sourceDrawingCanvasRef.current || !sourceContainerRef.current) return;
    
    const imageEl = new Image();
    imageEl.src = `data:${image.mimeType};base64,${image.base64}`;
    imageEl.onload = () => {
      const containerWidth = sourceContainerRef.current?.clientWidth ?? 500;
      const scale = Math.min(1, containerWidth / imageEl.width);
      const width = imageEl.width * scale;
      const height = imageEl.height * scale;
      
      sourceContainerRef.current!.style.aspectRatio = `${width} / ${height}`;
      
      [sourceImageCanvasRef, sourceDrawingCanvasRef].forEach(ref => {
          if(ref.current) {
            ref.current.width = imageEl.width;
            ref.current.height = imageEl.height;
          }
      });
      
      const ctx = sourceImageCanvasRef.current?.getContext('2d');
      ctx?.drawImage(imageEl, 0, 0, imageEl.width, imageEl.height);
      clearMask();
    };
  }, [image, clearMask]);

  useEffect(() => {
    if (initialImage) {
      setImage(initialImage);
      setResultImage(null);
      setPrompt('');
      setReferenceImage(null);
      onClearInitialImage();
    }
  }, [initialImage, onClearInitialImage]);

  useEffect(() => {
    drawImageOnCanvas();
    window.addEventListener('resize', drawImageOnCanvas);
    return () => {
        window.removeEventListener('resize', drawImageOnCanvas);
    }
  }, [drawImageOnCanvas]);

  useEffect(() => {
    if (historyItemToRestore) {
        setImage(historyItemToRestore.sourceImage);
        setPrompt(historyItemToRestore.prompt);
        setResultImage(historyItemToRestore.resultImage);
        setReferenceImage(historyItemToRestore.referenceImage || null);
        clearMask(); 
        onHistoryRestored();
    }
  }, [historyItemToRestore, onHistoryRestored, clearMask]);
  
  const getMousePos = (canvas: HTMLCanvasElement, evt: MouseEvent | React.MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = useCallback((e: React.MouseEvent) => {
    setIsDrawing(true);
    const pos = getMousePos(sourceDrawingCanvasRef.current!, e);
    const ctx = sourceDrawingCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const draw = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return;
    const pos = getMousePos(sourceDrawingCanvasRef.current!, e);
    const ctx = sourceDrawingCanvasRef.current?.getContext('2d');
    if (!ctx) return;

    const nativeBrushSize = brushSize * (sourceDrawingCanvasRef.current!.width / sourceDrawingCanvasRef.current!.getBoundingClientRect().width);

    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = `rgba(236, 72, 153, 0.7)`;
    ctx.lineWidth = nativeBrushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, [isDrawing, brushSize]);

  const stopDrawing = useCallback(() => {
    const canvas = sourceDrawingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.closePath();
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setDrawingHistory(prev => [...prev, imageData]);
    }
    setIsDrawing(false);
  }, []);

  const handleUndo = useCallback(() => {
      if(drawingHistory.length === 0) return;

      const newHistory = drawingHistory.slice(0, -1);
      setDrawingHistory(newHistory);

      const canvas = sourceDrawingCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (newHistory.length > 0) {
              ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
          }
      }
  }, [drawingHistory]);
  
  const handleZoomSave = useCallback((finalImageData: ImageData) => {
      const canvas = sourceDrawingCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.putImageData(finalImageData, 0, 0);
          setDrawingHistory(prev => [...prev, finalImageData]);
      }
      setIsZoomed(false);
  }, []);
  
  const generateMaskImage = (): SourceImage | null => {
    const drawingCanvas = sourceDrawingCanvasRef.current;
    if (!drawingCanvas) return null;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = drawingCanvas.width;
    maskCanvas.height = drawingCanvas.height;
    const maskCtx = maskCanvas.getContext('2d');
    if(!maskCtx) return null;

    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.drawImage(drawingCanvas, 0, 0);
    maskCtx.globalCompositeOperation = 'source-in';
    maskCtx.fillStyle = 'white';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    const dataUrl = maskCanvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    return { base64, mimeType: 'image/png' };
  };

  const handleGenerate = async () => {
    if (!image || !prompt) {
      alert("Vui lòng tải ảnh và nhập mô tả để chỉnh sửa.");
      return;
    }
    
    const maskImage = generateMaskImage();
    if (!maskImage) {
        alert("Không thể tạo vùng chọn (mask).");
        return;
    }

    setIsLoading(true);
    setResultImage(null);
    try {
      const result = await editImage(image, maskImage, prompt, referenceImage);
      if(result) {
        setResultImage(result);
        onEditComplete({ sourceImage: image, maskImage, prompt, referenceImage, resultImage: result });
      } else {
        throw new Error("API did not return an image.");
      }
    } catch (error) {
      console.error("Image editing failed:", error);
      alert("Đã xảy ra lỗi khi chỉnh sửa ảnh. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleContinueEditing = () => {
    if (!resultImage) return;
    const newSource = dataUrlToSourceImage(resultImage);
    if (newSource) {
        setImage(newSource);
        setResultImage(null);
        setReferenceImage(null);
    }
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column - Controls & Editor */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        <div className="bg-[var(--bg-surface-1)] p-6 rounded-xl border border-[var(--border-1)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">1. Ảnh Gốc & Vùng Sửa</h2>
          {image ? (
             <div ref={sourceContainerRef} className="relative group w-full">
                <canvas ref={sourceImageCanvasRef} className="w-full h-auto object-contain rounded-md bg-black/20" />
                <canvas
                    ref={sourceDrawingCanvasRef}
                    className="absolute inset-0 w-full h-full object-contain cursor-crosshair rounded-md"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                />
                <button
                onClick={() => {setImage(null); setResultImage(null); setReferenceImage(null)}}
                className="absolute top-2 right-2 bg-black/60 rounded-full text-white hover:bg-black/80 p-1 transition-colors opacity-0 group-hover:opacity-100 z-10"
                aria-label="Remove image"
                >
                <Icon name="x-circle" className="w-6 h-6" />
                </button>
            </div>
          ) : (
             <>
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`text-center bg-[var(--bg-surface-3)] p-8 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${isDraggingOver ? 'border-[var(--border-interactive)] bg-[var(--bg-surface-2)]' : 'border-[var(--border-2)] hover:border-[var(--border-interactive)]'}`}
                >
                    <p className="text-[var(--text-secondary)] mb-2 pointer-events-none">Nhấp hoặc kéo tệp vào đây</p>
                    <p className="text-xs text-[var(--text-tertiary)] pointer-events-none">Chọn ảnh đã render, hoặc tải lên ảnh mới</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
             </>
          )}
        </div>
        
        {image && (
          <>
            <div className="bg-[var(--bg-surface-1)] p-6 rounded-xl border border-[var(--border-1)]">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2"><Icon name="brush" className="w-5 h-5" /> 2. Tùy Chỉnh</h2>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <button onClick={() => setIsZoomed(true)} className="w-full bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-semibold py-2 px-2 rounded transition-colors text-sm flex items-center justify-center gap-1.5">
                       <Icon name="arrows-pointing-out" className="w-4 h-4"/> Phóng To & Sửa
                    </button>
                    <button onClick={handleUndo} disabled={drawingHistory.length === 0} className="w-full bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-semibold py-2 px-2 rounded transition-colors text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                       <Icon name="arrow-uturn-left" className="w-4 h-4"/> Hoàn Tác
                    </button>
                </div>

                <label htmlFor="brushSize" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Cỡ Bút: {brushSize}px</label>
                <input
                    id="brushSize"
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full h-2 bg-[var(--bg-surface-3)] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <button
                    onClick={clearMask}
                    className="w-full mt-4 bg-[var(--bg-disabled)] hover:bg-[var(--bg-surface-3)] text-[var(--text-primary)] font-bold py-2 px-4 rounded transition-colors text-sm"
                >
                    Xóa Vùng Chọn
                </button>
            </div>

            <div className="bg-[var(--bg-surface-1)] p-6 rounded-xl border border-[var(--border-1)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">3. Mô Tả Chỉnh Sửa</h2>
              <div className="space-y-4">
                  <ReferenceImageUpload
                    image={referenceImage}
                    onUpload={setReferenceImage}
                    onRemove={() => setReferenceImage(null)}
                  />
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ví dụ: thêm một bể bơi, xóa chiếc xe ô tô, đổi tường thành gạch đỏ..."
                    className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-32 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none"
                  />
              </div>
              <button
                onClick={handleGenerate}
                disabled={isLoading || !image}
                className="w-full mt-4 bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed"
              >
                <Icon name="sparkles" className="w-5 h-5" />
                {isLoading ? 'Đang Chỉnh Sửa...' : 'Tạo Chỉnh Sửa'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right Column - Result Viewer */}
      <div className="lg:col-span-2 bg-[var(--bg-surface-1)] p-6 rounded-xl border border-[var(--border-1)] flex flex-col">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 text-center">Kết Quả Chỉnh Sửa</h2>
        <div className="w-full flex-grow bg-black/20 rounded-lg flex items-center justify-center min-h-[400px]">
          <div className="relative w-full h-full max-w-full max-h-full flex items-center justify-center group">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                    <p className="mt-3 font-semibold text-sm text-[var(--text-primary)]">Đang tạo...</p>
                </div>
            ) : resultImage ? (
                <>
                    <ImageCompareSlider beforeImage={sourceImageUrlForSlider} afterImage={resultImage} />
                    <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                        <button
                           onClick={() => setIsResultFullscreen(true)}
                           className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                           aria-label="Xem Toàn Màn Hình"
                           title="Xem Toàn Màn Hình"
                        >
                           <Icon name="arrows-expand" className="w-4 h-4" />
                           <span>Phóng To</span>
                        </button>
                        <a
                            href={resultImage}
                            download={`nbox-ai-edited-${Date.now()}.png`}
                            className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                            aria-label="Tải ảnh"
                            title="Tải ảnh"
                        >
                            <Icon name="download" className="w-4 h-4" />
                            <span>Tải</span>
                        </a>
                        <button
                            onClick={handleContinueEditing}
                            className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                            title="Chỉnh sửa tiếp ảnh này"
                        >
                            <Icon name="arrow-path" className="w-4 h-4" />
                            <span>Sửa tiếp</span>
                        </button>
                    </div>
                </>
            ) : (
                <p className="text-[var(--text-tertiary)] text-center">
                    {image ? 'Kết quả sẽ xuất hiện ở đây.' : 'Vui lòng tải lên một ảnh để bắt đầu.'}
                </p>
            )}
          </div>
        </div>
      </div>
    </div>
    {isZoomed && image && (
        <ZoomEditorModal 
            image={image}
            initialDrawingData={drawingHistory.length > 0 ? drawingHistory[drawingHistory.length - 1] : null}
            onClose={() => setIsZoomed(false)}
            onSave={handleZoomSave}
        />
    )}
    {isResultFullscreen && resultImage && (
       <ImageViewerModal imageUrl={resultImage} onClose={() => setIsResultFullscreen(false)} />
    )}
    </>
  );
};