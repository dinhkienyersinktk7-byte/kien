import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import type { SourceImage } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

/**
 * Extracts the base64 image data from a Gemini API response.
 * @param response - The response object from the API.
 * @returns The base64 encoded image string, or null if not found.
 */
const extractBase64Image = (response: GenerateContentResponse): string | null => {
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null;
};

/**
 * Describes an interior design image to generate a prompt.
 * @param sourceImage - The source image object.
 * @returns A promise that resolves to a descriptive string.
 */
export const describeInteriorImage = async (sourceImage: SourceImage): Promise<string> => {
  if (!API_KEY) {
    throw new Error("API_KEY is not configured.");
  }
  
  const engineeredPrompt = "Analyze the provided image of a room. Your response must be a concise prompt in Vietnamese, suitable for regenerating a photorealistic version of the image. The prompt must start with the exact phrase: 'tạo ảnh chụp thực tế của căn phòng...'. Following that phrase, briefly describe the room's key materials and lighting to achieve a realistic photographic look. Keep the description short and focused.";

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
        { text: engineeredPrompt },
      ],
    },
  });

  return response.text.trim();
};

/**
 * Describes a masterplan image to generate a suitable prompt.
 * @param sourceImage - The source masterplan image.
 * @returns A promise that resolves to a descriptive string.
 */
export const describeMasterplanImage = async (sourceImage: SourceImage): Promise<string> => {
  if (!API_KEY) {
    throw new Error("API_KEY is not configured.");
  }

  const engineeredPrompt = "Phân tích hình ảnh mặt bằng tổng thể (masterplan) được cung cấp. Mô tả ngắn gọn loại hình dự án (ví dụ: khu nghỉ dưỡng ven biển, khu đô thị phức hợp, công viên trung tâm). Phản hồi của bạn PHẢI là một câu hoàn chỉnh bằng tiếng Việt, bắt đầu chính xác bằng cụm từ: 'Biến masterplan này thành ảnh chụp dự án '. Ví dụ: 'Biến masterplan này thành ảnh chụp dự án khu đô thị phức hợp với nhiều cây xanh và hồ nước trung tâm.' Giữ mô tả ngắn gọn và tập trung vào các đặc điểm chính.";

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
        { text: engineeredPrompt },
      ],
    },
  });

  return response.text.trim();
};

/**
 * Generates multiple images based on a source image and a text prompt.
 * @param sourceImage - The source image object containing base64 data and mimeType.
 * @param prompt - The text prompt to guide the image generation.
 * @param renderType - The type of render, either 'exterior', 'interior', 'floorplan', or 'masterplan'.
 * @param count - The number of images to generate.
 * @param aspectRatio - The desired aspect ratio for the output images.
 * @param referenceImage - An optional reference image for style, tone, and mood.
 * @param isAnglePrompt - A boolean to indicate if the prompt is for changing the angle.
 * @param useRawPrompt - A boolean to indicate if the provided prompt should be used as-is, without further engineering.
 * @param negativePrompt - An optional string of elements to exclude from the image.
 * @returns A promise that resolves to an array of base64 image URLs.
 */
