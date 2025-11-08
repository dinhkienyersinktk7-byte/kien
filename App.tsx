
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { RenderHistoryItem, SourceImage, EditHistoryItem, GeneratedPrompts } from './types';
import { generateImages, upscaleImage, describeInteriorImage, describeMasterplanImage } from './services/geminiService';
import { Icon } from './components/icons';
import { ImageEditor } from './components/ImageEditor';
import { UtilitiesTab } from './components/UtilitiesTab';
import { VirtualTourTab } from './components/VirtualTourTab';

type RenderTab = 'exterior' | 'interior' | 'floorplan' | 'masterplan';
type AppTab = RenderTab | 'virtual_tour' | 'edit' | 'utilities';

interface RenderTabState {
  sourceImage: SourceImage | null;
  referenceImage: SourceImage | null;
  generatedImages: string[];
  selectedImageIndex: number;
}

const initialTabState: RenderTabState = {
  sourceImage: null,
  referenceImage: null,
  generatedImages: [],
  selectedImageIndex: 0,
};

const QuickLinkButton: React.FC<{
  label: string;
  icon: string;
  onClick: () => void;
}> = ({ label, icon, onClick }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-center gap-1.5 text-orange-100 hover:text-white transition-colors duration-300"
  >
    <div className="p-3 bg-neutral-800/50 border border-neutral-700 rounded-full group-hover:bg-orange-500/20 group-hover:border-orange-500 transition-all duration-300">
      <Icon name={icon} className="w-5 h-5" />
    </div>
    <span className="text-xs font-semibold tracking-wide">{label}</span>
  </button>
);

const LandingPage: React.FC<{ onEnter: () => void; onQuickLink: (tab: AppTab) => void; }> = ({ onEnter, onQuickLink }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleEnter = () => {
    setIsExiting(true);
    setTimeout(onEnter, 500); // Match animation duration
  };

  const handleQuickLinkClick = (tab: AppTab) => {
    setIsExiting(true);
    setTimeout(() => onQuickLink(tab), 500); // Match animation duration
  };

  return (
    <div className={`fixed inset-0 bg-gradient-to-br from-[#4a2100] to-[#2c1400] flex flex-col items-center justify-center p-8 z-50 transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      <header className="absolute top-0 left-0 right-0 p-6 z-10">
        <div className="max-w-4xl mx-auto flex justify-center items-center gap-8 md:gap-12">
          <QuickLinkButton label="Render" icon="photo" onClick={() => handleQuickLinkClick('exterior')} />
          <QuickLinkButton label="Chỉnh Sửa" icon="brush" onClick={() => handleQuickLinkClick('edit')} />
          <QuickLinkButton label="Tham Quan Ảo" icon="cursor-arrow-rays" onClick={() => handleQuickLinkClick('virtual_tour')} />
        </div>
      </header>
      
      <main className="flex flex-col items-center justify-center text-center z-10">
        <h1 className="text-5xl md:text-7xl font-bold tracking-wider uppercase font-montserrat text-white">
          NBOX<span className="text-amber-300">.AI</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base md:text-lg text-orange-200 leading-relaxed">
          Biến Ý Tưởng Kiến Trúc Thành Hiện Thực Siêu Thực với Sức Mạnh Của Trí Tuệ Nhân Tạo
        </p>
        <button
          onClick={handleEnter}
          className="mt-12 bg-amber-300 hover:bg-amber-400 text-orange-900 font-bold py-3 px-10 rounded-full text-lg flex items-center gap-2 transition-transform duration-300 ease-in-out hover:scale-105 shadow-[0_0_20px_rgba(249,115,22,0.5)]"
        >
          Vào App <span className="text-2xl leading-none">&rsaquo;</span>
        </button>
      </main>

       <footer className="absolute bottom-6 text-xs text-orange-300 z-10">
          Created by Trần Minh Nhật - NBOX.AI
       </footer>
    </div>
  );
};


const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-[var(--bg-surface-1)] backdrop-blur-md border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl">
    <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h2>
    {children}
  </div>
);

const ImageUpload: React.FC<{
  sourceImage: SourceImage | null;
  onImageUpload: (image: SourceImage) => void;
  onRemove: () => void;
}> = ({ sourceImage, onImageUpload, onRemove }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = (e.target?.result as string).split(',')[1];
            if (base64) {
              onImageUpload({ base64, mimeType: file.type });
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

  const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent the file dialog from opening
      onRemove();
  }

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative group border-2 border-dashed rounded-lg p-4 flex items-center justify-center h-48 mb-4 hover:border-[var(--border-interactive)] transition-colors cursor-pointer ${isDraggingOver ? 'border-[var(--border-interactive)] bg-[var(--bg-surface-2)]' : 'border-[var(--border-2)]'}`}
        onClick={() => fileInputRef.current?.click()}
      >
        {sourceImage ? (
          <>
            <img src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} alt="Source" className="max-h-full max-w-full object-contain rounded" />
            <button
                onClick={handleRemove}
                className="absolute top-1 right-1 bg-black/50 rounded-full text-white hover:bg-black/80 p-0.5 transition-colors opacity-0 group-hover:opacity-100 z-10"
                aria-label="Remove source image"
            >
                <Icon name="x-circle" className="w-5 h-5" />
            </button>
          </>
        ) : (
          <div className="text-center text-[var(--text-secondary)] pointer-events-none">
            <p>Nhấp hoặc kéo tệp vào đây</p>
            <p className="text-xs">PNG, JPG, WEBP</p>
          </div>
        )}
      </div>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-2 px-4 rounded transition-colors"
      >
        {sourceImage ? 'Đổi Ảnh Khác' : 'Tải Lên Ảnh'}
      </button>
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
        <img src={`data:${image.mimeType};base64,${image.base64}`} alt="Reference" className="w-full h-56 object-cover rounded-md" />
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
        className={`w-full border-2 border-dashed rounded-lg p-4 flex items-center justify-center h-56 text-center text-[var(--text-secondary)] text-sm hover:border-[var(--border-interactive)] transition-colors ${isDraggingOver ? 'border-[var(--border-interactive)] bg-[var(--bg-surface-2)]' : 'border-[var(--border-2)]'}`}
      >
        + Thêm ảnh tham khảo (Tone/Mood)
      </button>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
    </>
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

const ResultDisplay: React.FC<{
  sourceImage: SourceImage | null;
  images: string[];
  isLoading: boolean;
  onUpscale: (index: number, target: '2k' | '4k') => void;
  upscalingIndex: number | null;
  onEditRequest: (image: string) => void;
  selectedImageIndex: number;
  onSelectImageIndex: (index: number) => void;
  onChangeAngle: (index: number) => void;
  onFullscreen: (index: number) => void;
  showChangeAngleButton: boolean;
}> = ({ sourceImage, images, isLoading, onUpscale, upscalingIndex, onEditRequest, selectedImageIndex, onSelectImageIndex, onChangeAngle, onFullscreen, showChangeAngleButton }) => {
  const selectedImage = images[selectedImageIndex];
  const sourceImageUrl = sourceImage ? `data:${sourceImage.mimeType};base64,${sourceImage.base64}` : null;

  return (
    <div className="bg-[var(--bg-surface-1)] backdrop-blur-md border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Kết Quả Render</h2>
        {images.length > 0 && <span className="text-sm text-[var(--text-secondary)]">{images.length} ảnh</span>}
      </div>

      {/* Main Preview */}
      <div className="flex-grow flex items-center justify-center bg-black/20 rounded-lg mb-4 min-h-[300px] md:min-h-[400px]">
        {isLoading ? (
          <div className="w-full h-full bg-[var(--bg-surface-2)] rounded-lg animate-pulse"></div>
        ) : selectedImage ? (
          <div className="relative group w-full h-full flex items-center justify-center">
            <ImageCompareSlider beforeImage={sourceImageUrl} afterImage={selectedImage} />
            
            {upscalingIndex === selectedImageIndex && (
              <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center rounded-lg z-20">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                <p className="mt-3 font-semibold text-sm text-slate-200">Đang upscale...</p>
              </div>
            )}
            
            {/* Navigation Buttons */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => onSelectImageIndex(selectedImageIndex - 1)}
                  disabled={selectedImageIndex === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 text-white rounded-full p-2 hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed"
                  aria-label="Previous image"
                >
                  <Icon name="chevron-left" className="w-6 h-6" />
                </button>
                <button
                  onClick={() => onSelectImageIndex(selectedImageIndex + 1)}
                  disabled={selectedImageIndex === images.length - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 text-white rounded-full p-2 hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed"
                  aria-label="Next image"
                >
                  <Icon name="chevron-right" className="w-6 h-6" />
                </button>
              </>
            )}

            {upscalingIndex === null && (
              <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                <button
                  onClick={() => onFullscreen(selectedImageIndex)}
                  className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                  title="Xem Toàn Màn Hình"
                >
                  <Icon name="arrows-expand" className="w-4 h-4" />
                  <span>Phóng To</span>
                </button>
                <button
                  onClick={() => onEditRequest(selectedImage)}
                  className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                  title="Chỉnh Sửa Ảnh Này"
                >
                  <Icon name="pencil" className="w-4 h-4" />
                  <span>Sửa</span>
                </button>
                {showChangeAngleButton && (
                  <button
                    onClick={() => onChangeAngle(selectedImageIndex)}
                    className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                    title="Đổi Góc Chụp Ảnh Này"
                  >
                    <Icon name="viewfinder" className="w-4 h-4" />
                    <span>Đổi Góc Chụp</span>
                  </button>
                )}
                <a
                  href={selectedImage}
                  download={`nbox-ai-render-${Date.now()}-${selectedImageIndex}.png`}
                  className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5"
                  aria-label="Tải ảnh"
                  title="Tải ảnh"
                >
                  <Icon name="download" className="w-4 h-4" />
                  <span>Tải</span>
                </a>
              </div>
            )}

            {upscalingIndex === null && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                <button
                  onClick={() => onUpscale(selectedImageIndex, '2k')}
                  className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-bold text-xs px-2 py-1 rounded-md transition-colors"
                  title="Upscale lên 2K"
                >
                  UPSCALE 2K
                </button>
                <button
                  onClick={() => onUpscale(selectedImageIndex, '4k')}
                  className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-bold text-xs px-2 py-1 rounded-md transition-colors"
                  title="Upscale lên 4K"
                >
                  UPSCALE 4K
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-[var(--text-tertiary)]">
            <p>Hình ảnh được tạo sẽ xuất hiện ở đây.</p>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div className={`grid gap-3 ${images.length > 1 ? 'grid-cols-4' : 'grid-cols-1'}`}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-square bg-[var(--bg-surface-2)] rounded-lg animate-pulse"></div>
          ))
        ) : (
          images.map((image, index) => (
            <div
              key={index}
              className={`relative group aspect-square bg-[var(--bg-surface-2)] rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${selectedImageIndex === index ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-surface-1)] ring-[var(--ring-active)]' : 'opacity-70 hover:opacity-100'}`}
              onClick={() => onSelectImageIndex(index)}
            >
              <img src={image} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
            </div>
          ))
        )}
      </div>
    </div>
  );
};


