"use client";

import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUp, Paperclip, X, ImageIcon, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

// Animation constants
const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
};

const smoothTransition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex w-full bg-transparent px-4 py-4 text-[15px] text-foreground dark:text-zinc-100 placeholder:text-muted-foreground/50 dark:placeholder:text-zinc-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 min-h-[56px] resize-none leading-relaxed transition-colors duration-200",
        className
      )}
      ref={ref}
      rows={1}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 rounded-lg bg-neutral-900 dark:bg-zinc-100 backdrop-blur-sm px-2.5 py-1.5 text-xs text-white dark:text-zinc-900 shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 w-full max-w-[90vw] md:max-w-[720px] translate-x-[-50%] translate-y-[-50%] border border-neutral-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 backdrop-blur-2xl p-0 shadow-[0_24px_64px_rgba(0,0,0,0.25)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-3xl overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-neutral-100 dark:bg-zinc-800 p-2 hover:bg-neutral-200 dark:hover:bg-zinc-700 transition-all duration-200 hover:scale-105 border border-neutral-200 dark:border-zinc-700">
        <X className="h-4 w-4 text-neutral-600 dark:text-zinc-400" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-medium text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

interface ImageViewDialogProps {
  imageUrl: string | null;
  onClose: () => void;
}

const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="p-2 max-w-[85vw] md:max-w-[720px]">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Full preview"
          className="w-full max-h-[80vh] object-contain rounded-2xl"
        />
      </DialogContent>
    </Dialog>
  );
};

interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
  isFocused: boolean;
  setIsFocused: (focused: boolean) => void;
}

const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 200,
  onSubmit: undefined,
  disabled: false,
  isFocused: false,
  setIsFocused: () => {},
});

