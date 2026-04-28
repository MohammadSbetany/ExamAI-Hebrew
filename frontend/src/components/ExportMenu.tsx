import { useState, useRef, useEffect } from 'react';
import type { Question, GradeResult } from '@/types/questions';
import {
  exportBlankPdf,
  exportGradedPdf,
  exportBlankDocx,
  exportGradedDocx,
} from '@/lib/exportUtils';

interface ExportMenuProps {
  questions: Question[];
  gradeResult: GradeResult | null;
  variant: 'blank' | 'graded';
}

const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ExportMenu = ({ questions, gradeResult, variant }: ExportMenuProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<'pdf' | 'docx' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = variant === 'blank' ? 'ייצוא בחינה' : 'הורד דוח ציון';
  const buttonColor = variant === 'blank'
    ? 'border-border text-foreground hover:bg-muted'
    : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20';

  const handleExport = async (format: 'pdf' | 'docx') => {
    setLoading(format);
    setOpen(false);
    try {
      if (variant === 'blank') {
        if (format === 'pdf') await exportBlankPdf(questions);
        else await exportBlankDocx(questions);
      } else {
        if (!gradeResult) return;
        if (format === 'pdf') await exportGradedPdf(questions, gradeResult);
        else await exportGradedDocx(questions, gradeResult);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading !== null}
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold
          transition-all duration-150 disabled:opacity-60
          ${buttonColor}
        `}
      >
        {loading ? (
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          <DownloadIcon />
        )}
        {loading ? 'מכין...' : label}
        <ChevronIcon />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-44 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <button
            onClick={() => handleExport('pdf')}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors text-right"
          >
            <span className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold flex-shrink-0">
              PDF
            </span>
            <span>קובץ PDF</span>
          </button>
          <div className="h-px bg-border mx-3" />
          <button
            onClick={() => handleExport('docx')}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors text-right"
          >
            <span className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
              W
            </span>
            <span>קובץ Word</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;