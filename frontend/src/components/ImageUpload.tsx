"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Image as ImageIcon, Plus, Loader2 } from "lucide-react";

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function ImageUpload({ images, onImagesChange, maxImages = 5 }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    const newUrls = imageFiles.slice(0, maxImages - images.length).map(f => URL.createObjectURL(f));
    
    // Mark new images as loading
    const startIdx = images.length;
    const newLoading = new Set(loadingImages);
    newUrls.forEach((_, i) => newLoading.add(startIdx + i));
    setLoadingImages(newLoading);
    
    onImagesChange([...images, ...newUrls]);
  }, [images, maxImages, onImagesChange, loadingImages]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newUrls = files.slice(0, maxImages - images.length).map(f => URL.createObjectURL(f));
    
    const startIdx = images.length;
    const newLoading = new Set(loadingImages);
    newUrls.forEach((_, i) => newLoading.add(startIdx + i));
    setLoadingImages(newLoading);
    
    onImagesChange([...images, ...newUrls]);
    if (e.target) e.target.value = "";
  }, [images, maxImages, onImagesChange, loadingImages]);

  const handleRemove = useCallback((index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages);
  }, [images, onImagesChange]);

  const handleImageLoaded = useCallback((index: number) => {
    setLoadingImages(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-3">
      {/* Compact upload area when images exist */}
      {images.length === 0 ? (
        // Empty state - larger drop zone
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200
            ${isDragging 
              ? "border-primary bg-primary/5" 
              : "border-black/10 hover:border-black/20 hover:bg-black/[0.02]"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isDragging ? "bg-primary/10" : "bg-black/5"
            }`}>
              <Upload className={`w-5 h-5 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground/80">
                Drop images or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                PNG, JPG up to 10MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        // Images uploaded - show compact grid with add button
        <div className="flex gap-2 flex-wrap">
          {images.map((url, index) => (
            <div key={index} className="relative group">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/5 border border-black/10">
                {loadingImages.has(index) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                  onLoad={() => handleImageLoaded(index)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    handleImageLoaded(index);
                  }}
                />
              </div>
              <button
                onClick={() => handleRemove(index)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          
          {/* Add more button */}
          {canAddMore && (
            <button
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition-all ${
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-black/10 hover:border-black/20 hover:bg-black/[0.02]"
              }`}
            >
              <Plus className={`w-5 h-5 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Counter - only show when images exist */}
      {images.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {images.length}/{maxImages} images
        </p>
      )}
    </div>
  );
}
