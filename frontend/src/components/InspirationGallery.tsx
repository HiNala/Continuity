"use client";

import { useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  ChevronRight,
  Check,
  Loader2,
  Sparkles,
  ImageIcon,
  AlertCircle,
  X,
} from "lucide-react";
import {
  browseInspiration,
  refreshInspiration,
  InspirationImage,
  BrowseInspirationResponse,
} from "@/lib/api";

interface InspirationGalleryProps {
  /** The user's design query to search for inspiration */
  query: string;
  /** Optional design style filter */
  style?: string;
  /** Optional space type filter */
  spaceType?: string;
  /** Currently selected inspiration image URLs */
  selectedImages: string[];
  /** Callback when images are selected/deselected */
  onSelectionChange: (images: string[]) => void;
  /** Maximum number of images that can be selected */
  maxSelection?: number;
  /** Whether to auto-fetch when query changes */
  autoFetch?: boolean;
}

export function InspirationGallery({
  query,
  style,
  spaceType,
  selectedImages,
  onSelectionChange,
  maxSelection = 3,
  autoFetch = false,
}: InspirationGalleryProps) {
  const [images, setImages] = useState<InspirationImage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch inspiration images
  const fetchInspiration = useCallback(async (refresh: boolean = false) => {
    if (!query.trim()) {
      setError("Enter a design goal to see inspiration images");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let response: BrowseInspirationResponse;
      
      if (refresh || !sessionId) {
        // Fresh fetch
        response = await refreshInspiration({
          query,
          style,
          space_type: spaceType,
        });
      } else {
        // Get next page from session
        response = await browseInspiration({
          query,
          style,
          space_type: spaceType,
          session_id: sessionId,
        });
      }

      if (response.success) {
        setImages(response.images);
        setSessionId(response.session_id);
        setHasMore(response.has_more);
        setCurrentPage(response.current_page);
        setTotalPages(response.total_pages);
        setIsInitialized(true);
      } else {
        setError(response.note || "Failed to fetch inspiration images");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [query, style, spaceType, sessionId]);

  // Handle "See More" click - get next set of 3
  const handleSeeMore = useCallback(() => {
    if (!loading && sessionId) {
      fetchInspiration(false);
    }
  }, [loading, sessionId, fetchInspiration]);

  // Handle "Refresh" click - get entirely new images
  const handleRefresh = useCallback(() => {
    if (!loading) {
      setSessionId(null);
      fetchInspiration(true);
    }
  }, [loading, fetchInspiration]);

  // Handle image selection toggle
  const handleImageClick = (image: InspirationImage) => {
    const isSelected = selectedImages.includes(image.url);
    
    if (isSelected) {
      // Remove from selection
      onSelectionChange(selectedImages.filter(url => url !== image.url));
    } else {
      // Add to selection (if under max)
      if (selectedImages.length < maxSelection) {
        onSelectionChange([...selectedImages, image.url]);
      }
    }
  };

  // Remove a selected image
  const handleRemoveSelected = (url: string) => {
    onSelectionChange(selectedImages.filter(u => u !== url));
  };

  // Auto-fetch when query changes (if enabled)
  useEffect(() => {
    if (autoFetch && query.trim().length > 5) {
      const timer = setTimeout(() => {
        setSessionId(null);
        fetchInspiration(true);
      }, 500); // Debounce
      return () => clearTimeout(timer);
    }
  }, [query, autoFetch, fetchInspiration]);

  return (
    <div className="space-y-4">
      {/* Header with fetch button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-continuity-400" />
          <span className="font-medium text-slate-300">Web Inspiration</span>
          <span className="text-xs text-slate-500">
            ({selectedImages.length}/{maxSelection} selected)
          </span>
        </div>
        
        {!isInitialized && (
          <button
            onClick={() => fetchInspiration(true)}
            disabled={loading || !query.trim()}
            className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Finding...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Find Inspiration
              </>
            )}
          </button>
        )}
      </div>

      {/* Selected images display */}
      {selectedImages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedImages.map((url, index) => (
            <div
              key={`selected-${index}`}
              className="relative group w-16 h-16 rounded-lg overflow-hidden border-2 border-continuity-500"
            >
              <img
                src={url}
                alt={`Selected ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => handleRemoveSelected(url)}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <div className="absolute top-1 right-1 w-5 h-5 bg-continuity-500 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Images grid */}
      {isInitialized && (
        <div className="space-y-3">
          {loading && images.length === 0 ? (
            // Loading skeleton
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : images.length > 0 ? (
            <>
              {/* Image grid */}
              <div className="grid grid-cols-3 gap-3">
                {images.map((image) => {
                  const isSelected = selectedImages.includes(image.url);
                  const canSelect = selectedImages.length < maxSelection || isSelected;
                  
                  return (
                    <button
                      key={image.id}
                      onClick={() => handleImageClick(image)}
                      disabled={!canSelect && !isSelected}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
                        isSelected
                          ? "border-continuity-500 ring-2 ring-continuity-500/30"
                          : canSelect
                          ? "border-transparent hover:border-slate-600"
                          : "border-transparent opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <img
                        src={image.thumbnail || image.url}
                        alt={image.description}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      
                      {/* Hover overlay with description */}
                      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity ${
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}>
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-xs text-white line-clamp-2">
                            {image.description}
                          </p>
                        </div>
                      </div>
                      
                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-continuity-500 rounded-full flex items-center justify-center shadow-lg">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                      
                      {/* Click to select indicator */}
                      {!isSelected && canSelect && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ImageIcon className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Pagination info and controls */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Set {currentPage + 1} of {totalPages}
                </span>
                
                <div className="flex items-center gap-2">
                  {/* Refresh button */}
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                    title="Get new images"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  
                  {/* See More button */}
                  <button
                    onClick={handleSeeMore}
                    disabled={loading}
                    className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                    title={hasMore ? "See next set" : "Back to first set"}
                  >
                    {loading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    {hasMore ? "See More" : "Start Over"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Empty state
            <div className="text-center py-8 text-slate-500">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No inspiration images found</p>
              <button
                onClick={handleRefresh}
                className="mt-2 text-xs text-continuity-400 hover:text-continuity-300"
              >
                Try refreshing
              </button>
            </div>
          )}
        </div>
      )}

      {/* Initial state hint */}
      {!isInitialized && !loading && !error && (
        <div className="text-center py-6 border border-dashed border-slate-700 rounded-lg">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-500 mb-1">
            Find design inspiration from the web
          </p>
          <p className="text-xs text-slate-600">
            Click &quot;Find Inspiration&quot; to search based on your goal
          </p>
        </div>
      )}
    </div>
  );
}
