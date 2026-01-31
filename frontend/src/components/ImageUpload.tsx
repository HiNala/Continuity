"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function ImageUpload({ images, onImagesChange, maxImages = 5 }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState("");
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
    
    // Convert to object URLs for preview
    const newUrls = imageFiles.slice(0, maxImages - images.length).map(f => URL.createObjectURL(f));
    onImagesChange([...images, ...newUrls]);
  }, [images, maxImages, onImagesChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newUrls = files.slice(0, maxImages - images.length).map(f => URL.createObjectURL(f));
    onImagesChange([...images, ...newUrls]);
  }, [images, maxImages, onImagesChange]);

  const handleUrlAdd = useCallback(() => {
    if (urlInput.trim() && images.length < maxImages) {
      onImagesChange([...images, urlInput.trim()]);
      setUrlInput("");
    }
  }, [urlInput, images, maxImages, onImagesChange]);

  const handleRemove = useCallback((index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages);
  }, [images, onImagesChange]);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging 
            ? "border-continuity-500 bg-continuity-500/10" 
            : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/30"
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
        
        <div className="flex flex-col items-center gap-3">
          <div className={`
            w-12 h-12 rounded-full flex items-center justify-center
            ${isDragging ? "bg-continuity-500/20" : "bg-slate-800"}
          `}>
            <Upload className={`w-6 h-6 ${isDragging ? "text-continuity-400" : "text-slate-400"}`} />
          </div>
          <div>
            <p className="text-slate-300 font-medium">
              Drop images here or click to browse
            </p>
            <p className="text-sm text-slate-500 mt-1">
              PNG, JPG up to 10MB each
            </p>
          </div>
        </div>
      </div>

      {/* URL Input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUrlAdd()}
          placeholder="Or paste image URL..."
          className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-continuity-500/50 focus:border-continuity-500 text-sm"
        />
        <button
          onClick={handleUrlAdd}
          disabled={!urlInput.trim() || images.length >= maxImages}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          Add
        </button>
      </div>

      {/* Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((url, index) => (
            <div key={index} className="relative group aspect-square">
              <div className="w-full h-full rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                    (e.target as HTMLImageElement).className = "hidden";
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  <ImageIcon className="w-8 h-8 text-slate-600" />
                </div>
              </div>
              <button
                onClick={() => handleRemove(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Counter */}
      {images.length > 0 && (
        <p className="text-xs text-slate-500 text-center">
          {images.length} of {maxImages} images
        </p>
      )}
    </div>
  );
}
