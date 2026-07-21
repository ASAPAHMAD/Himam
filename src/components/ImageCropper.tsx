import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Check, X, Move } from 'lucide-react';

interface ImageCropperProps {
  file: File;
  onCropComplete: (croppedBlob: Blob, base64: string) => void;
  onCancel: () => void;
}

export default function ImageCropper({ file, onCropComplete, onCancel }: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load image file as data URL
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImageSrc(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
    
    // Reset state when file changes
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  }, [file]);

  // Touch and Mouse Event Handlers for Panning the Image
  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStart.current = { x: clientX - offset.x, y: clientY - offset.y };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setOffset({
      x: clientX - dragStart.current.x,
      y: clientY - dragStart.current.y
    });
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    e.preventDefault();
    handleMove(e.clientX, e.clientY);
  };

  const onMouseUp = () => {
    handleEnd();
  };

  // Touch events for mobile support
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchEnd = () => {
    handleEnd();
  };

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    setOffset({ x: 0, y: 0 }); // Reset pan on rotation
  };

  const handleCrop = () => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    const size = 512; // Standardized output avatar size (512x512 px for high-DPI screens)
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Fill background with black/transparent
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    // Save context
    ctx.save();

    // 1. Move origin to center of canvas
    ctx.translate(size / 2, size / 2);

    // 2. Rotate if specified
    ctx.rotate((rotation * Math.PI) / 180);

    // 3. Draw image with scale and offset
    // Calculate display dimensions inside container
    const cropBoxSize = 200; // Visual viewport width/height
    const imgNaturalWidth = img.naturalWidth;
    const imgNaturalHeight = img.naturalHeight;

    // Match aspect ratio
    let drawWidth = cropBoxSize;
    let drawHeight = cropBoxSize;
    if (imgNaturalWidth > imgNaturalHeight) {
      drawWidth = (imgNaturalWidth / imgNaturalHeight) * cropBoxSize;
    } else {
      drawHeight = (imgNaturalHeight / imgNaturalWidth) * cropBoxSize;
    }

    // Scale draw size by zoom factor
    drawWidth *= zoom;
    drawHeight *= zoom;

    // Convert display offset to canvas scale
    const scaleFactor = size / cropBoxSize;
    
    // Calculate render offsets (compensating for canvas translation to center)
    // We adjust drawing coordinates by panned offsets multiplied by resolution scale factor
    let xOffset = offset.x * scaleFactor;
    let yOffset = offset.y * scaleFactor;

    // Based on rotation, we need to map offsets accordingly
    if (rotation === 90) {
      const temp = xOffset;
      xOffset = yOffset;
      yOffset = -temp;
    } else if (rotation === 180) {
      xOffset = -xOffset;
      yOffset = -yOffset;
    } else if (rotation === 270) {
      const temp = xOffset;
      xOffset = -yOffset;
      yOffset = temp;
    }

    ctx.drawImage(
      img,
      -drawWidth / 2 * scaleFactor + xOffset,
      -drawHeight / 2 * scaleFactor + yOffset,
      drawWidth * scaleFactor,
      drawHeight * scaleFactor
    );

    ctx.restore();

    // Get as PNG base64 and Blob
    const mimeType = 'image/jpeg';
    const quality = 0.85;
    const dataUrl = canvas.toDataURL(mimeType, quality);
    const base64 = dataUrl.split(',')[1];

    canvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob, base64);
      }
    }, mimeType, quality);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" id="image-cropper-modal">
      <div className="w-full max-w-md bg-[#171B24] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#171B24]">
          <h3 className="text-sm font-bold text-white font-serif tracking-wide flex items-center gap-1.5">
            <Move className="w-4 h-4 text-[#D4AF37]" />
            Frame &amp; Crop Avatar
          </h3>
          <button 
            onClick={onCancel}
            className="p-1.5 text-[#94949C] hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Interactive Cropping Area */}
        <div className="p-6 flex flex-col items-center justify-center bg-black/40 flex-1 overflow-y-auto">
          <p className="text-[11px] text-[#94949C] mb-4 text-center">
            Drag to pan the image. Use the slider to zoom. Rotate to fix orientation.
          </p>

          <div 
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="relative w-72 h-72 bg-[#0B0D12] border border-white/5 rounded-xl flex items-center justify-center overflow-hidden cursor-move select-none"
            style={{ touchAction: 'none' }}
          >
            {/* Image to be cropped */}
            {imageSrc && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop Source"
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                className="max-w-none origin-center select-none pointer-events-none transition-transform duration-75"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  width: '200px', // base display size
                  height: 'auto',
                }}
              />
            )}

            {/* Circular Crop Mask Overlay */}
            <div className="absolute inset-0 border-[36px] border-black/70 pointer-events-none flex items-center justify-center">
              <div className="w-[200px] h-[200px] rounded-full border border-[#D4AF37] shadow-[0_0_0_999px_rgba(0,0,0,0.4)] ring-2 ring-black/40"></div>
            </div>
          </div>

          {/* Sizing & Rotation Controls */}
          <div className="w-full mt-6 space-y-4">
            
            {/* Zoom Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-[#94949C] font-semibold">
                <span className="flex items-center gap-1"><ZoomOut className="w-3 h-3" /> Scale</span>
                <span className="font-mono text-[#D4AF37]">{Math.round(zoom * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-[#D4AF37] bg-white/5 rounded-lg h-1.5 appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Helper Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={rotate}
                className="px-3 py-2 text-xs font-semibold text-[#E0E0E6] bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-1.5 transition-all active:scale-95"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#D4AF37]" />
                Rotate 90°
              </button>
              
              <div className="text-[10px] text-[#55555B] text-right">
                512 &times; 512 px JPG
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/5 bg-[#161619] flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-[#94949C] hover:text-white transition-all"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleCrop}
            className="px-4 py-2 text-xs font-bold bg-[#D4AF37] hover:bg-[#D5B069] text-black rounded-lg flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Crop &amp; Apply
          </button>
        </div>

      </div>
    </div>
  );
}
