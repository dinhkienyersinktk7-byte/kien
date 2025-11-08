import React, { useState, useCallback, useRef, useEffect, useImperativeHandle } from 'react';
import { Icon } from './icons';
import type { SourceImage, GeneratedPrompts, RenderHistoryItem } from '../types';
import { generateImages, generateImageFromText, generatePromptsFromImage, generateMoodImages, generateVideo, generateCompletionPrompts, generateInteriorCompletionPrompts } from '../services/geminiService';

const dataUrlToSourceImage = (dataUrl: string): SourceImage | null => {
    const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (match && match[1] && match[2]) {
        return { mimeType: match[1], base64: match[2] };
    }
    return null;
}

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

// --- Reusable Components (Copied from App.tsx for encapsulation) ---

const Section: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="bg-[var(--bg-surface-1)] backdrop-blur-md border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h2>
        {children}
    </div>
);

const ImageUpload: React.FC<{
    sourceImage: SourceImage | null;
    onImageUpload: (image: SourceImage) => void;
    onRemove: () => void;
    title?: string;
    heightClass?: string;
}> = ({ sourceImage, onImageUpload, onRemove, title = "Nhấp hoặc kéo tệp vào đây", heightClass = 'h-48' }) => {
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
        if (file) processFile(file);
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
        if (file) processFile(file);
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove();
    }

    return (
        <div>
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative group border-2 border-dashed rounded-lg p-4 flex items-center justify-center ${heightClass} mb-4 hover:border-[var(--border-interactive)] transition-colors cursor-pointer ${isDraggingOver ? 'border-[var(--border-interactive)] bg-[var(--bg-surface-2)]' : 'border-[var(--border-2)]'}`}
                onClick={() => fileInputRef.current?.click()}
            >
                {sourceImage ? (
                    <>
                        <img src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} alt="Source" className="max-h-full max-w-full object-contain rounded" />
                        <button onClick={handleRemove} className="absolute top-1 right-1 bg-black/50 rounded-full text-white hover:bg-black/80 p-0.5 transition-colors opacity-0 group-hover:opacity-100 z-10" aria-label="Remove source image">
                            <Icon name="x-circle" className="w-5 h-5" />
                        </button>
                    </>
                ) : (
                    <div className="text-center text-[var(--text-secondary)] pointer-events-none">
                        <p>{title}</p>
                        <p className="text-xs">PNG, JPG, WEBP</p>
                    </div>
                )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
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
        if (file) processFile(file);
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
        if (file) processFile(file);
    };

    if (image) {
        return (
          <div className="relative group">
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Ảnh tham khảo (Tùy chọn)</p>
            <img src={`data:${image.mimeType};base64,${image.base64}`} alt="Reference" className="w-full h-40 object-cover rounded-md" />
            <button
              onClick={onRemove}
              className="absolute top-8 right-1 bg-black/50 rounded-full text-white hover:bg-black/80 p-0.5 transition-colors opacity-0 group-hover:opacity-100 z-10"
              aria-label="Remove reference image"
            >
              <Icon name="x-circle" className="w-5 h-5" />
            </button>
          </div>
        );
    }
    return (
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Ảnh tham khảo (Tùy chọn)</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full border-2 border-dashed rounded-lg p-4 flex items-center justify-center h-40 text-center text-[var(--text-secondary)] text-sm hover:border-[var(--border-interactive)] transition-colors ${isDraggingOver ? 'border-[var(--border-interactive)] bg-[var(--bg-surface-2)]' : 'border-[var(--border-2)]'}`}
          >
            + Thêm ảnh tham khảo (Style/Mood)
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
        </div>
    );
}

const ImageViewerModal: React.FC<{
  imageUrl: string;
  onClose: () => void;
  onEdit: () => void;
  onUseAsSource: () => void;
}> = ({ imageUrl, onClose, onEdit, onUseAsSource }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface-4)]/80 backdrop-blur-lg border border-[var(--border-1)] rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-[var(--bg-interactive)] text-[var(--text-interactive)] rounded-full p-2 hover:bg-[var(--bg-interactive-hover)] transition-transform duration-200 hover:scale-110 z-20"
          aria-label="Close"
        >
          <Icon name="x-mark" className="w-6 h-6" />
        </button>
        <div className="p-2 flex-grow overflow-auto flex items-center justify-center">
            <img src={imageUrl} alt="Fullscreen view" className="max-w-full max-h-full object-contain rounded-md" />
        </div>
        <div className="flex-shrink-0 p-4 border-t border-[var(--border-2)] flex items-center justify-center gap-4">
            <a
                href={imageUrl}
                download={`nbox-ai-generated-${Date.now()}.png`}
                className="bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
                <Icon name="download" className="w-5 h-5" /> Tải về
            </a>
            <button
                onClick={onEdit}
                className="bg-[var(--bg-surface-3)] hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
                <Icon name="pencil" className="w-5 h-5" /> Sửa ảnh này
            </button>
            <button
                onClick={onUseAsSource}
                className="bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
                <Icon name="photo" className="w-5 h-5" /> Dùng làm ảnh Render mới
            </button>
        </div>
      </div>
    </div>
  );
};

// --- Task Definitions ---

type TaskService = 'generateImageFromText' | 'generateImages' | 'generateImagesWithReference' | 'generateTwoImages';

interface PredefinedPrompt {
    label: string;
    value: string;
}

interface UtilityTaskDef {
    id: string;
    name: string;
    description: string;
    icon: string;
    inputs?: 0 | 1 | 2;
    hasOptionalReferenceImage?: boolean;
    inputLabels?: string[];
    promptPlaceholder?: string;
    service?: TaskService;
    renderType?: 'exterior' | 'interior' | 'floorplan' | 'masterplan' | 'concept';
    promptEngineer?: (prompt: string, hasReferenceImage: boolean) => string;
    predefinedPrompts?: PredefinedPrompt[];
    isCustomComponent?: boolean;
}