const HistoryPanel: React.FC<{ 
    history: RenderHistoryItem[]; 
    onClear: () => void; 
    onSelect: (item: RenderHistoryItem) => void;
    title: string;
}> = ({ history, onClear, onSelect, title }) => {
  return (
    <div className="bg-[var(--bg-surface-1)] backdrop-blur-md border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Icon name="clock" className="w-5 h-5" />
          {title}
        </h2>
        {history.length > 0 &&
            <button onClick={onClear} className="text-[var(--text-danger)] hover:text-[var(--text-danger-hover)] text-sm font-semibold flex items-center gap-1">
                <Icon name="trash" className="w-4 h-4" />
                Xóa
            </button>
        }
      </div>
      {history.length > 0 ? (
        <ul className="space-y-3 overflow-y-auto max-h-96 pr-2">
          {history.map((item) => (
            <li key={item.id} 
                className="bg-[var(--bg-surface-2)] p-3 rounded-md hover:bg-[var(--bg-surface-3)] cursor-pointer transition-colors"
                onClick={() => onSelect(item)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-grow min-w-0 mr-2">
                  <p className="font-semibold text-sm">{item.images.length} ảnh</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate" title={item.prompt}>{item.prompt}</p>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] self-start flex-shrink-0">{item.timestamp}</p>
              </div>
              <div className="flex overflow-x-auto gap-2 pb-1">
                {item.images.map((image, index) => (
                    <img 
                        key={index} 
                        src={image} 
                        alt={`History thumbnail ${index + 1}`} 
                        className="w-20 h-20 object-cover rounded flex-shrink-0"
                    />
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--text-tertiary)] text-center py-4">Chưa có lịch sử render.</p>
      )}
    </div>
  );
};

const EditHistoryPanel: React.FC<{ 
    history: EditHistoryItem[]; 
    onClear: () => void; 
    onSelect: (item: EditHistoryItem) => void;
}> = ({ history, onClear, onSelect }) => {
  return (
    <div className="bg-[var(--bg-surface-1)] backdrop-blur-md border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Icon name="clock" className="w-5 h-5" />
          Lịch Sử Chỉnh Sửa
        </h2>
        {history.length > 0 &&
            <button onClick={onClear} className="text-[var(--text-danger)] hover:text-[var(--text-danger-hover)] text-sm font-semibold flex items-center gap-1">
                <Icon name="trash" className="w-4 h-4" />
                Xóa
            </button>
        }
      </div>
      {history.length > 0 ? (
        <ul className="space-y-3 overflow-y-auto max-h-[calc(100vh-12rem)] pr-2">
          {history.map((item) => (
            <li key={item.id} 
                className="bg-[var(--bg-surface-2)] p-3 rounded-md hover:bg-[var(--bg-surface-3)] cursor-pointer transition-colors"
                onClick={() => onSelect(item)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-grow min-w-0 mr-2">
                  <p className="font-semibold text-sm truncate" title={item.prompt}>{item.prompt}</p>
                  <p className="text-xs text-[var(--text-secondary)]">1 ảnh đã sửa</p>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] self-start flex-shrink-0">{item.timestamp}</p>
              </div>
              <div className="flex gap-2">
                <div className="relative" style={{ width: item.referenceImage ? 'calc(100% / 3)' : '50%'}}>
                    <img 
                        src={`data:${item.sourceImage.mimeType};base64,${item.sourceImage.base64}`} 
                        alt="Source" 
                        className="w-full aspect-square object-cover rounded" 
                    />
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">GỐC</span>
                </div>
                {item.referenceImage && (
                    <div className="relative" style={{ width: 'calc(100% / 3)' }}>
                        <img src={`data:${item.referenceImage.mimeType};base64,${item.referenceImage.base64}`} alt="Reference" className="w-full aspect-square object-cover rounded" />
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">REF</span>
                    </div>
                )}
                <div className="relative" style={{ width: item.referenceImage ? 'calc(100% / 3)' : '50%'}}>
                    <img 
                        src={item.resultImage} 
                        alt="Result" 
                        className="w-full aspect-square object-cover rounded" 
                    />
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">SỬA</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--text-tertiary)] text-center py-4">Chưa có lịch sử chỉnh sửa.</p>
      )}
    </div>
  );
};

const ImageViewerModal: React.FC<{ images: string[]; startIndex: number; onClose: () => void; }> = ({ images, startIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const imageUrl = images[currentIndex];

  const handlePrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : prev));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, onClose]);

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface-4)]/80 backdrop-blur-lg border border-[var(--border-1)] rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-[var(--bg-interactive)] text-white rounded-full p-2 hover:bg-[var(--bg-interactive-hover)] transition-transform duration-200 hover:scale-110 z-20"
          aria-label="Close"
        >
          <Icon name="x-mark" className="w-6 h-6" />
        </button>
        <div className="p-2 flex-grow overflow-auto flex items-center justify-center relative">
          <img src={imageUrl} alt={`Fullscreen view ${currentIndex + 1}`} className="max-w-full max-h-full object-contain rounded-md" />
          
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/40 text-white rounded-full p-2 hover:bg-black/70 transition-all disabled:opacity-0 disabled:cursor-not-allowed"
                aria-label="Previous image"
              >
                <Icon name="chevron-left" className="w-8 h-8" />
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === images.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/40 text-white rounded-full p-2 hover:bg-black/70 transition-all disabled:opacity-0 disabled:cursor-not-allowed"
                aria-label="Next image"
              >
                <Icon name="chevron-right" className="w-8 h-8" />
              </button>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="text-center text-sm text-white/80 pb-2 font-mono">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  );
};

const UpscaleModal: React.FC<{ imageUrl: string; onClose: () => void; }> = ({ imageUrl, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface-4)]/80 backdrop-blur-lg border border-[var(--border-1)] rounded-xl shadow-2xl max-w-4xl max-h-[90vh] flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-[var(--bg-interactive)] text-white rounded-full p-2 hover:bg-[var(--bg-interactive-hover)] transition-transform duration-200 hover:scale-110 z-10"
          aria-label="Close"
        >
          <Icon name="x-mark" className="w-6 h-6" />
        </button>
        <div className="p-4 overflow-auto">
            <img src={imageUrl} alt="Upscaled result" className="w-full h-auto object-contain rounded-md" />
        </div>
        <div className="p-4 border-t border-[var(--border-2)] flex justify-center">
          <a
            href={imageUrl}
            download={`nbox-ai-upscaled-${Date.now()}.png`}
            className="bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="download" className="w-5 h-5" />
            Tải Về Ảnh Upscaled
          </a>
        </div>
      </div>
    </div>
  );
};