export const generateImages = async (
  sourceImage: SourceImage,
  prompt: string,
  renderType: 'exterior' | 'interior' | 'floorplan' | 'masterplan',
  count: number,
  aspectRatio: string,
  referenceImage: SourceImage | null = null,
  isAnglePrompt: boolean = false,
  useRawPrompt: boolean = false,
  negativePrompt?: string
): Promise<string[]> => {
  if (!API_KEY) {
    throw new Error("API_KEY is not configured.");
  }

  const generationPromises = Array(count).fill(0).map(async () => {
    let textPart = { text: prompt };
    const parts: any[] = [
      {
        inlineData: {
          data: sourceImage.base64,
          mimeType: sourceImage.mimeType,
        },
      },
    ];

    if (referenceImage) {
      parts.push({
        inlineData: {
          data: referenceImage.base64,
          mimeType: referenceImage.mimeType,
        },
      });
    }

    if (useRawPrompt) {
        // Use the prompt as-is from the caller.
    } else if (isAnglePrompt) {
        let subject: string;
        let sketchType: string;
        switch (renderType) {
            case 'exterior':
                subject = 'building';
                sketchType = 'architectural sketch';
                break;
            case 'interior':
                subject = 'room';
                sketchType = 'interior sketch';
                break;
            case 'masterplan':
                subject = 'masterplan';
                sketchType = '3D render';
                break;
            case 'floorplan':
                subject = 'room';
                sketchType = '3D interior render';
                break;
            default:
                subject = 'room';
                sketchType = 'interior sketch';
                break;
        }
        textPart.text = `The user wants to change the camera angle of the provided ${sketchType}. Render the exact same ${subject} from the image, but from this new perspective: "${prompt}". The prompt's main goal is to define the camera shot, not to add new content to the scene.`;
    } else if (renderType === 'masterplan') {
      textPart.text = `You are an expert 3D architectural visualizer specializing in large-scale masterplans. Your task is to convert the provided 2D masterplan drawing into a photorealistic 3D aerial or bird's-eye view render. The user's request for the specific camera angle and mood is: "${prompt}". Create a beautiful and realistic image based on these instructions, accurately representing the layout of buildings, landscapes, roads, and water bodies.`;
    } else if (renderType === 'floorplan') {
       if (referenceImage) {
          textPart.text = `The user's prompt is: "${prompt}". You are an expert 3D architectural visualizer. Your task is to convert the provided 2D floorplan (first image) into a photorealistic 3D interior render. You MUST adhere strictly to the layout from the floorplan. The second image is a reference for style ONLY. You must apply the mood, lighting, materials, and color palette from this second image to the room generated from the floorplan. It is forbidden to copy any structural elements or furniture layout from the style reference image. The final render should be from a human-eye level perspective inside the room.`;
        } else {
          textPart.text = `You are an expert 3D architectural visualizer. Your task is to convert the provided 2D floorplan image into a photorealistic 3D interior render, viewed from a human-eye level perspective inside the room. Adhere strictly to the layout, dimensions, and placement of walls, doors, and windows as shown in the floorplan. The user's request is: "${prompt}". Create a beautiful and realistic image based on these instructions.`;
        }
    } else if (referenceImage) {
        const subjectType = renderType === 'exterior' ? 'building' : 'room';
        const shotType = renderType === 'exterior' ? 'exterior shot' : 'interior shot';
        textPart.text = `The user's prompt is: "${prompt}". You are creating a realistic architectural render. The first image is the architectural sketch. You MUST use the exact structure, form, and layout from this first sketch. The second image is a reference for style ONLY. You must apply the mood, lighting, and color palette from the second image to the ${subjectType} from the first sketch. It is forbidden to copy any shapes, objects, architectural elements, or scene composition (like window frames or foreground elements) from the second style-reference image. The final render must be an ${shotType} based on the user's prompt.`;
    } else if (renderType === 'interior') {
        textPart.text = `You are an expert 3D architectural visualizer specializing in photorealistic interior renders. Your task is to convert the provided interior design sketch or image into a high-quality, realistic photograph. The user's specific request is: "${prompt}". Create a beautiful and realistic image based on these instructions, paying close attention to materials, lighting, and atmosphere to achieve a convincing result.`;
    } else {
        textPart.text = prompt;
    }

    if (negativePrompt) {
        textPart.text += `. IMPORTANT: Strictly avoid including the following elements in the image: ${negativePrompt}. The image must be photorealistic and not look like a sketch, drawing, or cartoon.`;
    }

    if (aspectRatio && aspectRatio !== 'Auto') {
        textPart.text += `. The final image must have a ${aspectRatio} aspect ratio`;
    }

    parts.push(textPart);
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      }
    );
    return extractBase64Image(response);
  });

  const results = await Promise.all(generationPromises);
  
  return results.filter((result): result is string => result !== null);
};


/**
 * Upscales an image to a target resolution using a descriptive prompt.
 * @param sourceImage - The source image object containing base64 data and mimeType.
 * @param target - The target resolution, either '2k' or '4k'.
 * @returns A promise that resolves to the base64 URL of the upscaled image.
 */
