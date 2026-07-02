import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import type { Question, GradeResult } from '@/types/questions';
import { exportBlankDocx, exportGradedDocx } from '@/lib/exportUtils';

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

const ExportMenu = ({ questions, gradeResult, variant }: ExportMenuProps) => {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const label = variant === 'blank' ? t('exportMenu.exportExam') : t('exportMenu.downloadReport');
  const buttonColor = variant === 'blank'
    ? 'border-border text-foreground hover:bg-muted'
    : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20';

  const handleExport = async () => {
    setLoading(true);
    try {
      if (variant === 'blank') await exportBlankDocx(questions);
      else { if (!gradeResult) return; await exportGradedDocx(questions, gradeResult); }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
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
      {loading ? t('exportMenu.preparing') : label}
    </button>
  );
};

export default ExportMenu;