const TabButton = React.forwardRef<HTMLButtonElement, {
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}>(({ label, icon, isActive, onClick }, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`relative z-10 flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap outline-none ${
        isActive
          ? 'text-[var(--text-accent)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
      aria-selected={isActive}
    >
      <Icon name={icon} className="w-5 h-5" />
      {label}
    </button>
  );
});

export default function App() {
  const [showApp, setShowApp] = useState(false);
  type Theme = 'dark' | 'light' | 'orange' | 'green';
  const [activeTab, setActiveTab] = useState<AppTab>('exterior');
  const [imageForEditing, setImageForEditing] = useState<SourceImage | null>(null);
  const [editHistoryItemToRestore, setEditHistoryItemToRestore] = useState<EditHistoryItem | null>(null);
  const [theme, setTheme] = useState<Theme>('orange');
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);

  const [tabStates, setTabStates] = useState<Record<RenderTab, RenderTabState>>({
    exterior: { ...initialTabState },
    interior: { ...initialTabState },
    floorplan: { ...initialTabState },
    masterplan: { ...initialTabState },
  });

  const isRenderTab = (tab: string): tab is RenderTab => ['exterior', 'interior', 'floorplan', 'masterplan'].includes(tab as RenderTab);
  
  const activeTabState = isRenderTab(activeTab) ? tabStates[activeTab] : initialTabState;
  
  const updateActiveTabState = (update: Partial<RenderTabState>) => {
    if (isRenderTab(activeTab)) {
      setTabStates(prev => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], ...update }
      }));
    }
  };

  const { sourceImage, referenceImage, generatedImages, selectedImageIndex } = activeTabState;
  const setSourceImage = (img: SourceImage | null) => updateActiveTabState({ sourceImage: img });
  const setReferenceImage = (img: SourceImage | null) => updateActiveTabState({ referenceImage: img });
  const setGeneratedImages = (imgs: string[]) => updateActiveTabState({ generatedImages: imgs });
  const setSelectedImageIndex = (idx: number) => updateActiveTabState({ selectedImageIndex: idx });
  
  // Render options
  const [numImages, setNumImages] = useState(4);
  const [aspectRatio, setAspectRatio] = useState('Auto');

  // Exterior prompts state management
  const [exteriorCustomPrompt, setExteriorCustomPrompt] = useState('');
  const [exteriorContext, setExteriorContext] = useState('');
  const [exteriorLighting, setExteriorLighting] = useState('');
  const [exteriorTone, setExteriorTone] = useState('');
  const [exteriorPrompt, setExteriorPrompt] = useState('Ảnh chụp thực tế công trình');

  const exteriorContextOptions = [
    "Trên một con phố ở Việt Nam",
    "Tại vùng nông thôn Việt Nam",
    "Trong khu đô thị cao cấp ở Việt Nam",
    "Ở ngã 4 của đường phố Việt Nam",
    "Trong khu vườn nhiệt đới thuộc miền quê Việt Nam",
    "Nằm cạnh con đường làng Việt Nam, bao quanh bởi cây xanh hai bên ngôi nhà",
    "Bên trong khu vườn kiểu châu Âu rộng rãi, sang trọng",
    "Trên vùng đồi núi có cảnh quan thơ mộng",
  ];
  const exteriorLightingOptions = [
      "Ánh sáng hoàng hôn, đèn nội thất bên trong nhà sáng nhẹ",
      "Bầu trời u ám, ánh sáng overcast, không xuất hiện bóng gắt",
      "Trời vừa mưa xong, mặt đường còn ướt, không khí trong lành",
      "Bình minh buổi sáng với ánh sáng trong trẻo",
      "Ánh sáng ban đêm, trời có trăng sáng",
      "Ánh sáng tự nhiên ban ngày, buổi trưa nắng gắt",
      "Sương mù dày vào buổi sáng sớm, mơ hồ và huyền ảo",
      "Ánh sáng lúc hoàng hôn, đổ bóng kéo dài",
  ];
  const exteriorToneOptions = [
    "Đen trắng (Monochrome)",
    "Tone điện ảnh (Cinematic)",
    "Tone tự nhiên – thực tế",
    "Tone ấm áp (Warm & Cozy)",
    "Tone lạnh hiện đại",
    "Vintage / Retro",
    "Tone pastel / mood board",
    "Tone tương lai (Futuristic / Sci-fi)",
    "Tone tạp chí thập niên 90",
  ];

  // Interior prompts
  const [interiorPrompt, setInteriorPrompt] = useState('');
  const [interiorNegativePrompt, setInteriorNegativePrompt] = useState('ảnh sketch, hoạt hình, ảnh giả, chữ viết, watermark, người');
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const interiorPredefinedPrompts = [
    "tạo ảnh chụp thực tế phòng khách phong cách hiện đại với ghế sofa màu xám, sàn gỗ, và cửa sổ lớn nhìn ra vườn",
    "tạo ảnh chụp thực tế phòng ngủ ấm cúng với tông màu trung tính, giường gỗ, và ánh sáng vàng dịu",
    "tạo ảnh chụp thực tế nhà bếp tối giản với tủ bếp trắng không tay cầm, mặt bếp đá cẩm thạch, và đèn thả trần",
    "tạo ảnh chụp thực tế phòng tắm sang trọng ốp đá marble, có bồn tắm đứng và vòi sen cây, ánh sáng tự nhiên",
    "tạo ảnh chụp thực tế văn phòng làm việc tại nhà với bàn gỗ sồi, ghế công thái học, và kệ sách âm tường"
  ];
  const interiorToneOptions = [
    "Tone ấm cúng (Warm & Cozy)",
    "Tone sang trọng (Luxury)",
    "Tone tối giản (Minimalist)",
    "Tone Bắc Âu (Scandinavian)",
    "Tone Wabi-sabi",
    "Tone Bohemian",
    "Tone công nghiệp (Industrial)",
    "Tone Vintage / Retro",
    "Tone điện ảnh (Cinematic)",
    "Tone tạp chí kiến trúc",
  ];
  
  // Floorplan state
  const [floorplanPrompt, setFloorplanPrompt] = useState('Biến bản floorplan này thành ảnh render 3d nội thất. bám theo bố trí vật dụng và không gian của phòng theo mặt bằng đưa vào');
  const [roomType, setRoomType] = useState('Phòng khách');
  const [roomStyle, setRoomStyle] = useState('Hiện đại');
  const roomTypeOptions = ['Phòng khách', 'Phòng ngủ', 'Nhà bếp', 'Phòng tắm / WC', 'Ban công', 'Phòng làm việc', 'Phòng ăn', 'Lối vào'];
  const roomStyleOptions = ['Hiện đại', 'Tân cổ điển', 'Wabi-sabi', 'Tối giản (Minimalism)', 'Scanvadian', 'Indochine', 'Industrial', 'Bohemian', 'Modern Classic', 'Modern Minimalist'];

  // Masterplan state
  const [masterplanPrompt, setMasterplanPrompt] = useState('');
  const [isGeneratingMasterplanDesc, setIsGeneratingMasterplanDesc] = useState(false);

  const exteriorAngleOptions = [
    "Góc chụp trực diện toàn cảnh mặt tiền căn nhà",
    "Góc chụp 3/4 bên trái, thể hiện cả mặt tiền và hông nhà",
    "Góc chụp 3/4 bên phải, lấy được chiều sâu công trình",
    "Góc chụp từ trên cao nhìn xuống (drone view) toàn cảnh khuôn viên",
    "Góc chụp từ dưới lên (low angle), nhấn mạnh chiều cao và sự bề thế",
    "Góc chụp cận cảnh chi tiết cửa chính và vật liệu mặt tiền",
    "Góc chụp xuyên qua hàng cây/cảnh quan để tạo khung tự nhiên",
    "Góc chụp từ trong nhà nhìn ra sân vườn hoặc cổng",
    "Góc chụp ban đêm với ánh sáng nhân tạo, nhấn mạnh hệ thống đèn",
    "Góc chụp panorama quét ngang, bao trọn bối cảnh và môi trường xung quanh",
    "Góc chụp từ trên xuống (Top-down) như một bản vẽ mặt bằng kiến trúc",
    "Góc chụp cận cảnh chi tiết vật liệu đặc trưng",
    "Góc chụp phản chiếu công trình trên mặt nước",
    "Góc chụp qua khung cửa sổ nhà đối diện",
    "Góc chụp từ ban công nhà đối diện, có các chậu cây làm tiền cảnh",
    "Góc chụp từ người ngồi uống cà phê bên kia đường",
    "Close shot of this image",
  ];

  const interiorAngleOptions = [
    "Góc chụp từ trên cao nhìn xuống toàn bộ không gian phòng",
    "Góc chụp góc 3/4 bên trái bao quát cả căn phòng",
    "Góc chụp góc 3/4 bên phải bao quát cả căn phòng",
    "Góc chụp góc chính diện thẳng vào trung tâm phòng",
    "Góc chụp góc chéo từ cửa ra vào nhìn vào trong phòng",
    "Góc chụp từ phía sau sofa nhìn về hướng cửa sổ",
    "Góc chụp từ trong phòng nhìn ngược ra cửa chính",
    "Góc chụp từ trần nhà thấp xuống tạo chiều sâu không gian",
    "Góc chụp đối xứng cân bằng toàn bộ phòng",
    "Góc chụp từ một góc tường chéo tạo cảm giác rộng",
    "Góc chụp khu vực sofa và bàn trà từ góc nhìn ngang",
    "Góc chụp khu vực kệ tivi và tường trang trí từ góc chính diện",
    "Góc chụp bàn ăn và ghế từ góc nghiêng 45 độ",
    "Góc chụp cửa sổ lớn và ánh sáng tự nhiên tràn vào phòng",
    "Góc chụp góc tường trang trí với tranh nghệ thuật và đèn hắt sáng",
    "Góc chụp góc nhìn về khu vực bếp liên thông với phòng khách",
    "Góc chụp khu vực đọc sách với kệ sách và ghế đơn",
    "Góc chụp thảm trải sàn bao quanh bàn trà",
    "Góc chụp khu vực treo rèm cửa và ánh sáng chiếu vào",
    "Góc chụp chi tiết trần nhà và hệ thống đèn trang trí",
    "Góc chụp cận cảnh sofa với chất liệu vải hoặc da",
    "Góc chụp cận cảnh bàn trà với mặt kính hoặc gỗ",
    "Góc chụp cận cảnh đèn chùm pha lê hoặc đèn thả trần",
    "Góc chụp cận cảnh gối trang trí nhiều màu sắc trên sofa",
    "Góc chụp cận cảnh thảm trải sàn với hoa văn rõ nét",
    "Góc chụp cận cảnh rèm cửa với chất liệu mỏng nhẹ",
    "Góc chụp cận cảnh chậu cây xanh trang trí trong phòng",
    "Góc chụp cận cảnh kệ tivi và đồ trang trí nhỏ",
    "Góc chụp cận cảnh tay vịn ghế và chất liệu gỗ",
    "Góc chụp cận cảnh bề mặt tường với hoa văn hoặc phào chỉ",
  ];

  const angleOptions = (activeTab === 'interior' || activeTab === 'floorplan') ? interiorAngleOptions : exteriorAngleOptions;
  const [anglePrompt, setAnglePrompt] = useState(angleOptions[0]);
  const angleSectionRef = React.useRef<HTMLDivElement>(null);

  const [exteriorHistory, setExteriorHistory] = useState<RenderHistoryItem[]>([]);
  const [interiorHistory, setInteriorHistory] = useState<RenderHistoryItem[]>([]);
  const [floorplanHistory, setFloorplanHistory] = useState<RenderHistoryItem[]>([]);
  const [masterplanHistory, setMasterplanHistory] = useState<RenderHistoryItem[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
  const [utilitiesHistory, setUtilitiesHistory] = useState<RenderHistoryItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [upscalingIndex, setUpscalingIndex] = useState<number | null>(null);
  const [upscaledImageForModal, setUpscaledImageForModal] = useState<string | null>(null);
  const [fullscreenState, setFullscreenState] = useState<{ images: string[]; startIndex: number } | null>(null);

  // State for persistent Utilities tab data
  const [promptFinderImage, setPromptFinderImage] = useState<SourceImage | null>(null);
  const [promptFinderPrompts, setPromptFinderPrompts] = useState<GeneratedPrompts | null>(null);

  // New state and refs for animated tab indicator
  const TABS: { id: AppTab; label: string; icon: string }[] = [
    { id: 'exterior', label: 'Render Ngoại Thất', icon: 'photo' },
    { id: 'interior', label: 'Render Nội Thất', icon: 'home' },
    { id: 'floorplan', label: 'Floorplan to 3D', icon: 'cube' },
    { id: 'masterplan', label: '2D Masterplan to 3D', icon: 'arrows-pointing-out' },
    { id: 'virtual_tour', label: 'Tham Quan Ảo', icon: 'cursor-arrow-rays' },
    { id: 'edit', label: 'Chỉnh Sửa Ảnh', icon: 'brush' },
    { id: 'utilities', label: 'Tiện Ích Khác', icon: 'bookmark' },
  ];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({});

  useEffect(() => {
    const activeTabIndex = TABS.findIndex(tab => tab.id === activeTab);
    const activeTabElem = tabRefs.current[activeTabIndex];
    if (activeTabElem) {
      setIndicatorStyle({
        left: `${activeTabElem.offsetLeft}px`,
        width: `${activeTabElem.offsetWidth}px`,
      });
    }
  }, [activeTab]);


  const handleQuickLink = (tab: AppTab) => {
    setActiveTab(tab);
    setShowApp(true);
  };
  
  // --- Theme Management ---
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'orange' || savedTheme === 'green') {
      setTheme(savedTheme as Theme);
    } else {
      setTheme('orange');
    }
  }, []);

  useEffect(() => {
    document.body.classList.remove('light', 'orange', 'green');
    if (theme !== 'dark') {
        document.body.classList.add(theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Effect to combine exterior prompt parts
  useEffect(() => {
    if (activeTab === 'exterior') {
        const base = 'Ảnh chụp thực tế công trình';
        const additionalParts = [
            exteriorCustomPrompt,
            exteriorContext,
            exteriorLighting,
            exteriorTone
        ].filter(p => p && p.trim() !== '');

        let finalPrompt = base;
        if (additionalParts.length > 0) {
            finalPrompt += ', ' + additionalParts.join(', ');
        }
        
        setExteriorPrompt(finalPrompt);
    }
  }, [exteriorCustomPrompt, exteriorContext, exteriorLighting, exteriorTone, activeTab]);

  useEffect(() => {
    try {
      const storedExteriorHistory = localStorage.getItem('exteriorRenderHistory');
      if (storedExteriorHistory) setExteriorHistory(JSON.parse(storedExteriorHistory));

      const storedInteriorHistory = localStorage.getItem('interiorRenderHistory');
      if (storedInteriorHistory) setInteriorHistory(JSON.parse(storedInteriorHistory));

      const storedFloorplanHistory = localStorage.getItem('floorplanHistory');
      if (storedFloorplanHistory) setFloorplanHistory(JSON.parse(storedFloorplanHistory));

      const storedMasterplanHistory = localStorage.getItem('masterplanHistory');
      if (storedMasterplanHistory) setMasterplanHistory(JSON.parse(storedMasterplanHistory));

      const storedEditHistory = localStorage.getItem('editHistory');
      if (storedEditHistory) setEditHistory(JSON.parse(storedEditHistory));
      
      const storedUtilitiesHistory = localStorage.getItem('utilitiesHistory');
      if (storedUtilitiesHistory) setUtilitiesHistory(JSON.parse(storedUtilitiesHistory));

    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
  }, []);

  useEffect(() => {
    try {
        localStorage.setItem('exteriorRenderHistory', JSON.stringify(exteriorHistory));
    } catch (error) {
        console.error("Failed to save exterior render history to localStorage", error);
    }
  }, [exteriorHistory]);

  useEffect(() => {
    try {
        localStorage.setItem('interiorRenderHistory', JSON.stringify(interiorHistory));
    } catch (error) {
        console.error("Failed to save interior render history to localStorage", error);
    }
  }, [interiorHistory]);
  
  useEffect(() => {
    try {
        localStorage.setItem('floorplanHistory', JSON.stringify(floorplanHistory));
    } catch (error) {
        console.error("Failed to save floorplan history to localStorage", error);
    }
  }, [floorplanHistory]);

  useEffect(() => {
    try {
        localStorage.setItem('masterplanHistory', JSON.stringify(masterplanHistory));
    } catch (error) {
        console.error("Failed to save masterplan history to localStorage", error);
    }
  }, [masterplanHistory]);

  useEffect(() => {
    try {
        localStorage.setItem('editHistory', JSON.stringify(editHistory));
    } catch (error) {
        console.error("Failed to save edit history to localStorage", error);
    }
  }, [editHistory]);

  useEffect(() => {
    try {
        localStorage.setItem('utilitiesHistory', JSON.stringify(utilitiesHistory));
    } catch (error) {
        console.error("Failed to save utilities history to localStorage", error);
    }
  }, [utilitiesHistory]);


  // Update anglePrompt when switching tabs
  useEffect(() => {
    if (activeTab === 'exterior' || activeTab === 'interior' || activeTab === 'floorplan') {
      const newAngleOptions = (activeTab === 'interior' || activeTab === 'floorplan') ? interiorAngleOptions : exteriorAngleOptions;
      setAnglePrompt(newAngleOptions[0]);
    }
  }, [activeTab]);

  // Automatically update the floorplan prompt when room type or style changes
  useEffect(() => {
    if (activeTab === 'floorplan') {
        const basePrompt = 'Biến bản floorplan này thành ảnh render 3d nội thất. bám theo bố trí vật dụng và không gian của phòng theo mặt bằng đưa vào';
        setFloorplanPrompt(`${basePrompt}. Loại phòng: ${roomType}. Phong cách: ${roomStyle}.`);
    }
  }, [roomType, roomStyle, activeTab]);

  const handleImageUpload = async (image: SourceImage) => {
    setSourceImage(image);
    if (activeTab === 'interior') {
        setIsGeneratingDesc(true);
        setInteriorPrompt('');
        try {
            const description = await describeInteriorImage(image);
            setInteriorPrompt(description);
        } catch (error) {
            console.error("Failed to describe image:", error);
            alert("Không thể tự động tạo mô tả cho ảnh. Vui lòng nhập mô tả thủ công.");
        } finally {
            setIsGeneratingDesc(false);
        }
    }
  };

  const handleMasterplanImageUpload = async (image: SourceImage) => {
    setTabStates(p => ({...p, masterplan: {...p.masterplan, sourceImage: image}}));
    setIsGeneratingMasterplanDesc(true);
    setMasterplanPrompt('');
    try {
        const description = await describeMasterplanImage(image);
        setMasterplanPrompt(description);
    } catch (error) {
        console.error("Failed to describe masterplan image:", error);
        // Fallback to the default prompt
        setMasterplanPrompt('Ảnh chụp thực tế từ trên cao nhìn bao quát toàn bộ masterplan ven biển, thấy rõ đường bờ biển và khu resort chính.');
        alert("Không thể tự động tạo mô tả cho masterplan. Đã sử dụng mô tả mặc định, bạn có thể chỉnh sửa lại.");
    } finally {
        setIsGeneratingMasterplanDesc(false);
    }
  };
  
  const handleRemoveImage = () => {
    setSourceImage(null);
    setReferenceImage(null); // Also clear reference image
  }

  const handleGeneration = useCallback(async (prompt: string, renderType: RenderTab, isAnglePrompt: boolean, negativePrompt?: string) => {
    if (!sourceImage || !prompt) {
      alert("Vui lòng tải lên ảnh nguồn và nhập prompt.");
      return;
    }
    setIsLoading(true);
    setGeneratedImages([]);
    setSelectedImageIndex(0);
    try {
      const refImage = isAnglePrompt ? null : referenceImage;
      const images = await generateImages(sourceImage, prompt, renderType, numImages, aspectRatio, refImage, isAnglePrompt, false, negativePrompt);
      setGeneratedImages(images);
      
      const newHistoryItem: RenderHistoryItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        images: images,
        prompt: prompt,
      };
      
      if (renderType === 'exterior') {
        setExteriorHistory(prev => [newHistoryItem, ...prev]);
      } else if (renderType === 'interior') {
        setInteriorHistory(prev => [newHistoryItem, ...prev]);
      } else if (renderType === 'floorplan') {
        setFloorplanHistory(prev => [newHistoryItem, ...prev]);
      } else if (renderType === 'masterplan') {
        setMasterplanHistory(prev => [newHistoryItem, ...prev]);
      }

    } catch (error) {
      console.error("Image generation failed:", error);
      alert("Đã xảy ra lỗi khi tạo ảnh. Vui lòng kiểm tra API key và thử lại.");
    } finally {
      setIsLoading(false);
    }
  }, [sourceImage, referenceImage, numImages, aspectRatio]);

  const dataUrlToSourceImage = (dataUrl: string): SourceImage | null => {
    const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (match && match[1] && match[2]) {
        return { mimeType: match[1], base64: match[2] };
    }
    return null;
  }

  const handleUpscale = async (index: number, target: '2k' | '4k') => {
      const sourceDataUrl = generatedImages[index];
      if (!sourceDataUrl) return;

      const imageToUpscale = dataUrlToSourceImage(sourceDataUrl);
      if (!imageToUpscale) {
          alert("Định dạng ảnh không hợp lệ để upscale.");
          return;
      }

      setUpscalingIndex(index);
      try {
          const upscaledImage = await upscaleImage(imageToUpscale, target);
          if (upscaledImage) {
              const newGeneratedImages = [...generatedImages];
              newGeneratedImages[index] = upscaledImage;
              setGeneratedImages(newGeneratedImages);
              setUpscaledImageForModal(upscaledImage);
              
              const historyUpdaters = [setExteriorHistory, setInteriorHistory, setFloorplanHistory, setMasterplanHistory];
              historyUpdaters.forEach(setter => {
                  setter(prev => {
                      const newHistory = [...prev];
                      const historyItemIndex = newHistory.findIndex(item => item.images.includes(sourceDataUrl));
                      if (historyItemIndex > -1) {
                          const latestItem = { ...newHistory[historyItemIndex] };
                          const imageIndexInHistory = latestItem.images.findIndex(img => img === sourceDataUrl);
                          if (imageIndexInHistory > -1) {
                            const newImages = [...latestItem.images];
                            newImages[imageIndexInHistory] = upscaledImage;
                            latestItem.images = newImages;
                            newHistory[historyItemIndex] = latestItem;
                          }
                      }
                      return newHistory;
                  });
              });

          } else {
              throw new Error("Upscaling returned no image.");
          }
      } catch (error) {
          console.error(`Upscaling to ${target} failed:`, error);
          alert(`Đã xảy ra lỗi khi upscale ảnh lên ${target.toUpperCase()}. Vui lòng thử lại.`);
      } finally {
          setUpscalingIndex(null);
      }
  };

  const clearRenderHistory = (type: RenderTab) => {
    const typeName = {
        exterior: 'ngoại thất',
        interior: 'nội thất',
        floorplan: 'floorplan 3D',
        masterplan: 'masterplan 3D',
    }[type];
    if(window.confirm(`Bạn có chắc muốn xóa toàn bộ lịch sử render ${typeName}?`)) {
        if (type === 'exterior') setExteriorHistory([]);
        else if (type === 'interior') setInteriorHistory([]);
        else if (type === 'floorplan') setFloorplanHistory([]);
        else if (type === 'masterplan') setMasterplanHistory([]);
    }
  }
  
  const handleSelectRenderHistoryItem = (item: RenderHistoryItem, type: RenderTab) => {
      setTabStates(prev => ({
          ...prev,
          [type]: {
              ...prev[type],
              generatedImages: item.images,
              selectedImageIndex: 0,
          }
      }));
      setActiveTab(type);
  }

  const handleEditRequest = (imageUrl: string) => {
      const imageToEdit = dataUrlToSourceImage(imageUrl);
      if (imageToEdit) {
          setImageForEditing(imageToEdit);
          setActiveTab('edit');
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const handleChangeAngle = (index: number) => {
    const imageUrl = generatedImages[index];
    if (!imageUrl) return;
    
    const imageToUse = dataUrlToSourceImage(imageUrl);
    if (imageToUse) {
        setSourceImage(imageToUse);
        setReferenceImage(null); // Clear reference image as it's not relevant for angle change of a finished render
        if (activeTab === 'exterior' || activeTab === 'interior' || activeTab === 'floorplan') {
          angleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  };

  const handleFullscreen = (index: number) => {
    if (generatedImages.length > 0) {
      setFullscreenState({ images: generatedImages, startIndex: index });
    }
  };
  
  const handleStartNewRenderFlow = (image: SourceImage) => {
    setTabStates(prev => ({
        ...prev,
        exterior: {
            ...initialTabState,
            sourceImage: image,
        }
    }));
    setActiveTab('exterior');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditComplete = (details: Omit<EditHistoryItem, 'id' | 'timestamp'>) => {
    const newHistoryItem: EditHistoryItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        ...details
    };
    setEditHistory(prev => [newHistoryItem, ...prev]);
  };

  const clearEditHistory = () => {
    if(window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử chỉnh sửa?")) {
        setEditHistory([]);
    }
  };

  const handleSelectEditHistoryItem = (item: EditHistoryItem) => {
    setEditHistoryItemToRestore(item);
    setActiveTab('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUtilityGenerationComplete = (prompt: string, images: string[]) => {
    const newHistoryItem: RenderHistoryItem = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      images,
      prompt,
    };
    setUtilitiesHistory(prev => [newHistoryItem, ...prev]);
  };

  const clearUtilitiesHistory = () => {
    if (window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử tiện ích?")) {
      setUtilitiesHistory([]);
    }
  };
  
  const handlePredefinedInteriorPromptChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPrompt = event.target.value;
    if (selectedPrompt) {
        setInteriorPrompt(selectedPrompt);
    }
  };

  const handleAppendInteriorPrompt = (part: string) => {
    setInteriorPrompt(prev => {
        const trimmed = prev.trim();
        if (trimmed === '' || trimmed.endsWith(',')) {
            return `${trimmed} ${part}`;
        } else {
            return `${trimmed}, ${part}`;
        }
    });
  };

  const handleInteriorTonePresetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
        handleAppendInteriorPrompt(value);
        e.target.value = ""; // Reset to placeholder
    }
  };

  const handleAnglePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedAngle = event.target.value;
    if (selectedAngle) {
        setAnglePrompt(selectedAngle);
    }
  };

  const isBusy = isLoading || upscalingIndex !== null;
  const selectCommonStyles = "w-full bg-[var(--bg-surface-3)] p-3 rounded-md text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none appearance-none";
  
  const renderOptionsUI = (
    <div className="grid grid-cols-2 gap-4 my-4">
        <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Số lượng ảnh</label>
            <div className="flex items-center gap-2 bg-[var(--bg-surface-3)] rounded-md p-1">
                {[1, 2, 4].map(n => (
                    <button 
                        key={n}
                        onClick={() => setNumImages(n)}
                        className={`w-full text-sm font-semibold py-1.5 rounded-md transition-colors ${numImages === n ? 'bg-[var(--bg-interactive)] text-[var(--text-interactive)] shadow' : 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]'}`}
                    >
                        {n}
                    </button>
                ))}
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tỷ lệ khung hình</label>
            <select 
                value={aspectRatio} 
                onChange={(e) => setAspectRatio(e.target.value)} 
                className={selectCommonStyles}
                style={{
                    backgroundImage: 'var(--select-arrow-svg)',
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                }}
            >
                <option value="Auto">Tự động</option>
                <option value="1:1">1:1 (Vuông)</option>
                <option value="16:9">16:9 (Ngang)</option>
                <option value="9:16">9:16 (Dọc)</option>
                <option value="4:3">4:3 (Ngang)</option>
                <option value="3:4">3:4 (Dọc)</option>
            </select>
        </div>
    </div>
  );

  return (
    <>
      {!showApp && <LandingPage onEnter={() => setShowApp(true)} onQuickLink={handleQuickLink} />}
      {showApp &&
      <div className="min-h-screen p-8 fade-in-up">
        <header className="text-center mb-10 relative">
          <h1 className="text-3xl md:text-4xl font-bold tracking-wider text-[var(--text-primary)] uppercase font-montserrat">
            <span className="text-[var(--text-accent)]">NBOX.AI</span> RENDERING
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-3 tracking-widest">Created by Trần Minh Nhật - NBOX.AI - SĐT 0979.038.564</p>
          <div 
              className="absolute top-0 right-0"
              onMouseLeave={() => setIsThemeSelectorOpen(false)}
          >
              <div className="flex items-center justify-end bg-[var(--bg-surface-1)] border border-[var(--border-1)] rounded-full shadow-lg">
                  {/* Expanding options container */}
                  <div 
                      className={`flex items-center transition-all duration-300 ease-in-out overflow-hidden ${isThemeSelectorOpen ? 'max-w-md' : 'max-w-0'}`}
                  >
                      <div className="flex items-center gap-1 pl-3 pr-2 whitespace-nowrap">
                          {/* Dark */}
                          <button onClick={() => setTheme('dark')} className="group flex items-center gap-1.5 p-2 rounded-full hover:bg-[var(--bg-surface-2)] text-left text-[var(--text-primary)] transition-colors">
                              <Icon name="moon" className="w-5 h-5 text-indigo-400 transition-transform duration-200 ease-in-out group-hover:scale-125" />
                              <span className="font-semibold text-sm text-[var(--text-secondary)] transition-colors duration-200 group-hover:text-[var(--text-accent)]">Dark</span>
                          </button>
                          {/* Light */}
                          <button onClick={() => setTheme('light')} className="group flex items-center gap-1.5 p-2 rounded-full hover:bg-[var(--bg-surface-2)] text-left text-[var(--text-primary)] transition-colors">
                              <Icon name="sun" className="w-5 h-5 text-amber-500 transition-transform duration-200 ease-in-out group-hover:scale-125" />
                              <span className="font-semibold text-sm text-[var(--text-secondary)] transition-colors duration-200 group-hover:text-[var(--text-accent)]">Light</span>
                          </button>
                          {/* Orange */}
                          <button onClick={() => setTheme('orange')} className="group flex items-center gap-1.5 p-2 rounded-full hover:bg-[var(--bg-surface-2)] text-left text-[var(--text-primary)] transition-colors">
                              <Icon name="sparkles" className="w-5 h-5 text-orange-400 transition-transform duration-200 ease-in-out group-hover:scale-125" />
                              <span className="font-semibold text-sm text-[var(--text-secondary)] transition-colors duration-200 group-hover:text-[var(--text-accent)]">Orange</span>
                          </button>
                          {/* Green */}
                          <button onClick={() => setTheme('green')} className="group flex items-center gap-1.5 p-2 rounded-full hover:bg-[var(--bg-surface-2)] text-left text-[var(--text-primary)] transition-colors">
                              <Icon name="beaker" className="w-5 h-5 text-lime-400 transition-transform duration-200 ease-in-out group-hover:scale-125" />
                              <span className="font-semibold text-sm text-[var(--text-secondary)] transition-colors duration-200 group-hover:text-[var(--text-accent)]">Green</span>
                          </button>
                      </div>
                  </div>

                  {/* Trigger Button */}
                  <button
                      className="p-2 rounded-full hover:bg-[var(--bg-surface-2)] transition-colors flex-shrink-0 z-10"
                      aria-label="Change theme"
                      onMouseEnter={() => setIsThemeSelectorOpen(true)}
                  >
                      {theme === 'dark' && <Icon name="moon" className="w-6 h-6 text-indigo-400" />}
                      {theme === 'light' && <Icon name="sun" className="w-6 h-6 text-amber-500" />}
                      {theme === 'orange' && <Icon name="sparkles" className="w-6 h-6 text-orange-400" />}
                      {theme === 'green' && <Icon name="beaker" className="w-6 h-6 text-lime-400" />}
                  </button>
              </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto">
          <div className="relative border-b border-[var(--border-2)] mb-8">
            <div
                className="absolute bottom-[-1px] h-[calc(100%+1px)] bg-[var(--bg-surface-1)] border-b-2 border-[var(--border-accent)] rounded-t-lg transition-all duration-300 ease-out"
                style={indicatorStyle}
            />
            <div className="flex justify-center overflow-x-auto" role="tablist">
                 {TABS.map((tab, index) => (
                    <TabButton
                      key={tab.id}
                      ref={(el) => (tabRefs.current[index] = el)}
                      label={tab.label}
                      icon={tab.icon}
                      isActive={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                    />
                ))}
            </div>
          </div>

          <main>
            {/* Exterior Tab */}
            <div className={activeTab === 'exterior' ? 'fade-in-up' : 'hidden'}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-8">
                  <Section title="1. Tải Lên Ảnh Ngoại Thất">
                    <ImageUpload 
                        sourceImage={tabStates.exterior.sourceImage} 
                        onImageUpload={(img) => setTabStates(p => ({...p, exterior: {...p.exterior, sourceImage: img, referenceImage: null}}))} 
                        onRemove={() => setTabStates(p => ({...p, exterior: {...p.exterior, sourceImage: null, referenceImage: null}}))}
                    />
                  </Section>
                  <Section title="2. Mô Tả & Tùy Chọn">
                      <div className="space-y-4">
                          <ReferenceImageUpload 
                            image={tabStates.exterior.referenceImage}
                            onUpload={(img) => setTabStates(p => ({...p, exterior: {...p.exterior, referenceImage: img}}))}
                            onRemove={() => setTabStates(p => ({...p, exterior: {...p.exterior, referenceImage: null}}))}
                          />
                          <textarea
                              value={exteriorCustomPrompt}
                              onChange={(e) => setExteriorCustomPrompt(e.target.value)}
                              placeholder="Thêm mô tả tùy chỉnh (ví dụ: nhà 1 tầng, có gara...)"
                              className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-20 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none"
                          />
                          <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Bối cảnh</label>
                                <select onChange={(e) => setExteriorContext(e.target.value)} value={exteriorContext} className={`${selectCommonStyles} pr-10`} style={{backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em'}}>
                                    <option value="">Chọn một bối cảnh...</option>
                                    {exteriorContextOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Ánh sáng</label>
                                <select onChange={(e) => setExteriorLighting(e.target.value)} value={exteriorLighting} className={`${selectCommonStyles} pr-10`} style={{backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em'}}>
                                    <option value="">Chọn một loại ánh sáng...</option>
                                    {exteriorLightingOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tone màu</label>
                                <select onChange={(e) => setExteriorTone(e.target.value)} value={exteriorTone} className={`${selectCommonStyles} pr-10`} style={{backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em'}}>
                                    <option value="">Chọn một tone màu...</option>
                                    {exteriorToneOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div className="pt-2">
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Prompt cuối cùng:</label>
                                <div className="bg-[var(--bg-surface-4)]/50 p-3 rounded-md text-sm text-[var(--text-primary)] border border-[var(--border-2)] min-h-[5rem] select-all">{exteriorPrompt}</div>
                            </div>
                          </div>
                          {renderOptionsUI}
                          <button onClick={() => handleGeneration(exteriorPrompt, 'exterior', false)} disabled={isBusy || !tabStates.exterior.sourceImage} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                            <Icon name="sparkles" className="w-5 h-5" /> Tạo Ảnh Thực Tế
                          </button>
                      </div>
                  </Section>
                  <div ref={angleSectionRef}>
                    <Section title="3. Đổi Góc Chụp">
                      <div className="space-y-4">
                          <textarea value={anglePrompt} onChange={(e) => setAnglePrompt(e.target.value)} placeholder="Ví dụ: Góc chụp từ dưới lên (low angle)..." className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-24 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none" />
                          <select onChange={handleAnglePresetChange} value="" className={selectCommonStyles} style={{backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem'}}>
                            <option value="" disabled>Hoặc chọn một góc chụp có sẵn</option>
                            {exteriorAngleOptions.map(option => <option key={option} value={option}>{option}</option>)}
                          </select>
                          <button onClick={() => handleGeneration(anglePrompt, 'exterior', true)} disabled={isBusy || !tabStates.exterior.sourceImage} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                            <Icon name="sparkles" className="w-5 h-5" /> Tạo Góc Chụp Mới
                          </button>
                      </div>
                    </Section>
                  </div>
                </div>
                <div className="lg:col-span-2 flex flex-col gap-8">
                  <ResultDisplay sourceImage={tabStates.exterior.sourceImage} images={tabStates.exterior.generatedImages} isLoading={isLoading} onUpscale={(idx, tgt) => handleUpscale(idx, tgt)} upscalingIndex={upscalingIndex} onEditRequest={handleEditRequest} selectedImageIndex={tabStates.exterior.selectedImageIndex} onSelectImageIndex={(idx) => setTabStates(p => ({...p, exterior: {...p.exterior, selectedImageIndex: idx}}))} onChangeAngle={(idx) => handleChangeAngle(idx)} onFullscreen={(idx) => handleFullscreen(idx)} showChangeAngleButton={true}/>
                  <HistoryPanel title="Lịch Sử Render Ngoại Thất" history={exteriorHistory} onClear={() => clearRenderHistory('exterior')} onSelect={(item) => handleSelectRenderHistoryItem(item, 'exterior')}/>
                </div>
              </div>
            </div>
            
            {/* Interior Tab */}
            <div className={activeTab === 'interior' ? 'fade-in-up' : 'hidden'}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-8">
                  <Section title="1. Tải Lên Ảnh Nội Thất">
                    <ImageUpload 
                        sourceImage={tabStates.interior.sourceImage} 
                        onImageUpload={(img) => handleImageUpload(img)} 
                        onRemove={() => setTabStates(p => ({...p, interior: {...p.interior, sourceImage: null, referenceImage: null}}))}
                    />
                  </Section>
                  <Section title="2. Mô Tả & Tùy Chọn">
                    <div className="space-y-4">
                        <ReferenceImageUpload 
                          image={tabStates.interior.referenceImage}
                          onUpload={(img) => setTabStates(p => ({...p, interior: {...p.interior, referenceImage: img}}))}
                          onRemove={() => setTabStates(p => ({...p, interior: {...p.interior, referenceImage: null}}))}
                        />
                        <div className="relative">
                            <textarea value={interiorPrompt} onChange={(e) => setInteriorPrompt(e.target.value)} placeholder="AI sẽ tự động điền mô tả ảnh của bạn vào đây..." className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-24 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none" readOnly={isGeneratingDesc}/>
                            {isGeneratingDesc && <div className="absolute inset-0 bg-[var(--bg-surface-3)]/80 flex items-center justify-center rounded-md"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-slate-100"></div></div>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Negative Prompt (Yếu tố không mong muốn)</label>
                            <textarea
                                value={interiorNegativePrompt}
                                onChange={(e) => setInteriorNegativePrompt(e.target.value)}
                                placeholder="ví dụ: ảnh sketch, hoạt hình, ảnh giả, chữ viết..."
                                className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-20 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none"
                            />
                        </div>
                        <select onChange={handlePredefinedInteriorPromptChange} value="" className={selectCommonStyles} style={{backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem'}}>
                            <option value="" disabled>Hoặc chọn một prompt có sẵn</option>
                            {interiorPredefinedPrompts.map(prompt => <option key={prompt} value={prompt}>{prompt}</option>)}
                        </select>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tone màu</label>
                            <select onChange={handleInteriorTonePresetSelect} defaultValue="" className={`${selectCommonStyles} pr-10`} style={{backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em'}}>
                                <option value="" disabled>Chọn một tone màu...</option>
                                {interiorToneOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        {renderOptionsUI}
                        <button onClick={() => handleGeneration(interiorPrompt, 'interior', false, interiorNegativePrompt)} disabled={isBusy || !tabStates.interior.sourceImage} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                          <Icon name="sparkles" className="w-5 h-5" /> Tạo Ảnh Thực Tế
                        </button>
                    </div>
                  </Section>
                  <div ref={angleSectionRef}>
                    <Section title="3. Đổi Góc Chụp">
                      <div className="space-y-4">
                          <textarea value={anglePrompt} onChange={(e) => setAnglePrompt(e.target.value)} placeholder="Ví dụ: Góc chụp từ trên cao nhìn xuống..." className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-24 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none" />
                          <select onChange={handleAnglePresetChange} value="" className={selectCommonStyles} style={{backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem'}}>
                            <option value="" disabled>Hoặc chọn một góc chụp có sẵn</option>
                            {interiorAngleOptions.map(option => <option key={option} value={option}>{option}</option>)}
                          </select>
                          <button onClick={() => handleGeneration(anglePrompt, 'interior', true, interiorNegativePrompt)} disabled={isBusy || !tabStates.interior.sourceImage} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                            <Icon name="sparkles" className="w-5 h-5" /> Tạo Góc Chụp Mới
                          </button>
                      </div>
                    </Section>
                  </div>
                </div>
                <div className="lg:col-span-2 flex flex-col gap-8">
                  <ResultDisplay sourceImage={tabStates.interior.sourceImage} images={tabStates.interior.generatedImages} isLoading={isLoading} onUpscale={(idx, tgt) => handleUpscale(idx, tgt)} upscalingIndex={upscalingIndex} onEditRequest={handleEditRequest} selectedImageIndex={tabStates.interior.selectedImageIndex} onSelectImageIndex={(idx) => setTabStates(p => ({...p, interior: {...p.interior, selectedImageIndex: idx}}))} onChangeAngle={(idx) => handleChangeAngle(idx)} onFullscreen={(idx) => handleFullscreen(idx)} showChangeAngleButton={true}/>
                  <HistoryPanel title="Lịch Sử Render Nội Thất" history={interiorHistory} onClear={() => clearRenderHistory('interior')} onSelect={(item) => handleSelectRenderHistoryItem(item, 'interior')}/>
                </div>
              </div>
            </div>

            {/* Floorplan Tab */}
            <div className={activeTab === 'floorplan' ? 'fade-in-up' : 'hidden'}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-8">
                  <Section title="1. Tải Lên Floorplan">
                    <ImageUpload 
                        sourceImage={tabStates.floorplan.sourceImage} 
                        onImageUpload={(img) => setTabStates(p => ({...p, floorplan: {...p.floorplan, sourceImage: img}}))} 
                        onRemove={() => setTabStates(p => ({...p, floorplan: {...p.floorplan, sourceImage: null, referenceImage: null}}))}
                    />
                  </Section>
                  <Section title="2. Tùy Chọn & Mô Tả">
                      <div className="space-y-4">
                          <ReferenceImageUpload 
                              image={tabStates.floorplan.referenceImage}
                              onUpload={(img) => setTabStates(p => ({...p, floorplan: {...p.floorplan, referenceImage: img}}))}
                              onRemove={() => setTabStates(p => ({...p, floorplan: {...p.floorplan, referenceImage: null}}))}
                          />
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Loại phòng</label>
                                  <select value={roomType} onChange={(e) => setRoomType(e.target.value)} className={selectCommonStyles} >
                                      {roomTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Phong cách</label>
                                  <select value={roomStyle} onChange={(e) => setRoomStyle(e.target.value)} className={selectCommonStyles}>
                                      {roomStyleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                              </div>
                          </div>
                          <textarea value={floorplanPrompt} onChange={(e) => setFloorplanPrompt(e.target.value)} className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-24 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none"/>
                          {renderOptionsUI}
                          <button onClick={() => handleGeneration(floorplanPrompt, 'floorplan', false)} disabled={isBusy || !tabStates.floorplan.sourceImage} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                            <Icon name="sparkles" className="w-5 h-5" /> Tạo Ảnh 3D
                          </button>
                      </div>
                  </Section>
                  <div ref={angleSectionRef}>
                    <Section title="3. Đổi Góc Chụp">
                      <div className="space-y-4">
                          <textarea value={anglePrompt} onChange={(e) => setAnglePrompt(e.target.value)} placeholder="Ví dụ: Góc chụp từ trên cao nhìn xuống..." className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-24 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none" />
                          <select onChange={handleAnglePresetChange} value="" className={selectCommonStyles} style={{backgroundImage: 'var(--select-arrow-svg)', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem'}}>
                            <option value="" disabled>Hoặc chọn một góc chụp có sẵn</option>
                            {interiorAngleOptions.map(option => <option key={option} value={option}>{option}</option>)}
                          </select>
                          <button onClick={() => handleGeneration(anglePrompt, 'floorplan', true)} disabled={isBusy || !tabStates.floorplan.sourceImage} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                            <Icon name="sparkles" className="w-5 h-5" /> Tạo Góc Chụp Mới
                          </button>
                      </div>
                    </Section>
                  </div>
                </div>
                <div className="lg:col-span-2 flex flex-col gap-8">
                  <ResultDisplay sourceImage={tabStates.floorplan.sourceImage} images={tabStates.floorplan.generatedImages} isLoading={isLoading} onUpscale={(idx, tgt) => handleUpscale(idx, tgt)} upscalingIndex={upscalingIndex} onEditRequest={handleEditRequest} selectedImageIndex={tabStates.floorplan.selectedImageIndex} onSelectImageIndex={(idx) => setTabStates(p => ({...p, floorplan: {...p.floorplan, selectedImageIndex: idx}}))} onChangeAngle={(idx) => handleChangeAngle(idx)} onFullscreen={(idx) => handleFullscreen(idx)} showChangeAngleButton={true}/>
                  <HistoryPanel title="Lịch Sử Floorplan 3D" history={floorplanHistory} onClear={() => clearRenderHistory('floorplan')} onSelect={(item) => handleSelectRenderHistoryItem(item, 'floorplan')}/>
                </div>
              </div>
            </div>

            {/* Masterplan Tab */}
            <div className={activeTab === 'masterplan' ? 'fade-in-up' : 'hidden'}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-8">
                  <Section title="1. Tải Lên Masterplan 2D">
                    <ImageUpload 
                        sourceImage={tabStates.masterplan.sourceImage} 
                        onImageUpload={handleMasterplanImageUpload} 
                        onRemove={() => setTabStates(p => ({...p, masterplan: {...p.masterplan, sourceImage: null}}))}
                    />
                  </Section>
                  <Section title="2. Mô Tả & Tùy Chọn">
                      <div className="space-y-4">
                          <div className="relative">
                            <textarea value={masterplanPrompt} onChange={(e) => setMasterplanPrompt(e.target.value)} className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-24 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none" readOnly={isGeneratingMasterplanDesc}/>
                            {isGeneratingMasterplanDesc && (
                              <div className="absolute inset-0 bg-[var(--bg-surface-3)]/80 flex items-center justify-center rounded-md">
                                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-slate-100"></div>
                              </div>
                            )}
                          </div>
                          {renderOptionsUI}
                          <button onClick={() => handleGeneration(masterplanPrompt, 'masterplan', false)} disabled={isBusy || !tabStates.masterplan.sourceImage} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                            <Icon name="sparkles" className="w-5 h-5" /> Tạo Ảnh 3D
                          </button>
                      </div>
                  </Section>
                </div>
                <div className="lg:col-span-2 flex flex-col gap-8">
                  <ResultDisplay sourceImage={tabStates.masterplan.sourceImage} images={tabStates.masterplan.generatedImages} isLoading={isLoading} onUpscale={(idx, tgt) => handleUpscale(idx, tgt)} upscalingIndex={upscalingIndex} onEditRequest={handleEditRequest} selectedImageIndex={tabStates.masterplan.selectedImageIndex} onSelectImageIndex={(idx) => setTabStates(p => ({...p, masterplan: {...p.masterplan, selectedImageIndex: idx}}))} onChangeAngle={(idx) => handleChangeAngle(idx)} onFullscreen={(idx) => handleFullscreen(idx)} showChangeAngleButton={false}/>
                  <HistoryPanel title="Lịch Sử Masterplan 3D" history={masterplanHistory} onClear={() => clearRenderHistory('masterplan')} onSelect={(item) => handleSelectRenderHistoryItem(item, 'masterplan')}/>
                </div>
              </div>
            </div>
            
            <div className={activeTab === 'virtual_tour' ? 'fade-in-up' : 'hidden'}>
              <VirtualTourTab setActiveTab={setActiveTab} setImageForEditing={setImageForEditing} setVideoTabSourceImage={() => {}}/>
            </div>

            <div className={activeTab === 'edit' ? 'fade-in-up' : 'hidden'}>
              <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-4 gap-8">
                  <div className="lg:col-span-3">
                      <ImageEditor initialImage={imageForEditing} onClearInitialImage={() => setImageForEditing(null)} onEditComplete={handleEditComplete} historyItemToRestore={editHistoryItemToRestore} onHistoryRestored={() => setEditHistoryItemToRestore(null)} />
                  </div>
                  <div className="lg:col-span-1">
                      <EditHistoryPanel history={editHistory} onClear={clearEditHistory} onSelect={handleSelectEditHistoryItem}/>
                  </div>
              </div>
            </div>
            
            <div className={activeTab === 'utilities' ? 'fade-in-up' : 'hidden'}>
              <UtilitiesTab 
                onEditRequest={handleEditRequest}
                onStartNewRenderFlow={handleStartNewRenderFlow}
                promptFinderImage={promptFinderImage} 
                setPromptFinderImage={setPromptFinderImage} 
                promptFinderPrompts={promptFinderPrompts} 
                setPromptFinderPrompts={setPromptFinderPrompts}
                history={utilitiesHistory}
                onClearHistory={clearUtilitiesHistory}
                onGenerationComplete={handleUtilityGenerationComplete}
              />
            </div>
          </main>
        </div>
        
        {upscaledImageForModal && (
          <UpscaleModal imageUrl={upscaledImageForModal} onClose={() => setUpscaledImageForModal(null)} />
        )}
        {fullscreenState && (
          <ImageViewerModal images={fullscreenState.images} startIndex={fullscreenState.startIndex} onClose={() => setFullscreenState(null)}/>
        )}
      </div>
    }
  </>
  );
}