function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 200,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const [isFocused, setIsFocused] = React.useState(false);
    
    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    
    return (
      <TooltipProvider delayDuration={200}>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
            isFocused,
            setIsFocused,
          }}
        >
          <motion.div
            ref={ref}
            initial={false}
            animate={{
              scale: isFocused ? 1.005 : 1,
            }}
            transition={springTransition}
            className={cn(
              "relative rounded-2xl border backdrop-blur-2xl transition-all duration-300",
              "bg-white/40 dark:bg-zinc-900/60",
              isFocused 
                ? "border-primary/40 dark:border-primary/50 bg-white/55 dark:bg-zinc-900/80 shadow-lg shadow-primary/5 dark:shadow-primary/10" 
                : "border-neutral-200/60 dark:border-zinc-700/60 hover:border-neutral-300 dark:hover:border-zinc-600 hover:bg-white/50 dark:hover:bg-zinc-900/70 shadow-sm",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {/* Focus glow effect */}
            <motion.div
              initial={false}
              animate={{
                opacity: isFocused ? 1 : 0,
              }}
              transition={{ duration: 0.3 }}
              className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 dark:from-primary/30 dark:via-accent/20 dark:to-primary/30 -z-10 blur-lg"
            />
            {children}
          </motion.div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps {
  disableAutosize?: boolean;
  placeholder?: string;
}

const PromptInputTextarea: React.FC<
  PromptInputTextareaProps & React.ComponentProps<typeof Textarea>
> = ({ className, onKeyDown, disableAutosize = false, placeholder, ...props }) => {
  const { value, setValue, maxHeight, onSubmit, disabled, setIsFocused } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={className}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
};

type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>;

const PromptInputActions: React.FC<PromptInputActionsProps> = ({
  children,
  className,
  ...props
}) => (
  <div className={cn("flex items-center gap-1.5", className)} {...props}>
    {children}
  </div>
);

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

const PromptInputAction: React.FC<PromptInputActionProps> = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className as string}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>(
  (props, ref) => {
    const {
      onSend = () => {},
      isLoading = false,
      placeholder = "Describe your vision...",
      className,
      compact = false,
    } = props;
    const [input, setInput] = React.useState("");
    const [files, setFiles] = React.useState<File[]>([]);
    const [filePreviews, setFilePreviews] = React.useState<Record<string, string>>({});
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const uploadInputRef = React.useRef<HTMLInputElement>(null);
    const promptBoxRef = React.useRef<HTMLDivElement>(null);

    const isImageFile = (file: File) => file.type.startsWith("image/");

    const processFile = (file: File) => {
      if (!isImageFile(file) || file.size > 10 * 1024 * 1024) return;
      setFiles((prev) => [...prev, file]);
      const reader = new FileReader();
      reader.onload = (e) =>
        setFilePreviews((prev) => ({
          ...prev,
          [file.name]: e.target?.result as string,
        }));
      reader.readAsDataURL(file);
    };

    const handleDragOver = React.useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    }, []);

    const handleDragLeave = React.useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    }, []);

    const handleDrop = React.useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      Array.from(e.dataTransfer.files)
        .filter(isImageFile)
        .forEach((file) => {
          if (!isImageFile(file) || file.size > 10 * 1024 * 1024) return;
          setFiles((prev) => [...prev, file]);
          const reader = new FileReader();
          reader.onload = (evt) =>
            setFilePreviews((prev) => ({
              ...prev,
              [file.name]: evt.target?.result as string,
            }));
          reader.readAsDataURL(file);
        });
    }, []);

    const handleRemoveFile = (index: number) => {
      const fileToRemove = files[index];
      if (fileToRemove) {
        setFilePreviews((prev) => {
          const next = { ...prev };
          delete next[fileToRemove.name];
          return next;
        });
      }
      setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handlePaste = React.useCallback((e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file && isImageFile(file) && file.size <= 10 * 1024 * 1024) {
            e.preventDefault();
            setFiles((prev) => [...prev, file]);
            const reader = new FileReader();
            reader.onload = (evt) =>
              setFilePreviews((prev) => ({
                ...prev,
                [file.name]: evt.target?.result as string,
              }));
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    }, []);

    React.useEffect(() => {
      document.addEventListener("paste", handlePaste);
      return () => document.removeEventListener("paste", handlePaste);
    }, [handlePaste]);

    const handleSubmit = () => {
      if (input.trim() || files.length > 0) {
        onSend(input, files);
        setInput("");
        setFiles([]);
        setFilePreviews({});
      }
    };

    const hasContent = input.trim() !== "" || files.length > 0;

    return (
      <>
        <PromptInput
          value={input}
          onValueChange={setInput}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          className={cn(
            "w-full",
            isDragging && "border-primary/50 bg-primary/10",
            className
          )}
          disabled={isLoading}
          ref={ref || promptBoxRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={smoothTransition}
                className={cn("flex flex-wrap gap-2.5 p-4 pb-0", compact && "p-3 pb-0")}
              >
                {files.map((file, index) => (
                  <motion.div
                    key={file.name}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={springTransition}
                    whileHover={{ scale: 1.02 }}
                    className="relative group"
                  >
                    {filePreviews[file.name] && (
                      <button
                        type="button"
                        className={cn(
                          "rounded-lg overflow-hidden ring-1 ring-black/10 dark:ring-white/10 hover:ring-primary/40 dark:hover:ring-primary/50 transition-all shadow-sm",
                          compact ? "w-14 h-14" : "w-16 h-16"
                        )}
                        onClick={() => setSelectedImage(filePreviews[file.name])}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={filePreviews[file.name]}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    )}
                    <motion.button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      initial={{ opacity: 0 }}
                      whileHover={{ scale: 1.1 }}
                      animate={{ opacity: 1 }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-md border border-white/20 dark:border-zinc-800"
                    >
                      <X className="w-3 h-3" />
                    </motion.button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-10 rounded-2xl bg-primary/10 dark:bg-primary/20 border-2 border-dashed border-primary/40 dark:border-primary/50 flex items-center justify-center backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 10 }}
                  className="text-center"
                >
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-10 h-10 rounded-xl bg-white/60 dark:bg-zinc-800/60 border border-white/80 dark:border-zinc-700 flex items-center justify-center mx-auto mb-2 shadow-sm"
                  >
                    <ImageIcon className="w-5 h-5 text-primary/80 dark:text-primary" />
                  </motion.div>
                  <p className="text-sm text-primary/80 dark:text-primary font-medium">Drop images here</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <PromptInputTextarea placeholder={placeholder} />

          <PromptInputActions className={cn("flex items-center justify-between px-4 pb-4", compact && "px-3 pb-3")}>
            <div className="flex items-center gap-3">
              <PromptInputAction tooltip="Attach images">
                <motion.button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex h-9 w-9 text-neutral-500 dark:text-zinc-400 items-center justify-center rounded-xl transition-colors hover:text-neutral-900 dark:hover:text-zinc-100 hover:bg-neutral-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900"
                  aria-label="Attach images"
                >
                  <Paperclip className="h-[18px] w-[18px]" />
                  <input
                    ref={uploadInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        Array.from(e.target.files).forEach(processFile);
                      }
                      if (e.target) e.target.value = "";
                    }}
                    accept="image/*"
                    multiple
                  />
                </motion.button>
              </PromptInputAction>
              <AnimatePresence>
                {files.length > 0 && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="text-xs text-neutral-400 dark:text-zinc-500 font-medium"
                  >
                    {files.length} image{files.length > 1 ? "s" : ""} attached
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <PromptInputAction tooltip={hasContent ? "Send" : "Enter prompt or add images"}>
              <motion.button
                type="button"
                whileHover={hasContent && !isLoading ? { scale: 1.08 } : {}}
                whileTap={hasContent && !isLoading ? { scale: 0.95 } : {}}
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900",
                  hasContent
                    ? "bg-gradient-to-br from-primary via-primary to-accent text-white shadow-lg shadow-primary/30 dark:shadow-primary/40"
                    : "bg-neutral-100 dark:bg-zinc-800 text-neutral-400 dark:text-zinc-500 border border-neutral-200 dark:border-zinc-700"
                )}
                onClick={handleSubmit}
                disabled={!hasContent || isLoading}
                aria-label="Send prompt"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </motion.button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>

        <ImageViewDialog
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      </>
    );
  }
);
PromptInputBox.displayName = "PromptInputBox";