const UTILITY_TASKS: UtilityTaskDef[] = [
    {
        id: 'finish_construction',
        name: 'Hoàn Thiện Công Trình',
        description: 'Tải lên ảnh công trình đang thi công, AI sẽ gợi ý 10 style hoàn thiện và render kết quả.',
        icon: 'check-circle',
        isCustomComponent: true,
    },
    {
        id: 'finish_interior',
        name: 'Hoàn Thiện Nội Thất',
        description: 'Tải lên ảnh phòng trống, AI sẽ gợi ý 10 style nội thất và render kết quả tương ứng.',
        icon: 'home',
        isCustomComponent: true,
    },
    {
        id: 'prompt_finder', 
        name: 'Dò Prompt từ Ảnh Gốc', 
        description: 'Tải lên một ảnh công trình, AI sẽ tự động gợi ý các prompt cho nhiều góc chụp đa dạng (cận cảnh, trung cảnh, nội thất).', 
        icon: 'viewfinder',
        isCustomComponent: true,
    },
    {
        id: 'mood_board',
        name: 'Tạo Mood Cho Render',
        description: 'Tải lên 1 ảnh sketch, AI sẽ tạo 4 kết quả render với 4 loại ánh sáng khác nhau: Sáng, Trưa, Hoàng Hôn, và Tối.',
        icon: 'sun',
        isCustomComponent: true,
    },
    {
        id: 'video_generator',
        name: 'Tạo Video từ Ảnh',
        description: 'Tải lên ảnh tĩnh và mô tả để tạo ra một video ngắn. Phù hợp cho việc diễn hoạt kiến trúc.',
        icon: 'film',
        isCustomComponent: true,
    },
    {
        id: 'google_map_topview',
        name: 'Tạo ảnh topview thực tế từ google map',
        description: 'Đưa ảnh chụp topview từ google vào app sẽ biến thành ảnh thực tế.',
        icon: 'cube',
        inputs: 1,
        inputLabels: ['Ảnh Google Map (Top-down)'],
        service: 'generateImages',
        renderType: 'masterplan',
        promptPlaceholder: 'Mô tả thêm về style, ánh sáng mong muốn...',
        promptEngineer: (p: string) => `You are an expert 3D architectural visualizer. Your task is to convert the provided 2D top-down map image into a photorealistic 3D top-down (bird's-eye view) render. Accurately represent the shapes of buildings, roads, and green spaces as 3D objects. The user's specific request is: '${p}'`,
        predefinedPrompts: [{
            label: 'Prompt Mẫu',
            value: 'Create a realistic 3D scene from this image. Include natural lighting, authentic textures, and a sense of atmospheric depth'
        }]
    },
    {
        id: 'google_map_perspective',
        name: 'Tạo ảnh phối cảnh thực tế từ google map',
        description: 'Đưa ảnh chụp từ google vào app sẽ biến thành ảnh thực tế.',
        icon: 'viewfinder',
        inputs: 1,
        inputLabels: ['Ảnh Google Map'],
        service: 'generateImages',
        renderType: 'masterplan',
        promptPlaceholder: 'Mô tả thêm về góc chụp, bối cảnh...',
        promptEngineer: (p: string) => `You are an expert 3D architectural visualizer. Your task is to interpret the provided 2D map image as a layout plan and convert it into a photorealistic 3D perspective or aerial (drone) shot. Generate a realistic scene based on the map's layout of buildings and landscape. The user's specific request for the style and camera angle is: '${p}'`,
        predefinedPrompts: [{
            label: 'Prompt Mẫu',
            value: 'Dynamic aerial landscape (drone shot), perspective view, sharp focus, high quality, a row of houses surrounded by trees. Add distant city or hills as the backdrop, soft overcast lighting'
        }]
    },
    {
        id: 'place_furniture', name: 'Ghép Nội Thất vào Phòng', description: 'Tải lên ảnh phòng và ảnh đồ nội thất để AI tự động ghép chúng lại với nhau.', icon: 'cube',
        inputs: 2, inputLabels: ['Ảnh Căn Phòng', 'Ảnh Đồ Nội Thất'], service: 'generateImagesWithReference', renderType: 'interior', promptPlaceholder: 'Ví dụ: sắp xếp đồ đạc một cách hợp lý, giữ nguyên style phòng',
        promptEngineer: (p: string) => `You are an expert interior designer and photo editor. The user has provided two images. The first image is the main room scene. The second image contains various pieces of furniture (likely with a plain background). Your task is to realistically place all the furniture items from the second image into the room shown in the first image. Pay attention to scale, lighting, shadows, and perspective to make the composition look natural and photorealistic. The user's specific instructions are: '${p}'.`,
        predefinedPrompts: [{
            label: 'Ghép đồ nội thất vào phòng',
            value: 'Place all these furniture into the scene in img1'
        }]
    },
    {
        id: 'change_interior_style',
        name: 'Đổi Style Nội Thất',
        description: 'Giữ nguyên bố cục phòng, áp dụng style mới qua mô tả hoặc ảnh tham khảo.',
        icon: 'arrows-right-left',
        inputs: 1,
        hasOptionalReferenceImage: true,
        inputLabels: ['Ảnh Phòng Gốc'],
        service: 'generateImages',
        renderType: 'interior',
        promptPlaceholder: 'Ví dụ: phong cách Scandinavian với tông màu sáng',
        promptEngineer: (p: string) => `You are an expert interior designer. The user has provided an image of a room. Your task is to completely change its interior design style based on the user's prompt, while preserving the original room's core structure, layout, and window/door placements. The prompt is: '${p}'.`,
        predefinedPrompts: [
            { label: 'Phong cách Tối giản (Minimalism)', value: 'đổi style của căn phòng này thành phong cách Tối giản (Minimalism) với tông màu trung tính và vật liệu tự nhiên.' },
            { label: 'Phong cách Hiện đại (Modern)', value: 'đổi style của căn phòng này thành phong cách Hiện đại (Modern) với đường nét sạch sẽ, màu sắc đơn giản và kim loại.' },
            { label: 'Phong cách Bắc Âu (Scandinavian)', value: 'đổi style của căn phòng này thành phong cách Bắc Âu (Scandinavian) sử dụng gỗ sồi sáng màu, tường trắng và nhiều ánh sáng tự nhiên.' },
            { label: 'Phong cách Công nghiệp (Industrial)', value: 'đổi style của căn phòng này thành phong cách Công nghiệp (Industrial) với tường gạch thô, sàn bê tông và nội thất kim loại.' },
            { label: 'Phong cách Wabi-sabi', value: 'đổi style của căn phòng này thành phong cách Wabi-sabi, tập trung vào vẻ đẹp không hoàn hảo, vật liệu thô mộc và sự tĩnh lặng.' },
            { label: 'Phong cách Bohemian', value: 'đổi style của căn phòng này thành phong cách Bohemian với nhiều họa tiết, cây xanh và đồ trang trí thủ công.' },
            { label: 'Phong cách Tân cổ điển (Neoclassical)', value: 'đổi style của căn phòng này thành phong cách Tân cổ điển (Neoclassical) với các đường phào chỉ, đồ nội thất sang trọng và đối xứng.' },
            { label: 'Phong cách Coastal (Ven biển)', value: 'đổi style của căn phòng này thành phong cách Coastal (Ven biển) với tông màu xanh dương và trắng, vật liệu tự nhiên như mây, tre.' },
            { label: 'Phong cách Mid-Century Modern', value: 'đổi style của căn phòng này thành phong cách Mid-Century Modern với đồ nội thất có chân mảnh, hình dáng hữu cơ và màu sắc đậm.' },
            { label: 'Phong cách Art Deco', value: 'đổi style của căn phòng này thành phong cách Art Deco sang trọng với các chi tiết kim loại vàng, hình học và vật liệu cao cấp như nhung, đá cẩm thạch.' },
            { label: 'Phong cách Đông Dương (Indochine)', value: 'đổi style của căn phòng này thành phong cách Đông Dương (Indochine) kết hợp giữa nét hoài cổ của Á Đông và sự lãng mạn của Pháp, sử dụng vật liệu gỗ, tre, nứa và các họa tiết kỷ hà.' },
            { label: 'Phong cách Cổ điển (Classic)', value: 'đổi style của căn phòng này thành phong cách Cổ điển (Classic) với đồ nội thất cầu kỳ, chạm khắc tinh xảo, vật liệu cao cấp như gỗ gụ, da, và các chi tiết mạ vàng.' }
        ]
    },
    {
        id: 'change_style', name: 'Đổi Style Công Trình', description: 'Giữ nguyên hình khối kiến trúc từ ảnh gốc, nhưng áp dụng một phong cách hoàn toàn mới thông qua mô tả.', icon: 'arrows-right-left',
        inputs: 1, inputLabels: ['Ảnh Công Trình Gốc'], service: 'generateImages', renderType: 'exterior', promptPlaceholder: 'Ví dụ: đổi thành phong cách Zaha Hadid',
        promptEngineer: (p: string) => `You are an expert architectural visualizer. The user has provided an image of a building. Your task is to completely change its architectural style based on the user's prompt, while preserving the original building's core shape, massing, and general proportions. The prompt is: '${p}'.`,
        predefinedPrompts: [
            { label: 'Phong cách Zaha Hadid (cong, lượn sóng)', value: 'Apply the style of Zaha Hadid, characterized by fluid, organic, and futuristic curves.' },
            { label: 'Phong cách Tadao Ando (bê tông tối giản)', value: 'Apply the style of Tadao Ando, featuring minimalist aesthetics with smooth concrete and emphasis on natural light.' },
            { label: 'Phong cách Frank Gehry (phá cấu trúc)', value: 'Apply the style of Frank Gehry, known for deconstructivism and fragmented, sculptural forms.' },
            { label: 'Phong cách Nhiệt đới Hiện đại', value: 'Apply a Tropical Modern style with natural materials like wood and stone, large openings, and integration with lush greenery.' },
            { label: 'Phong cách Nhà ống Việt Nam', value: 'Apply the style of a classic Vietnamese tube house, characterized by a narrow facade, multiple stories, and functional design.' },
            { label: 'Phong cách Art Deco (Hình học, trang trí)', value: 'Apply an Art Deco architectural style, featuring bold geometric patterns, lavish ornamentation, and a sleek, linear appearance.' },
            { label: 'Phong cách Brutalist (Bê tông trần khối)', value: 'Apply a Brutalist architectural style, characterized by raw, exposed concrete, massive blocky forms, and a monolithic, imposing presence.' },
            { label: 'Phong cách Gothic Revival (Vòm nhọn, trang trí)', value: 'Apply a Gothic Revival architectural style, with features like pointed arches, ornate decorations, steep roofs, and a strong vertical emphasis.' },
            { label: 'Phong cách Tân cổ điển (Cột, đối xứng)', value: 'Apply a Neoclassical architectural style, defined by a grand scale, symmetrical shapes, and the prominent use of columns and classical details like pediments.' },
            { label: 'Phong cách Biophilic (Hòa hợp thiên nhiên)', value: 'Apply a Biophilic design style, integrating abundant natural elements like living green walls, large windows for daylight, and natural materials to connect the building with nature.' },
            { label: 'Phong cách Parametric (Thuật toán, hữu cơ)', value: 'Apply a Parametricism style, using advanced computational design to create fluid, complex, and dynamic geometric forms that appear algorithmically generated.' },
            { label: 'Phong cách Deconstructivist (Phá cấu trúc, phi tuyến tính)', value: 'Apply a Deconstructivist style, characterized by fragmentation, distorted shapes, and a non-linear, controlled chaos in its appearance.' }
        ]
    },
    {
        id: 'change_material',
        name: 'Đổi vật liệu, màu sơn',
        description: 'Tải lên ảnh gốc, ảnh vật liệu tham khảo và mô tả để thay đổi vật liệu, màu sắc cho đối tượng.',
        icon: 'brush',
        inputs: 1,
        hasOptionalReferenceImage: true,
        inputLabels: ['Ảnh Gốc (Công trình / Nội thất)'],
        service: 'generateImages',
        renderType: 'exterior',
        promptPlaceholder: 'Ví dụ: đổi bức tường thành gạch đỏ, hoặc: đổi sàn thành vật liệu này',
        promptEngineer: (p: string, hasRef: boolean) => {
            if (hasRef) {
                return `You are an expert photo editor. You are given a source image, a reference image with a material/texture, and a user prompt. Your task is to apply the material/texture from the reference image onto the object described in the user's prompt within the source image. The user's prompt is: '${p}'. For example, if the prompt says "change the wall to this material," apply the texture from the reference image to the main wall in the source image. Blend the new material realistically, paying close attention to lighting, perspective, and shadows. Keep the rest of the image unchanged.`;
            } else {
                return `You are an expert photo editor. You are given a source image and a user prompt. Your task is to change the material or color of the object described in the user's prompt within the source image. The user's prompt is: '${p}'. For example, if the prompt says "change the main wall to red brick," you must change the main wall to be made of red brick. Blend the new material realistically, paying close attention to lighting, perspective, and shadows. Keep the rest of the image unchanged.`;
            }
        },
        predefinedPrompts: [
            { label: 'Đổi tường thành gạch đỏ', value: 'đổi bức tường chính thành gạch thẻ màu đỏ' },
            { label: 'Đổi sàn thành gỗ', value: 'đổi toàn bộ sàn nhà thành sàn gỗ sồi' },
            { label: 'Sơn lại nhà màu trắng', value: 'sơn lại toàn bộ ngoại thất ngôi nhà thành màu trắng kem' },
        ]
    },
    {
        id: 'insert_building', name: 'Chèn công trình vào hiện trạng', description: 'Ghép ảnh công trình của bạn vào một bức ảnh nền hiện trạng một cách chân thực.', icon: 'photo',
        inputs: 2, inputLabels: ['Ảnh Hiện Trạng', 'Ảnh Công Trình (nền trắng)'], service: 'generateImagesWithReference', renderType: 'exterior', promptPlaceholder: 'Ví dụ: đặt vào khu đất trống, điều chỉnh ánh sáng cho phù hợp, bóng đổ mềm',
        promptEngineer: (p: string) => `You are an expert architectural visualizer and photo editor. The user has provided two images. The first image is a photo of the existing site/location. The second image is an architectural building, likely with a plain background. Your task is to seamlessly photoshop the building from the second image into the site from the first image. Pay close attention to scale, perspective, lighting, and shadows to make the composition look photorealistic. The user's specific instructions are: "${p}".`,
        predefinedPrompts: [{
            label: 'Ghép nhà vào khu đất trống',
            value: 'Place the house in img 2 into the red zone in the img 1. and turn it into a real photo'
        },
        {
            label: 'Ghép ảnh 2D thành ảnh 3D',
            value: 'Place the 2d photo in img 2 into the red zone in the img 1. and turn it into a 3d real photo'
        }]
    },
    {
        id: 'perspective_from_plan', name: 'Tạo phối cảnh từ tổng thể', description: 'Tải lên bản vẽ tổng thể (đánh dấu hướng nhìn) và ảnh tham khảo góc chụp để tạo phối cảnh.', icon: 'viewfinder',
        inputs: 2, inputLabels: ['Bản vẽ tổng thể (có đánh dấu)', 'Ảnh tham khảo góc chụp'], service: 'generateImagesWithReference', renderType: 'masterplan', promptPlaceholder: 'Ví dụ: render 3D, phong cách hiện đại, buổi chiều nắng',
        promptEngineer: (p: string) => `The user has provided two images. The first image is a 2D master plan that includes a hand-drawn red arrow indicating a specific camera position and general viewing direction. The second image is a reference photo that dictates the desired camera angle, lens, and shot composition (e.g., eye-level, low-angle, drone view). Your task is to generate a photorealistic 3D perspective. Use the red arrow on the first image to determine the camera's LOCATION. Use the second image as a strict reference for the CAMERA ANGLE and SHOT TYPE. Create a full 3D scene based on the layout in the plan. The user's specific request for style and mood is: "${p}".`,
         predefinedPrompts: [{
            label: 'View từ vòng tròn, góc cam theo ảnh tham khảo',
            value: 'Create a view from the location indicated by the red arrow, but use the camera angle and shot style from the reference image.'
        }]
    },
    {
        id: '3d_to_2d', name: 'Biến ảnh 3D thành bản vẽ 2D', description: 'Chuyển đổi một ảnh render 3D thành một bản vẽ kỹ thuật dạng đường nét.', icon: 'pencil',
        inputs: 1, inputLabels: ['Ảnh Render 3D'], service: 'generateImages', renderType: 'exterior', promptPlaceholder: 'Ví dụ: bản vẽ mặt đứng chính diện, nét mảnh',
        promptEngineer: (p) => `Chuyển đổi hình ảnh 3D siêu thực này thành một bản vẽ kiến trúc 2D dạng đường nét kỹ thuật. Giữ lại tất cả các chi tiết và tỷ lệ một cách chính xác. Yêu cầu cụ thể của người dùng là: "${p}".`,
        predefinedPrompts: [{
            label: 'Tạo 4 góc nhìn (Trước, Sau, Trái, Trên)',
            value: 'Sử dụng ảnh kiến trúc được cung cấp làm tham chiếu. Tạo các góc nhìn Mặt trước, Mặt sau, Trái, Trên trên nền trắng. Khoảng cách đều nhau.'
        }]
    },
     {
        id: 'product_to_technical_drawing', name: 'Triển khai Sản phẩm Nội thất', description: 'Biến ảnh sản phẩm (ghế, bàn, đèn...) thành bản vẽ kỹ thuật 2D với kích thước tổng thể.', icon: 'pencil',
        inputs: 1, inputLabels: ['Ảnh Sản phẩm'], service: 'generateImages', renderType: 'interior', promptPlaceholder: 'Ví dụ: bản vẽ 3 góc nhìn (trước, bên, trên), nét mảnh',
        promptEngineer: (p) => `Convert this product image into a professional 2D technical drawing. The drawing should be in a clean, line-art style. Include general dimensions (height, width, depth) if possible. The user's specific request is: "${p}".`,
        predefinedPrompts: [{
            label: 'Bản vẽ kỹ thuật có kích thước',
            value: 'convert to technical drawing style, split into 4 panels with 4 projection views, with general dimensions'
        }]
    },
    {
        id: 'color_floorplan', name: 'Đổ màu & bóng cho Floorplan', description: 'Thêm màu sắc, vật liệu và bóng đổ để floorplan 2D trông chuyên nghiệp hơn.', icon: 'brush',
        inputs: 1, inputLabels: ['Ảnh Floorplan 2D'], service: 'generateImages', renderType: 'floorplan', promptPlaceholder: 'Ví dụ: sàn gỗ, tường trắng, thêm cây xanh',
        promptEngineer: (p) => `Render một phiên bản chất lượng cao của floorplan 2D này với góc nhìn từ trên xuống. Thêm vật liệu thực tế (như gỗ cho sàn, gạch cho phòng tắm) và bóng đổ mềm để tạo cảm giác chiều sâu. Không chuyển đổi nó thành dạng xem phối cảnh 3D. Yêu cầu của người dùng là: "${p}".`,
        predefinedPrompts: [
            { label: '1. Basic Fill Color', value: 'Đổ màu mặt bằng theo từng phòng, màu phẳng, không texture, không bóng đổ.' },
            { label: '2. Material-based Fill', value: 'Đổ màu mặt bằng theo vật liệu thực tế: gỗ, gạch, đá, thảm, kính, sân vườn.' },
            { label: '3. Flat Design / 2D Graphic', value: 'Đổ màu mặt bằng phong cách đồ họa phẳng, màu pastel nhẹ, không bóng đổ, viền mảnh.' },
            { label: '4. Shadowed / Shaded', value: 'Đổ màu mặt bằng có bóng đổ theo ánh sáng, tạo chiều sâu cho tường và không gian.' },
            { label: '5. Watercolor / Hand-drawn', value: 'Đổ màu mặt bằng theo phong cách màu nước loang nhẹ, kiểu vẽ tay, cảm giác nghệ thuật.' },
            { label: '6. Japanese / Scandinavian', value: 'Đổ màu mặt bằng tông trắng – be – xám nhạt, điểm nhẹ màu gỗ hoặc xanh lá, tối giản.' },
            { label: '7. Grayscale + Highlight', value: 'Đổ màu mặt bằng nền xám, chỉ làm nổi bật các khu vực chính hoặc vùng nhấn.' },
            { label: '8. Infographic / Zoning', value: 'Đổ màu mặt bằng theo phân khu chức năng: ngủ, dịch vụ, giao thông, kỹ thuật.' },
            { label: '9. Landscape Plan', value: 'Đổ màu mặt bằng cảnh quan với lớp cỏ, cây bụi, đường dạo, mặt nước và kiến trúc.' },
            { label: '10. Hybrid Technical + Rendered', value: 'Đổ màu mặt bằng kết hợp line kỹ thuật với màu diễn họa, vừa chi tiết vừa trình bày đẹp.' }
        ]
    },
    {
        id: 'remove_watermark', name: 'Xóa Watermark', description: 'Tự động xóa watermark hoặc văn bản trên ảnh.', icon: 'x-circle',
        inputs: 1, inputLabels: ['Ảnh có Watermark'], service: 'generateImages', renderType: 'interior', promptPlaceholder: 'Có thể để trống, hoặc mô tả vị trí watermark nếu cần.',
        promptEngineer: (p) => `Xóa các watermark hoặc bất kỳ văn bản nào trên hình ảnh này. Yêu cầu thêm của người dùng: "${p}"`,
        predefinedPrompts: [{ label: 'Xóa chữ', value: 'Remove text' }]
    }
];