export const upscaleImage = async (
  sourceImage: SourceImage,
  target: '2k' | '4k'
): Promise<string | null> => {
  if (!API_KEY) {
    throw new Error("API_KEY is not configured.");
  }
  
  const prompt = `Upscale this image to ${target.toUpperCase()} resolution. Enhance details, sharpness, and clarity while preserving the original content, style, and composition. Make it photorealistic.`;

  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: sourceImage.base64,
              mimeType: sourceImage.mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    }
  );

  return extractBase64Image(response);
};

/**
 * Edits an image based on a source image, a mask, and a text prompt.
 * @param sourceImage - The original image to be edited.
 * @param maskImage - A black and white image where white indicates the area to edit.
 * @param prompt - The text prompt describing the desired edit.
 * @param referenceImage - An optional reference image for style and material.
 * @returns A promise that resolves to the base64 URL of the edited image.
 */
export const editImage = async (
  sourceImage: SourceImage,
  maskImage: SourceImage,
  prompt: string,
  referenceImage: SourceImage | null = null
): Promise<string | null> => {
  if (!API_KEY) {
    throw new Error("API_KEY is not configured.");
  }

  let engineeredPrompt: string;
  const parts: any[] = [
    { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
    { inlineData: { data: maskImage.base64, mimeType: maskImage.mimeType } },
  ];

  if (referenceImage) {
    parts.push({ inlineData: { data: referenceImage.base64, mimeType: referenceImage.mimeType } });
    engineeredPrompt = `You are an expert photo editor. You will receive an original image, a mask image, a reference image, and a text prompt. Your task is to edit the original image *exclusively* within the white area defined by the mask. You MUST use the third image as a style and material reference. Apply the texture, material, color, and overall style from the reference image onto the masked area of the original image. The black area of the mask MUST remain untouched. The user's instruction for the edit is: "${prompt}". The final output should be a photorealistic image where the edits are seamlessly blended.`;
  } else {
    engineeredPrompt = `You are an expert photo editor. You will receive an original image, a mask image, and a text prompt. Your task is to edit the original image *exclusively* within the white area defined by the mask. The black area of the mask represents the parts of the image that MUST remain completely untouched. The user's instruction for the edit is: "${prompt}". Whether this involves adding a new object, removing an existing one, or altering features, confine all changes strictly to the masked region. The final output should be a photorealistic image where the edits are seamlessly blended with the surrounding, unchanged areas.`;
  }
  
  parts.push({ text: engineeredPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: parts,
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });

  return extractBase64Image(response);
};

/**
 * Generates an image purely from a text prompt.
 * @param prompt - The text prompt to guide the image generation.
 * @returns A promise that resolves to a base64 image URL.
 */
export const generateImageFromText = async (prompt: string): Promise<string | null> => {
    if (!API_KEY) {
        throw new Error("API_KEY is not configured.");
    }

    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    }

    return null;
};

/**
 * Generates a list of diverse prompts based on a source image.
 * @param sourceImage The source architectural image.
 * @returns A promise that resolves to an object containing categorized prompts.
 */
