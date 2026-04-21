import { useRef, useState, type MouseEvent, type ChangeEvent, type DragEvent } from 'react';

const MAX_FILES = 5;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
];
const ALLOWED_LABEL = 'PDF, DOCX, TXT, PPTX, JPG, PNG';

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  selectedFiles: File[];
  disabled?: boolean;
}

const FileIcon = () => (
  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
    <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={2} />
    <polyline points="21 15 16 10 5 21" strokeWidth={2} />
  </svg>
);

const FileUpload = ({ onFilesChange, selectedFiles, disabled }: FileUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isImage = (file: File) => file.type.startsWith('image/');

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter(f => ALLOWED_TYPES.includes(f.type));
    const merged = [...selectedFiles, ...valid].slice(0, MAX_FILES);
    // Deduplicate by name
    const unique = merged.filter((f, i, arr) => arr.findIndex(x => x.name === f.name) === i);
    onFilesChange(unique);
  };

  const removeFile = (index: number, e: MouseEvent) => {
    e.stopPropagation();
    const updated = selectedFiles.filter((_, i) => i !== index);
    onFilesChange(updated);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClick = () => {
    if (!disabled && selectedFiles.length < MAX_FILES) inputRef.current?.click();
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!disabled) addFiles(e.dataTransfer.files);
  };

  const canAddMore = selectedFiles.length < MAX_FILES && !disabled;

  return (
    <div className="space-y-3">

      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          upload-zone p-6 cursor-pointer text-center transition-all
          ${isDragOver ? 'upload-zone-active' : ''}
          ${!canAddMore ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.pptx,.jpg,.jpeg,.png"
          multiple
          onChange={handleChange}
          className="hidden"
          disabled={!canAddMore}
        />

        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">
              {canAddMore ? 'גרור קבצים לכאן' : `הגעת למקסימום (${MAX_FILES} קבצים)`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {canAddMore ? `או לחץ לבחירה · עד ${MAX_FILES} קבצים` : 'הסר קובץ כדי להוסיף אחר'}
            </p>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {ALLOWED_LABEL}
          </span>
        </div>
      </div>

      {/* Selected files chips */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {selectedFiles.length} / {MAX_FILES} קבצים נבחרו
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent rounded-lg border border-border text-sm max-w-full"
              >
                {isImage(file) ? <ImageIcon /> : <FileIcon />}
                <span className="truncate max-w-[150px] text-foreground font-medium">
                  {file.name}
                </span>
                <span className="text-muted-foreground text-xs flex-shrink-0">
                  {(file.size / 1024 / 1024).toFixed(1)}MB
                </span>
                {!disabled && (
                  <button
                    onClick={(e) => removeFile(index, e)}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mr-1"
                    title="הסר קובץ"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18" strokeWidth={2} strokeLinecap="round" />
                      <line x1="6" y1="6" x2="18" y2="18" strokeWidth={2} strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;