// --- Arrow Drawing Component for 'perspective_from_plan' ---
const ArrowDrawer = React.forwardRef<
    { getCompositeImage: () => Promise<string | null> },
    {
        originalImage: SourceImage | null;
        onImageUpload: (image: SourceImage) => void;
        onRemove: () => void;
        title?: string;
    }
>(({ originalImage, onImageUpload, onRemove, title }, ref) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    
    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    const [start, setStart] = useState<{x: number, y: number} | null>(null);
    const [end, setEnd] = useState<{x: number, y: number} | null>(null);
    const [dragInfo, setDragInfo] = useState({ active: false, target: 'none' as 'none' | 'start' | 'end' | 'line', offset: {x: 0, y: 0}});
    const [isDrawing, setIsDrawing] = useState(false);

    const processFile = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = (e.target?.result as string).split(',')[1];
                if (base64) {
                    onImageUpload({ base64, mimeType: file.type });
                    setStart(null);
                    setEnd(null);
                }
            };
            reader.readAsDataURL(file);
        } else {
            alert("Vui lòng tải lên một tệp ảnh hợp lệ.");
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && processFile(e.target.files[0]);
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDraggingOver(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDraggingOver(false); };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOver(false);
        e.dataTransfer.files?.[0] && processFile(e.dataTransfer.files[0]);
    };

    const drawImageOnCanvas = useCallback(() => {
        if (!originalImage || !imageCanvasRef.current) return;
        const canvas = imageCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.src = `data:${originalImage.mimeType};base64,${originalImage.base64}`;
        img.onload = () => {
            imageRef.current = img;
            canvas.width = img.width;
            canvas.height = img.height;
            if (drawingCanvasRef.current) {
                drawingCanvasRef.current.width = img.width;
                drawingCanvasRef.current.height = img.height;
            }
            ctx.drawImage(img, 0, 0);
            drawArrowAndHandles();
        };
    }, [originalImage]);

    useEffect(drawImageOnCanvas, [drawImageOnCanvas]);

    const drawArrowAndHandles = useCallback(() => {
        if (!drawingCanvasRef.current) return;
        const canvas = drawingCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!start || !end) return;

        // Line
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = Math.max(5, canvas.width / 200);
        ctx.stroke();

        // Start Circle
        ctx.beginPath();
        ctx.arc(start.x, start.y, Math.max(10, canvas.width / 100), 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'red';
        ctx.lineWidth = Math.max(3, canvas.width / 300);
        ctx.fill();
        ctx.stroke();

        // Arrowhead
        const headlen = Math.max(20, canvas.width / 50);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = 'red';
        ctx.fill();

    }, [start, end]);

    useEffect(drawArrowAndHandles, [drawArrowAndHandles]);
    
    const getMousePos = (canvas: HTMLCanvasElement, e: React.MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!drawingCanvasRef.current) return;
        const pos = getMousePos(drawingCanvasRef.current, e);
        const handleRadius = Math.max(15, drawingCanvasRef.current.width / 80);

        if (start && end) {
            const distToStart = Math.hypot(pos.x - start.x, pos.y - start.y);
            const distToEnd = Math.hypot(pos.x - end.x, pos.y - end.y);

            if (distToStart < handleRadius) {
                setDragInfo({ active: true, target: 'start', offset: { x: start.x - pos.x, y: start.y - pos.y } });
                return;
            }
            if (distToEnd < handleRadius) {
                setDragInfo({ active: true, target: 'end', offset: { x: end.x - pos.x, y: end.y - pos.y } });
                return;
            }
             setDragInfo({ active: true, target: 'line', offset: { x: start.x - pos.x, y: start.y - pos.y } });
             return;
        }
        
        setIsDrawing(true);
        setStart(pos);
        setEnd(pos);
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!drawingCanvasRef.current) return;
        const pos = getMousePos(drawingCanvasRef.current, e);

        if (dragInfo.active && start && end) {
            if (dragInfo.target === 'start') {
                setStart({ x: pos.x + dragInfo.offset.x, y: pos.y + dragInfo.offset.y });
            } else if (dragInfo.target === 'end') {
                setEnd({ x: pos.x + dragInfo.offset.x, y: pos.y + dragInfo.offset.y });
            } else if (dragInfo.target === 'line') {
                const dx = (pos.x + dragInfo.offset.x) - start.x;
                const dy = (pos.y + dragInfo.offset.y) - start.y;
                setStart({ x: start.x + dx, y: start.y + dy });
                setEnd({ x: end.x + dx, y: end.y + dy });
            }
        } else if (isDrawing) {
            setEnd(pos);
        }
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
        setDragInfo({ active: false, target: 'none', offset: { x: 0, y: 0 } });
    };

    useImperativeHandle(ref, () => ({
        getCompositeImage: async () => {
            if (!imageRef.current || !start) return null;
            const canvas = document.createElement('canvas');
            canvas.width = imageRef.current.width;
            canvas.height = imageRef.current.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.drawImage(imageRef.current, 0, 0);
            if (drawingCanvasRef.current) {
                ctx.drawImage(drawingCanvasRef.current, 0, 0);
            }
            return canvas.toDataURL(originalImage?.mimeType || 'image/jpeg');
        }
    }));

    if (!originalImage) {
        return (
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative group border-2 border-dashed rounded-lg p-4 flex items-center justify-center h-48 mb-4 hover:border-[var(--border-interactive)] transition-colors cursor-pointer ${isDraggingOver ? 'border-[var(--border-interactive)] bg-[var(--bg-surface-2)]' : 'border-[var(--border-2)]'}`}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="text-center text-[var(--text-secondary)] pointer-events-none">
                    <p>{title || 'Nhấp hoặc kéo tệp vào đây'}</p>
                    <p className="text-xs">PNG, JPG, WEBP</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
            </div>
        );
    }

    return (
        <div className="relative group mb-4">
             <div className="relative w-full h-auto" style={{ aspectRatio: imageRef.current ? `${imageRef.current.width}/${imageRef.current.height}`: '16/9'}}>
                <canvas ref={imageCanvasRef} className="absolute inset-0 w-full h-full object-contain" />
                <canvas 
                    ref={drawingCanvasRef}
                    className="absolute inset-0 w-full h-full object-contain cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                />
            </div>
             <button onClick={onRemove} className="absolute top-1 right-1 bg-black/50 rounded-full text-white hover:bg-black/80 p-0.5 transition-colors opacity-0 group-hover:opacity-100 z-10" aria-label="Remove source image">
                <Icon name="x-circle" className="w-5 h-5" />
            </button>
            <p className="text-xs text-center text-[var(--text-tertiary)] mt-1">Vẽ một mũi tên để chỉ định hướng nhìn.</p>
        </div>
    );
});

// --- History Panel ---
const UtilitiesHistoryPanel: React.FC<{ 
    history: RenderHistoryItem[]; 
    onClear: () => void; 
    onSelect: (item: RenderHistoryItem) => void;
}> = ({ history, onClear, onSelect }) => {
  return (
    <div className="bg-[var(--bg-surface-1)] backdrop-blur-md border border-[var(--border-1)] shadow-2xl shadow-[var(--shadow-color)] p-6 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Icon name="clock" className="w-5 h-5" />
          Lịch Sử Tiện Ích
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
        <p className="text-sm text-[var(--text-tertiary)] text-center py-4">Chưa có lịch sử tiện ích.</p>
      )}
    </div>
  );
};

// --- Main Component ---
interface UtilitiesTabProps {
    onEditRequest: (image: SourceImage) => void;
    onStartNewRenderFlow: (image: SourceImage) => void;
    promptFinderImage: SourceImage | null;
    setPromptFinderImage: (image: SourceImage | null) => void;
    promptFinderPrompts: GeneratedPrompts | null;
    setPromptFinderPrompts: (prompts: GeneratedPrompts | null) => void;
    history: RenderHistoryItem[];
    onClearHistory: () => void;
    onGenerationComplete: (prompt: string, images: string[]) => void;
}

// FIX: Export the UtilitiesTab component to make it available for import.
export const UtilitiesTab: React.FC<UtilitiesTabProps> = ({
    onEditRequest,
    onStartNewRenderFlow,
    promptFinderImage,
    setPromptFinderImage,
    promptFinderPrompts,
    setPromptFinderPrompts,
    history,
    onClearHistory,
    onGenerationComplete,
}) => {
    const [activeTask, setActiveTask] = useState<UtilityTaskDef | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [sourceImage1, setSourceImage1] = useState<SourceImage | null>(null);
    const [sourceImage2, setSourceImage2] = useState<SourceImage | null>(null);
    const [referenceImage, setReferenceImage] = useState<SourceImage | null>(null);
    const [resultImages, setResultImages] = useState<string[]>([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [isResultFullscreen, setIsResultFullscreen] = useState(false);
    const arrowDrawerRef = useRef<{ getCompositeImage: () => Promise<string | null> }>(null);

    // State for Prompt Finder
    const [isFindingPrompts, setIsFindingPrompts] = useState(false);
    const [generatingPromptKey, setGeneratingPromptKey] = useState<string | null>(null);
    const [generatedImageForModal, setGeneratedImageForModal] = useState<string | null>(null);

    // State for Mood Board
    const [moodBoardImage, setMoodBoardImage] = useState<SourceImage | null>(null);
    const [moodBoardResults, setMoodBoardResults] = useState<string[]>([]);
    const [isGeneratingMoods, setIsGeneratingMoods] = useState(false);

    // State for Video Generator
    const [videoSourceImage, setVideoSourceImage] = useState<SourceImage | null>(null);
    const [videoPrompt, setVideoPrompt] = useState('');
    const [videoResultUrl, setVideoResultUrl] = useState<string | null>(null);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [videoStatus, setVideoStatus] = useState('');

    // State for Finish Construction
    const [constructionImage, setConstructionImage] = useState<SourceImage | null>(null);
    const [completionPrompts, setCompletionPrompts] = useState<string[]>([]);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [generatingCompletionKey, setGeneratingCompletionKey] = useState<number | null>(null);

    // State for Finish Interior
    const [interiorImage, setInteriorImage] = useState<SourceImage | null>(null);
    const [interiorCompletionPrompts, setInteriorCompletionPrompts] = useState<string[]>([]);
    const [isSuggestingInterior, setIsSuggestingInterior] = useState(false);
    const [generatingInteriorCompletionKey, setGeneratingInteriorCompletionKey] = useState<number | null>(null);


    const resetState = useCallback(() => {
        setIsLoading(false);
        setPrompt('');
        setSourceImage1(null);
        setSourceImage2(null);
        setReferenceImage(null);
        setResultImages([]);
        setSelectedImageIndex(0);
    }, []);

    useEffect(() => {
        resetState();
        if (activeTask && activeTask.predefinedPrompts && activeTask.predefinedPrompts.length > 0) {
            setPrompt(activeTask.predefinedPrompts[0].value);
        }
    }, [activeTask, resetState]);

    const handleTaskSelect = (task: UtilityTaskDef) => {
        if (activeTask?.id === task.id) {
            setActiveTask(null);
        } else {
            setActiveTask(task);
        }
    };

    const handleGenerate = async () => {
        if (!activeTask) return;
        setIsLoading(true);
        setResultImages([]);

        try {
            const finalPrompt = activeTask.promptEngineer 
                ? activeTask.promptEngineer(prompt, !!referenceImage)
                : prompt;

            let images: string[] = [];
            const useRawPrompt = !!activeTask.promptEngineer;

            if (activeTask.id === 'perspective_from_plan') {
                 const compositeImageUrl = await arrowDrawerRef.current?.getCompositeImage();
                 if (!compositeImageUrl || !sourceImage2) {
                     alert("Vui lòng tải lên cả hai ảnh và vẽ mũi tên.");
                     setIsLoading(false);
                     return;
                 }
                 const compositeImage: SourceImage = { base64: compositeImageUrl.split(',')[1], mimeType: 'image/jpeg' };
                 images = await generateImages(compositeImage, finalPrompt, 'masterplan', 1, 'Auto', sourceImage2, false, useRawPrompt);
            } else if (activeTask.service === 'generateImageFromText') {
                const result = await generateImageFromText(finalPrompt);
                if (result) images = [result];
            } else if (activeTask.service === 'generateImages' || activeTask.service === 'generateImagesWithReference') {
                const source = activeTask.service === 'generateImagesWithReference' ? sourceImage1 : sourceImage1;
                const reference = activeTask.service === 'generateImagesWithReference' ? sourceImage2 : referenceImage;
                
                if (!source) {
                    alert("Vui lòng tải lên ảnh nguồn.");
                    setIsLoading(false);
                    return;
                }
                images = await generateImages(source, finalPrompt, activeTask.renderType || 'exterior', 1, 'Auto', reference, false, useRawPrompt);
            }
            
            setResultImages(images);
            if (images.length > 0) {
                onGenerationComplete(finalPrompt, images);
            }

        } catch (error) {
            console.error("Utility task failed:", error);
            alert("Đã xảy ra lỗi. Vui lòng thử lại.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFindPrompts = async () => {
        if (!promptFinderImage) return;
        setIsFindingPrompts(true);
        setPromptFinderPrompts(null);
        try {
            const prompts = await generatePromptsFromImage(promptFinderImage);
            setPromptFinderPrompts(prompts);
        } catch (error) {
            console.error(error);
            alert("Không thể tạo prompt. Vui lòng thử lại.");
        } finally {
            setIsFindingPrompts(false);
        }
    };

    const handleGenerateFromPromptFinder = async (prompt: string, category: 'medium' | 'closeup' | 'interior', index: number) => {
        if (!promptFinderImage) return;

        const key = `${category}-${index}`;
        setGeneratingPromptKey(key);

        try {
            const renderType = (category === 'interior') ? 'interior' : 'exterior';
            const images = await generateImages(promptFinderImage, prompt, renderType, 1, 'Auto', null, false, true);
            
            if (images && images.length > 0) {
                setGeneratedImageForModal(images[0]);
                onGenerationComplete(prompt, images);
            } else {
                throw new Error("AI did not return an image.");
            }
        } catch (error) {
            console.error("Failed to generate image from prompt finder:", error);
            alert("Đã xảy ra lỗi khi tạo ảnh từ prompt này.");
        } finally {
            setGeneratingPromptKey(null);
        }
    };


    const handleGenerateMoods = async () => {
        if (!moodBoardImage) return;
        setIsGeneratingMoods(true);
        setMoodBoardResults([]);
        try {
            const images = await generateMoodImages(moodBoardImage);
            setMoodBoardResults(images);
            if(images.length > 0) {
              onGenerationComplete("Tạo 4 mood ảnh", images);
            }
        } catch (error) {
            console.error(error);
            alert("Không thể tạo mood. Vui lòng thử lại.");
        } finally {
            setIsGeneratingMoods(false);
        }
    }
    
    const handleGenerateVideo = async () => {
        if (!videoPrompt && !videoSourceImage) {
            alert("Vui lòng nhập prompt hoặc tải lên ảnh.");
            return;
        }
        setIsGeneratingVideo(true);
        setVideoResultUrl(null);
        setVideoStatus('');
        try {
            const resultUrl = await generateVideo(videoPrompt, videoSourceImage, setVideoStatus);
            setVideoResultUrl(resultUrl);
             if (resultUrl && videoSourceImage) {
                 onGenerationComplete(videoPrompt, [`data:${videoSourceImage.mimeType};base64,${videoSourceImage.base64}`]);
            }
        } catch (error) {
            console.error(error);
            setVideoStatus(`Lỗi: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    const handleSuggestCompletionStyles = async () => {
        if (!constructionImage) return;
        setIsSuggesting(true);
        setCompletionPrompts([]);
        try {
            const prompts = await generateCompletionPrompts(constructionImage);
            setCompletionPrompts(prompts);
        } catch (error) {
            console.error(error);
            alert("Không thể tạo gợi ý. Vui lòng thử lại.");
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleGenerateCompletion = async (prompt: string, index: number) => {
        if (!constructionImage) return;
        setSourceImage1(constructionImage); // Set for result viewer
        setGeneratingCompletionKey(index);
        setIsLoading(true);
        setResultImages([]);

        try {
            const images = await generateImages(constructionImage, prompt, 'exterior', 1, 'Auto', null, false, true);
            if (images && images.length > 0) {
                setResultImages(images);
                onGenerationComplete(prompt, images);
            } else {
                throw new Error("AI did not return an image.");
            }
        } catch (error) {
            console.error("Failed to generate completion image:", error);
            alert("Đã xảy ra lỗi khi tạo ảnh hoàn thiện.");
        } finally {
            setGeneratingCompletionKey(null);
            setIsLoading(false);
        }
    };

    const handleSuggestInteriorStyles = async () => {
        if (!interiorImage) return;
        setIsSuggestingInterior(true);
        setInteriorCompletionPrompts([]);
        try {
            const prompts = await generateInteriorCompletionPrompts(interiorImage);
            setInteriorCompletionPrompts(prompts);
        } catch (error) {
            console.error(error);
            alert("Không thể tạo gợi ý. Vui lòng thử lại.");
        } finally {
            setIsSuggestingInterior(false);
        }
    };

    const handleGenerateInteriorCompletion = async (prompt: string, index: number) => {
        if (!interiorImage) return;
        setSourceImage1(interiorImage); // Set for result viewer
        setGeneratingInteriorCompletionKey(index);
        setIsLoading(true);
        setResultImages([]);

        try {
            const images = await generateImages(interiorImage, prompt, 'interior', 1, 'Auto', null, false, true);
            if (images && images.length > 0) {
                setResultImages(images);
                onGenerationComplete(prompt, images);
            } else {
                throw new Error("AI did not return an image.");
            }
        } catch (error) {
            console.error("Failed to generate interior completion image:", error);
            alert("Đã xảy ra lỗi khi tạo ảnh hoàn thiện nội thất.");
        } finally {
            setGeneratingInteriorCompletionKey(null);
            setIsLoading(false);
        }
    };

    const handleInteriorPromptChange = (index: number, newPrompt: string) => {
        const updatedPrompts = [...interiorCompletionPrompts];
        updatedPrompts[index] = newPrompt;
        setInteriorCompletionPrompts(updatedPrompts);
    };

    const getSourceImageForSlider = () => {
        if (!activeTask) return null;
        if (activeTask.id === 'finish_construction') return constructionImage ? `data:${constructionImage.mimeType};base64,${constructionImage.base64}` : null;
        if (activeTask.id === 'finish_interior') return interiorImage ? `data:${interiorImage.mimeType};base64,${interiorImage.base64}` : null;
        if (activeTask.id === 'place_furniture' || activeTask.id === 'insert_building') return sourceImage1 ? `data:${sourceImage1.mimeType};base64,${sourceImage1.base64}` : null;
        if (activeTask.inputs === 1) return sourceImage1 ? `data:${sourceImage1.mimeType};base64,${sourceImage1.base64}` : null;
        return null;
    }

    const renderTaskUI = () => {
        if (!activeTask) {
            return (
                <div className="text-center text-[var(--text-tertiary)] py-16">
                    <Icon name="bookmark" className="w-16 h-16 mx-auto mb-4" />
                    <p className="font-semibold">Chọn một tiện ích từ danh sách bên trên</p>
                    <p className="text-sm mt-1">để bắt đầu.</p>
                </div>
            );
        }

        if (activeTask.id === 'finish_construction') {
            return (
                <Section title="Hoàn Thiện Công Trình">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <ImageUpload 
                                sourceImage={constructionImage} 
                                onImageUpload={setConstructionImage} 
                                onRemove={() => {
                                    setConstructionImage(null);
                                    setCompletionPrompts([]);
                                    setResultImages([]);
                                }} 
                                title="Tải ảnh công trình đang thi công"
                            />
                            <button 
                                onClick={handleSuggestCompletionStyles} 
                                disabled={!constructionImage || isSuggesting} 
                                className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed"
                            >
                                <Icon name={isSuggesting ? "arrow-path" : "sparkles"} className={`w-5 h-5 ${isSuggesting ? 'animate-spin' : ''}`} /> 
                                {isSuggesting ? "Đang gợi ý..." : "Gợi ý Style Hoàn Thiện"}
                            </button>
                        </div>
                        <div className="bg-[var(--bg-surface-2)] p-4 rounded-lg overflow-y-auto max-h-[26rem]">
                            {isSuggesting && completionPrompts.length === 0 && <p className="text-sm text-center text-[var(--text-tertiary)]">AI đang suy nghĩ...</p>}
                            {!isSuggesting && completionPrompts.length === 0 && <p className="text-sm text-center text-[var(--text-tertiary)]">10 gợi ý style sẽ xuất hiện ở đây.</p>}
                            {completionPrompts.length > 0 && (
                                 <ul className="space-y-2">
                                    {completionPrompts.map((p, i) => (
                                        <li key={i} className="flex items-center justify-between gap-2 p-2 rounded-md bg-[var(--bg-surface-3)]/50">
                                            <span className="text-sm text-[var(--text-secondary)] flex-grow">{p}</span>
                                            <button
                                                onClick={() => handleGenerateCompletion(p, i)}
                                                disabled={generatingCompletionKey !== null}
                                                className="flex-shrink-0 p-2 rounded-full bg-[var(--bg-surface-3)] hover:bg-[var(--bg-interactive)] hover:text-white disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed transition-colors"
                                                title="Tạo ảnh render cho style này"
                                            >
                                                {generatingCompletionKey === i ? (
                                                    <Icon name="arrow-path" className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Icon name="sparkles" className="w-4 h-4" />
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </Section>
            )
        }

        if (activeTask.id === 'finish_interior') {
            return (
                <Section title="Hoàn Thiện Nội Thất">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <ImageUpload 
                                sourceImage={interiorImage} 
                                onImageUpload={setInteriorImage} 
                                onRemove={() => {
                                    setInteriorImage(null);
                                    setInteriorCompletionPrompts([]);
                                    setResultImages([]);
                                }} 
                                title="Tải ảnh phòng trống, chưa có nội thất"
                            />
                            <button 
                                onClick={handleSuggestInteriorStyles} 
                                disabled={!interiorImage || isSuggestingInterior} 
                                className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed"
                            >
                                <Icon name={isSuggestingInterior ? "arrow-path" : "sparkles"} className={`w-5 h-5 ${isSuggestingInterior ? 'animate-spin' : ''}`} /> 
                                {isSuggestingInterior ? "Đang gợi ý..." : "Gợi ý Style Nội Thất"}
                            </button>
                        </div>
                        <div className="bg-[var(--bg-surface-2)] p-4 rounded-lg overflow-y-auto max-h-[26rem]">
                            {isSuggestingInterior && interiorCompletionPrompts.length === 0 && <p className="text-sm text-center text-[var(--text-tertiary)]">AI đang suy nghĩ...</p>}
                            {!isSuggestingInterior && interiorCompletionPrompts.length === 0 && <p className="text-sm text-center text-[var(--text-tertiary)]">10 gợi ý style nội thất sẽ xuất hiện ở đây.</p>}
                            {interiorCompletionPrompts.length > 0 && (
                                 <ul className="space-y-2">
                                    {interiorCompletionPrompts.map((p, i) => (
                                        <li key={i} className="flex items-start justify-between gap-2 p-2 rounded-md bg-[var(--bg-surface-3)]/50">
                                            <textarea
                                                value={p}
                                                onChange={(e) => handleInteriorPromptChange(i, e.target.value)}
                                                rows={3}
                                                className="w-full bg-transparent text-sm text-[var(--text-secondary)] flex-grow resize-none border-none focus:ring-1 focus:ring-[var(--ring-focus)] focus:bg-[var(--bg-surface-4)] rounded-md p-1 transition"
                                            />
                                            <button
                                                onClick={() => handleGenerateInteriorCompletion(p, i)}
                                                disabled={generatingInteriorCompletionKey !== null}
                                                className="flex-shrink-0 p-2 mt-1 rounded-full bg-[var(--bg-surface-3)] hover:bg-[var(--bg-interactive)] hover:text-white disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed transition-colors"
                                                title="Tạo ảnh render cho style này"
                                            >
                                                {generatingInteriorCompletionKey === i ? (
                                                    <Icon name="arrow-path" className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Icon name="sparkles" className="w-4 h-4" />
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </Section>
            )
        }

        if(activeTask.id === 'prompt_finder') {
            return (
                <Section title="Dò Prompt từ Ảnh Gốc">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <ImageUpload sourceImage={promptFinderImage} onImageUpload={setPromptFinderImage} onRemove={() => setPromptFinderImage(null)} title="Tải ảnh kiến trúc"/>
                            <button onClick={handleFindPrompts} disabled={!promptFinderImage || isFindingPrompts} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                                <Icon name={isFindingPrompts ? "arrow-path" : "sparkles"} className={`w-5 h-5 ${isFindingPrompts ? 'animate-spin' : ''}`} /> 
                                {isFindingPrompts ? "Đang phân tích..." : "Tìm Prompt"}
                            </button>
                        </div>
                        <div className="bg-[var(--bg-surface-2)] p-4 rounded-lg overflow-y-auto max-h-[26rem]">
                            {isFindingPrompts && !promptFinderPrompts && <p className="text-sm text-center text-[var(--text-tertiary)]">AI đang suy nghĩ...</p>}
                            {!isFindingPrompts && !promptFinderPrompts && <p className="text-sm text-center text-[var(--text-tertiary)]">Các prompt gợi ý sẽ xuất hiện ở đây.</p>}
                            {promptFinderPrompts && (
                                <div className="space-y-4">
                                    {(['medium', 'closeup', 'interior'] as const).map(category => (
                                        <div key={category}>
                                            <h3 className="font-semibold text-[var(--text-primary)] mb-2 capitalize">{category === 'medium' ? 'Cảnh trung' : category === 'closeup' ? 'Cảnh cận' : 'Cảnh nội thất'}</h3>
                                            <ul className="space-y-2">
                                                {promptFinderPrompts[category].map((p, i) => (
                                                    <li key={`${category}-${i}`} className="flex items-center justify-between gap-2 p-2 rounded-md bg-[var(--bg-surface-3)]/50">
                                                        <span className="text-sm text-[var(--text-secondary)] flex-grow">{p}</span>
                                                        <button
                                                            onClick={() => handleGenerateFromPromptFinder(p, category, i)}
                                                            disabled={!!generatingPromptKey}
                                                            className="flex-shrink-0 p-2 rounded-full bg-[var(--bg-surface-3)] hover:bg-[var(--bg-interactive)] hover:text-white disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed transition-colors"
                                                            title="Tạo ảnh từ prompt này"
                                                        >
                                                            {generatingPromptKey === `${category}-${i}` ? (
                                                                <Icon name="arrow-path" className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Icon name="sparkles" className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Section>
            );
        }

        if(activeTask.id === 'mood_board') {
            return (
                 <Section title="Tạo Mood Cho Render">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <div>
                            <ImageUpload sourceImage={moodBoardImage} onImageUpload={setMoodBoardImage} onRemove={() => setMoodBoardImage(null)} title="Tải ảnh sketch"/>
                            <button onClick={handleGenerateMoods} disabled={!moodBoardImage || isGeneratingMoods} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                                <Icon name={isGeneratingMoods ? "arrow-path" : "sparkles"} className={`w-5 h-5 ${isGeneratingMoods ? 'animate-spin' : ''}`} /> 
                                {isGeneratingMoods ? "Đang tạo..." : "Tạo 4 Moods"}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {isGeneratingMoods && moodBoardResults.length === 0 && Array.from({length: 4}).map((_, i) => <div key={i} className="aspect-square bg-[var(--bg-surface-2)] rounded-lg animate-pulse"></div>)}
                            {moodBoardResults.length > 0 ? moodBoardResults.map((img, i) => (
                                <div key={i} className="relative group aspect-square">
                                    <img src={img} alt={`Mood ${i+1}`} className="w-full h-full object-cover rounded-lg"/>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                                        <span className="text-white text-xs font-bold">{['Sáng', 'Trưa', 'Hoàng Hôn', 'Tối'][i]}</span>
                                        <a href={img} download={`mood-${i}.png`} className="p-1.5 bg-white/20 rounded-full text-white hover:bg-white/40"><Icon name="download" className="w-4 h-4"/></a>
                                    </div>
                                </div>
                            )) : !isGeneratingMoods && (
                                <div className="col-span-2 text-center text-sm text-[var(--text-tertiary)] p-8">Kết quả 4 moods sẽ hiện ở đây.</div>
                            )}
                        </div>
                    </div>
                 </Section>
            )
        }
        
        if (activeTask.id === 'video_generator') {
            return (
                <Section title="Tạo Video từ Ảnh">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <div>
                            <ImageUpload sourceImage={videoSourceImage} onImageUpload={setVideoSourceImage} onRemove={() => setVideoSourceImage(null)} title="Tải ảnh bắt đầu (Tùy chọn)"/>
                            <textarea
                                value={videoPrompt}
                                onChange={(e) => setVideoPrompt(e.target.value)}
                                placeholder="Mô tả video bạn muốn tạo..."
                                className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-24 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none"
                            />
                            <button onClick={handleGenerateVideo} disabled={isGeneratingVideo} className="w-full mt-4 bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                                <Icon name={isGeneratingVideo ? "arrow-path" : "film"} className={`w-5 h-5 ${isGeneratingVideo ? 'animate-spin' : ''}`} /> 
                                {isGeneratingVideo ? "Đang tạo video..." : "Tạo Video"}
                            </button>
                             {videoStatus && <p className="text-xs text-center mt-2 text-[var(--text-tertiary)]">{videoStatus}</p>}
                        </div>
                        <div className="w-full aspect-video bg-black/20 rounded-lg flex items-center justify-center">
                            {videoResultUrl ? (
                                <video src={videoResultUrl} controls autoPlay loop className="w-full h-full object-contain rounded-lg"/>
                            ) : (
                                <p className="text-sm text-[var(--text-tertiary)] text-center">Video kết quả sẽ hiện ở đây.</p>
                            )}
                        </div>
                    </div>
                </Section>
            );
        }

        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <Section title="1. Tải Lên & Mô Tả">
                        <div className="space-y-4">
                            {activeTask.inputs === 1 && (
                                activeTask.id === 'perspective_from_plan' 
                                ? <ArrowDrawer ref={arrowDrawerRef} originalImage={sourceImage1} onImageUpload={setSourceImage1} onRemove={() => setSourceImage1(null)} title={activeTask.inputLabels?.[0]}/>
                                : <ImageUpload sourceImage={sourceImage1} onImageUpload={setSourceImage1} onRemove={() => setSourceImage1(null)} title={activeTask.inputLabels?.[0]} />
                            )}
                             {activeTask.inputs === 2 && (
                                 <>
                                    {activeTask.id === 'perspective_from_plan' 
                                      ? <ArrowDrawer ref={arrowDrawerRef} originalImage={sourceImage1} onImageUpload={setSourceImage1} onRemove={() => setSourceImage1(null)} title={activeTask.inputLabels?.[0]} />
                                      : <ImageUpload sourceImage={sourceImage1} onImageUpload={setSourceImage1} onRemove={() => setSourceImage1(null)} title={activeTask.inputLabels?.[0]} heightClass="h-32"/>
                                    }
                                    <ImageUpload sourceImage={sourceImage2} onImageUpload={setSourceImage2} onRemove={() => setSourceImage2(null)} title={activeTask.inputLabels?.[1]} heightClass="h-32"/>
                                 </>
                             )}
                            {activeTask.hasOptionalReferenceImage && (
                                <ReferenceImageUpload image={referenceImage} onUpload={setReferenceImage} onRemove={() => setReferenceImage(null)} />
                            )}
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder={activeTask.promptPlaceholder}
                                className="w-full bg-[var(--bg-surface-3)] p-2 rounded-md h-24 resize-none text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none"
                            />
                            {activeTask.predefinedPrompts && (
                                <select 
                                  onChange={(e) => setPrompt(e.target.value)} 
                                  value={prompt}
                                  className="w-full bg-[var(--bg-surface-3)] p-3 rounded-md text-sm focus:ring-2 focus:ring-[var(--ring-focus)] focus:outline-none appearance-none"
                                  style={{
                                      backgroundImage: 'var(--select-arrow-svg)',
                                      backgroundPosition: 'right 0.5rem center',
                                      backgroundRepeat: 'no-repeat',
                                      backgroundSize: '1.5em 1.5em',
                                  }}
                                >
                                    {activeTask.predefinedPrompts.map(p => <option key={p.label} value={p.value}>{p.label}</option>)}
                                </select>
                            )}
                            <button onClick={handleGenerate} disabled={isLoading} className="w-full bg-[var(--bg-interactive)] hover:bg-[var(--bg-interactive-hover)] text-[var(--text-interactive)] font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-[var(--bg-disabled)] disabled:cursor-not-allowed">
                                <Icon name={isLoading ? "arrow-path" : "sparkles"} className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} /> 
                                {isLoading ? "Đang tạo..." : "Thực Hiện"}
                            </button>
                        </div>
                    </Section>
                </div>
                 <div className="lg:col-span-2">
                    <Section title="2. Kết Quả">
                        <div className="w-full aspect-video bg-black/20 rounded-lg flex items-center justify-center min-h-[400px] lg:min-h-[500px]">
                           <div className="relative w-full h-full max-w-full max-h-full flex items-center justify-center group">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                                        <p className="mt-3 font-semibold text-sm text-[var(--text-primary)]">Đang tạo...</p>
                                    </div>
                                ) : resultImages.length > 0 ? (
                                    <>
                                        <ImageCompareSlider beforeImage={getSourceImageForSlider()} afterImage={resultImages[selectedImageIndex]} />
                                        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                            <button onClick={() => setIsResultFullscreen(true)} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5" title="Xem Toàn Màn Hình">
                                               <Icon name="arrows-expand" className="w-4 h-4" />
                                               <span>Phóng To</span>
                                            </button>
                                            <a href={resultImages[selectedImageIndex]} download={`nbox-ai-util-${Date.now()}.png`} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5" title="Tải ảnh">
                                                <Icon name="download" className="w-4 h-4" />
                                                <span>Tải</span>
                                            </a>
                                            <button onClick={() => onEditRequest({ base64: resultImages[selectedImageIndex].split(',')[1], mimeType: 'image/png'})} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5" title="Chỉnh Sửa Ảnh Này">
                                                <Icon name="pencil" className="w-4 h-4" />
                                                <span>Sửa</span>
                                            </button>
                                             <button onClick={() => onStartNewRenderFlow({ base64: resultImages[selectedImageIndex].split(',')[1], mimeType: 'image/png'})} className="bg-[var(--bg-surface-3)]/80 backdrop-blur-sm border border-[var(--border-2)] hover:bg-[var(--bg-interactive)] text-[var(--text-primary)] hover:text-[var(--text-interactive)] font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5" title="Dùng ảnh này để bắt đầu render mới">
                                                <Icon name="photo" className="w-4 h-4" />
                                                <span>Render Mới</span>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-[var(--text-tertiary)] text-center">Kết quả sẽ xuất hiện ở đây.</p>
                                )}
                            </div>
                        </div>
                    </Section>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-8">
            {/* 1. Utility Selection Grid */}
            <Section title="Danh Sách Tiện Ích">
                {/* Responsive grid for utilities, 3 items per row on large screens as requested */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {UTILITY_TASKS.map(task => (
                        <button
                            key={task.id}
                            onClick={() => handleTaskSelect(task)}
                            className={`h-full p-4 rounded-lg text-center transition-all duration-200 flex flex-col items-center justify-start gap-3 ${activeTask?.id === task.id ? 'bg-[var(--bg-interactive)] text-[var(--text-interactive)] shadow-lg ring-2 ring-offset-2 ring-offset-[var(--bg-surface-1)] ring-[var(--ring-active)]' : 'bg-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-3)] hover:shadow-sm'}`}
                        >
                            <div className={`flex-shrink-0 p-3 rounded-full ${activeTask?.id === task.id ? 'bg-white/20' : 'bg-[var(--bg-surface-3)]'}`}>
                                <Icon name={task.icon} className="w-8 h-8" />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="font-semibold text-sm">{task.name}</h3>
                                <p className={`text-xs mt-1 ${activeTask?.id === task.id ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}>{task.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </Section>

            {/* 2. Active Task UI is now below the selection */}
            <div>
                {renderTaskUI()}
            </div>
            
            {/* 3. History Panel is now at the very bottom */}
            <UtilitiesHistoryPanel history={history} onClear={onClearHistory} onSelect={() => {}}/>

            {isResultFullscreen && resultImages.length > 0 && (
                <ImageViewerModal
                    imageUrl={resultImages[selectedImageIndex]}
                    onClose={() => setIsResultFullscreen(false)}
                    onEdit={() => {
                        const sourceImage = dataUrlToSourceImage(resultImages[selectedImageIndex]);
                        if (sourceImage) onEditRequest(sourceImage);
                        setIsResultFullscreen(false);
                    }}
                    onUseAsSource={() => {
                        const sourceImage = dataUrlToSourceImage(resultImages[selectedImageIndex]);
                        if (sourceImage) onStartNewRenderFlow(sourceImage);
                        setIsResultFullscreen(false);
                    }}
                />
            )}
            {generatedImageForModal && (
                 <ImageViewerModal
                    imageUrl={generatedImageForModal}
                    onClose={() => setGeneratedImageForModal(null)}
                    onEdit={() => {
                        const sourceImage = dataUrlToSourceImage(generatedImageForModal);
                        if (sourceImage) {
                            onEditRequest(sourceImage);
                            setGeneratedImageForModal(null);
                        }
                    }}
                    onUseAsSource={() => {
                        const sourceImage = dataUrlToSourceImage(generatedImageForModal);
                        if (sourceImage) {
                            onStartNewRenderFlow(sourceImage);
                            setGeneratedImageForModal(null);
                        }
                    }}
                />
            )}
        </div>
    );
};