export const generatePromptsFromImage = async (
  sourceImage: SourceImage
): Promise<{ medium: string[], closeup: string[], interior: string[] }> => {
  if (!API_KEY) {
    throw new Error("API_KEY is not configured.");
  }

  const engineeredPrompt = `Analyze the provided architectural image. Based on its style, materials, and environment, generate a list of diverse and creative prompts for photorealistic renders. Your response must be a JSON object.

  Follow these instructions precisely:
  1.  **Cảnh trung (Medium Shots):** Generate exactly 5 prompts describing medium shots around the building. Focus on angles like the main entrance, garden, garage area, or patio.
  2.  **Cảnh cận (Artistic Close-ups):** Generate exactly 10 prompts for artistic, detailed close-up shots. Be creative. Think about textures, light and shadow, depth of field, and storytelling. Examples: "close-up of a water droplet on a leaf in the foreground with the building blurred in the background," or "detailed shot of the wood grain on the front door under the warm evening light."
  3.  **Cảnh nội thất (Interior Shots):** Generate exactly 5 plausible prompts for interior scenes, inferring the style from the exterior. Describe the mood, lighting, and key furniture. Examples: "a cozy living room with a fireplace, looking out the main window during a rainy day," or "a minimalist bedroom with soft morning light filtering through linen curtains."

  All prompts must be in Vietnamese.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro', // Using pro for better reasoning and JSON generation
    contents: {
      parts: [
        { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
        { text: engineeredPrompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          medium: {
            type: Type.ARRAY,
            description: "5 medium shot prompts in Vietnamese.",
            items: { type: Type.STRING }
          },
          closeup: {
            type: Type.ARRAY,
            description: "10 artistic close-up prompts in Vietnamese.",
            items: { type: Type.STRING }
          },
          interior: {
            type: Type.ARRAY,
            description: "5 interior shot prompts in Vietnamese.",
            items: { type: Type.STRING }
          }
        },
        required: ["medium", "closeup", "interior"],
      }
    }
  });

  try {
    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);
    
    // Basic validation
    if (parsedJson.medium && parsedJson.closeup && parsedJson.interior) {
      return parsedJson;
    } else {
      throw new Error("Generated JSON is missing required keys.");
    }
  } catch (e) {
    console.error("Failed to parse JSON response from Gemini:", response.text);
    throw new Error("The AI returned an invalid response format.");
  }
};


/**
 * Generates a video based on a text prompt and an optional source image.
 * @param prompt - The text prompt to guide the video generation.
 * @param sourceImage - An optional source image to base the video on.
 * @param onStatusUpdate - A callback function to report progress.
 * @returns A promise that resolves to a local blob URL for the video.
 */
export const generateVideo = async (
  prompt: string,
  sourceImage: SourceImage | null,
  onStatusUpdate: (status: string) => void
): Promise<string | null> => {
  if (!API_KEY) {
    throw new Error("API_KEY is not configured.");
  }

  onStatusUpdate("Bắt đầu yêu cầu tạo video...");
  
  const aiForVideo = new GoogleGenAI({ apiKey: API_KEY });

  let operation;
  const videoParams: any = {
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
    },
  };

  if (sourceImage) {
    videoParams.image = {
      imageBytes: sourceImage.base64,
      mimeType: sourceImage.mimeType,
    };
  }

  operation = await aiForVideo.models.generateVideos(videoParams);

  onStatusUpdate("Yêu cầu đã được gửi. Đang chờ AI xử lý. Quá trình này có thể mất vài phút.");
  
  // Polling for the result
  let pollCount = 0;
  while (!operation.done) {
    // Wait for 10 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 10000));
    pollCount++;
    onStatusUpdate(`Đang kiểm tra tiến độ lần thứ ${pollCount}... Vui lòng kiên nhẫn.`);
    operation = await aiForVideo.operations.getVideosOperation({ operation: operation });
  }

  onStatusUpdate("Xử lý hoàn tất! Đang tải video...");

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (downloadLink) {
    const response = await fetch(`${downloadLink}&key=${API_KEY}`);
    if (!response.ok) {
      onStatusUpdate("Tải video thất bại.");
      throw new Error("Failed to download video file.");
    }
    const videoBlob = await response.blob();
    const videoUrl = URL.createObjectURL(videoBlob);
    onStatusUpdate("Sẵn sàng để xem!");
    return videoUrl;
  }
  
  return null;
};

export type TourMoveType =
  | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down'
  | 'orbit-left' | 'orbit-right'
  | 'zoom-in' | 'zoom-out';

/**
 * Generates a new image for the virtual tour based on a camera movement command.
 * @param sourceImage The current image in the tour.
 * @param moveType The type of camera movement (pan, orbit, zoom).
 * @param magnitude The amount to move (e.g., degrees for pan/orbit).
 * @returns A promise that resolves to the base64 URL of the new image.
 */
export const generateVirtualTourImage = async (
  sourceImage: SourceImage,
  moveType: TourMoveType,
  magnitude: number
): Promise<string | null> => {
  let prompt = '';
  const magnitudeText = {
      15: 'a small amount',
      30: 'a moderate amount',
      45: 'a large amount',
  }[magnitude as 15 | 30 | 45] || `${magnitude} degrees`;

  const baseInstruction = "You are a virtual camera operator. Re-render the provided scene from a new perspective based on the following precise instruction. You must maintain the exact same photorealistic style, architectural details, materials, lighting, and atmosphere as the original image.";

  switch (moveType) {
    case 'pan-left':
      prompt = `${baseInstruction} INSTRUCTION: PAN LEFT ${magnitude} DEGREES. This is a pure yaw rotation from a fixed camera position, as if on a tripod. Do not move the camera's location.`;
      break;
    case 'pan-right':
      prompt = `${baseInstruction} INSTRUCTION: PAN RIGHT ${magnitude} DEGREES. This is a pure yaw rotation from a fixed camera position, as if on a tripod. Do not move the camera's location.`;
      break;
    case 'pan-up':
      prompt = `${baseInstruction} INSTRUCTION: TILT UP ${magnitude} DEGREES. This is a pure pitch rotation from a fixed camera position, as if on a tripod. Do not move the camera's location.`;
      break;
    case 'pan-down':
      prompt = `${baseInstruction} INSTRUCTION: TILT DOWN ${magnitude} DEGREES. This is a pure pitch rotation from a fixed camera position, as if on a tripod. Do not move the camera's location.`;
      break;
    case 'orbit-left':
      prompt = `${baseInstruction} INSTRUCTION: ORBIT LEFT ${magnitude} DEGREES. The camera's physical position must move. Circle the camera to the left around the scene's central subject, keeping it in frame. Do not change camera height or lens properties.`;
      break;
    case 'orbit-right':
      prompt = `${baseInstruction} INSTRUCTION: ORBIT RIGHT ${magnitude} DEGREES. The camera's physical position must move. Circle the camera to the right around the scene's central subject, keeping it in frame. Do not change camera height or lens properties.`;
      break;
    case 'zoom-in':
      prompt = `${baseInstruction} INSTRUCTION: OPTICAL ZOOM IN (${magnitudeText}). The camera's physical position MUST NOT change. Decrease the lens's field of view to magnify the center of the image.`;
      break;
    case 'zoom-out':
      prompt = `${baseInstruction} INSTRUCTION: OPTICAL ZOOM OUT (${magnitudeText}). The camera's physical position MUST NOT change. Increase the lens's field of view to make the scene appear farther away.`;
      break;
  }
  
  const images = await generateImages(sourceImage, prompt, 'exterior', 1, 'Auto', null, false, true);
  return images.length > 0 ? images[0] : null;
};

/**
 * Generates four mood images for a building sketch at different times of day.
 * @param sourceImage - The source architectural sketch.
 * @returns A promise that resolves to an array of 4 base64 image URLs.
 */
export const generateMoodImages = async (
  sourceImage: SourceImage,
): Promise<string[]> => {
  if (!API_KEY) {
    throw new Error("API_KEY is not configured.");
  }

  const prompts = [
    "Ảnh chụp thực tế của công trình từ bản sketch, bối cảnh ban ngày lúc 10 giờ sáng với nắng gắt và bóng đổ sắc nét.",
    "Ảnh chụp thực tế của công trình từ bản sketch, bối cảnh giữa trưa lúc 11 giờ, trời nhiều mây (overcast) với ánh sáng mềm, khuếch tán và không có nắng trực tiếp.",
    "Ảnh chụp thực tế của công trình từ bản sketch, trong buổi hoàng hôn lúc 4 giờ chiều với ánh sáng vàng ấm và bóng đổ dài.",
    "Ảnh chụp thực tế của công trình từ bản sketch, trong giờ xanh (blue hour) khoảng 6 giờ tối, với ánh sáng xanh đậm và đèn nội thất được bật sáng.",
  ];

  // Call generateImages for each prompt. We want 1 image per prompt.
  const generationPromises = prompts.map(prompt => 
    generateImages(sourceImage, prompt, 'exterior', 1, 'Auto', null, false, true)
  );

  const results = await Promise.all(generationPromises);

  // Each call to generateImages returns an array (e.g., ['image_url']), so we flatten the result.
  const flattenedResults = results.flat();
  
  if (flattenedResults.length < 4) {
      console.warn("Expected 4 images, but received " + flattenedResults.length);
  }

  return flattenedResults.filter((result): result is string => result !== null);
};

/**
 * Generates 10 exterior finishing style prompts for a building under construction.
 * @param sourceImage The image of the building under construction.
 * @returns A promise that resolves to an array of 10 prompt strings.
 */
export const generateCompletionPrompts = async (
  sourceImage: SourceImage
): Promise<string[]> => {
  if (!API_KEY) {
    throw new Error("API_KEY is not configured.");
  }

  const engineeredPrompt = `Analyze the provided image of a building under construction in Vietnam. Based on its form, scale, and context, generate a list of exactly 10 diverse and creative prompts for photorealistic exterior renders showcasing different finishing styles.

  Instructions:
  1.  The prompts must be in Vietnamese.
  2.  Each prompt should describe a complete, finished architectural style.
  3.  Focus on styles commonly found or suitable for Vietnam, such as Modern, Indochine, Neoclassical, Tropical Modern, etc.
  4.  Include details about materials, colors, and lighting to create a compelling visual.
  5.  Your response must be a JSON object with a single key "prompts" which is an array of 10 strings.

  Example prompts:
  - "Hoàn thiện công trình theo phong cách Hiện đại, sử dụng sơn trắng kết hợp mảng ốp gỗ conwood, cửa kính lớn, bối cảnh ban ngày nắng đẹp."
  - "Hoàn thiện công trình theo phong cách Tân cổ điển với các chi tiết phào chỉ tinh tế, sơn màu kem, mái ngói màu xám, lan can sắt nghệ thuật."
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: {
      parts: [
        { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
        { text: engineeredPrompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prompts: {
            type: Type.ARRAY,
            description: "An array of exactly 10 exterior style prompts in Vietnamese.",
            items: { type: Type.STRING }
          },
        },
        required: ["prompts"],
      }
    }
  });

  try {
    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);
    
    if (parsedJson.prompts && Array.isArray(parsedJson.prompts) && parsedJson.prompts.length > 0) {
      return parsedJson.prompts;
    } else {
      throw new Error("Generated JSON is missing the 'prompts' array.");
    }
  } catch (e) {
    console.error("Failed to parse JSON response from Gemini for completion prompts:", response.text);
    throw new Error("The AI returned an invalid response format for completion prompts.");
  }
};

/**
 * Generates 10 interior design style prompts for an empty room.
 * @param sourceImage The image of the empty room under construction.
 * @returns A promise that resolves to an array of 10 prompt strings.
 */
export const generateInteriorCompletionPrompts = async (
  sourceImage: SourceImage
): Promise<string[]> => {
  if (!API_KEY) {
    throw new Error("API_KEY is not configured.");
  }

  const engineeredPrompt = `Analyze the provided image of an empty room under construction in Vietnam. Based on its spatial qualities, lighting, and potential, generate a list of exactly 10 diverse and creative prompts for photorealistic interior renders showcasing different finishing styles.

  Instructions:
  1.  The prompts must be in Vietnamese.
  2.  Each prompt should describe a complete, finished interior design style.
  3.  Focus on styles commonly found or suitable for Vietnam, such as Modern, Indochine, Wabi-sabi, Scandinavian, Minimalist, etc.
  4.  Include details about materials, colors, furniture, and lighting to create a compelling visual.
  5.  Your response must be a JSON object with a single key "prompts" which is an array of 10 strings.

  Example prompts:
  - "Hoàn thiện nội thất phòng theo phong cách Hiện đại, sử dụng sàn gỗ sồi, tường sơn trắng, sofa màu xám và cửa sổ lớn đón nắng tự nhiên."
  - "Hoàn thiện nội thất phòng theo phong cách Indochine với sàn gạch bông, đồ nội thất gỗ sẫm màu, và các chi tiết trang trí bằng mây tre đan."
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: {
      parts: [
        { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
        { text: engineeredPrompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prompts: {
            type: Type.ARRAY,
            description: "An array of exactly 10 interior style prompts in Vietnamese.",
            items: { type: Type.STRING }
          },
        },
        required: ["prompts"],
      }
    }
  });

  try {
    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);
    
    if (parsedJson.prompts && Array.isArray(parsedJson.prompts) && parsedJson.prompts.length > 0) {
      return parsedJson.prompts;
    } else {
      throw new Error("Generated JSON is missing the 'prompts' array.");
    }
  } catch (e) {
    console.error("Failed to parse JSON response from Gemini for interior completion prompts:", response.text);
    throw new Error("The AI returned an invalid response format for interior completion prompts.");
  }
};