import jsPDF from 'jspdf';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Question, GradeResult } from '@/types/questions';

const sanitize = (text: string) => (text || '').replace(/\r/g, '');

const buildFilename = (type: 'blank' | 'graded', score?: number, ext = 'pdf') => {
  if (type === 'graded' && score !== undefined) return `Exam_Graded_${score}.${ext}`;
  return `Exam_Blank.${ext}`;
};

// ── Font loading ──────────────────────────────────────────────────────────────

let fontBase64: { regular: string; bold: string } | null = null;

const loadHebrewFont = async (doc: jsPDF) => {
  if (!fontBase64) {
    const toBase64 = async (url: string) => {
      const buf = await (await fetch(url)).arrayBuffer();
      return btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
    };
    try {
      fontBase64 = {
        regular: await toBase64('/fonts/Heebo-Regular.ttf'),
        bold: await toBase64('/fonts/Heebo-Bold.ttf'),
      };
    } catch {
      console.warn('Hebrew font could not be loaded.');
      return;
    }
  }
  doc.addFileToVFS('Heebo-Regular.ttf', fontBase64.regular);
  doc.addFont('Heebo-Regular.ttf', 'Heebo', 'normal');
  doc.addFileToVFS('Heebo-Bold.ttf', fontBase64.bold);
  doc.addFont('Heebo-Bold.ttf', 'Heebo', 'bold');
};
// ── PDF helpers ───────────────────────────────────────────────────────────────

const PDF_MARGIN = 20;
const PDF_WIDTH = 210;
const PDF_CONTENT_WIDTH = PDF_WIDTH - PDF_MARGIN * 2;

const setFont = (doc: jsPDF, style: 'normal' | 'bold' = 'normal') =>
  doc.setFont(fontBase64 ? 'Heebo' : 'helvetica', style);

const addPdfHeader = (doc: jsPDF, title: string) => {
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, PDF_WIDTH, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  setFont(doc, 'bold');
  doc.text(title, PDF_WIDTH - PDF_MARGIN, 14, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  return 32;
};

const addPdfFooter = (doc: jsPDF, pageNum: number) => {
  const h = doc.internal.pageSize.height;
  doc.setDrawColor(203, 213, 225);
  doc.line(PDF_MARGIN, h - 12, PDF_WIDTH - PDF_MARGIN, h - 12);
  doc.setFontSize(8);
  setFont(doc);
  doc.setTextColor(148, 163, 184);
  doc.setR2L(false);
  doc.text(`ExamAI Hebrew · ${new Date().toLocaleDateString('he-IL')}`, PDF_MARGIN, h - 6);
  doc.text(String(pageNum), PDF_WIDTH - PDF_MARGIN, h - 6, { align: 'right' });
  doc.setR2L(true);
};

const checkNewPage = (doc: jsPDF, y: number, needed = 20): number => {
  if (y + needed > doc.internal.pageSize.height - 20) {
    doc.addPage();
    addPdfFooter(doc, (doc.internal as any).getCurrentPageInfo().pageNumber);
    return 20;
  }
  return y;
};

// ── PDF exports ───────────────────────────────────────────────────────────────

export const exportBlankPdf = async (questions: Question[]) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadHebrewFont(doc);
  doc.setR2L(true);
  let y = addPdfHeader(doc, 'בחינה');
  addPdfFooter(doc, 1);

  questions.forEach((q, i) => {
    doc.setFontSize(11);
    setFont(doc, 'normal');
    const lines = doc.splitTextToSize(q.question, PDF_CONTENT_WIDTH - 12);
    const questionH = Math.max(10, 4 + lines.length * 6);
    const answerH = q.options
      ? Object.keys(q.options).length * 7 + 4
      : q.answer === 'כן' || q.answer === 'לא'
      ? 12
      : 31;
    y = checkNewPage(doc, y, questionH + answerH + 8);

    doc.setFillColor(239, 246, 255);
    doc.roundedRect(PDF_MARGIN, y, PDF_CONTENT_WIDTH, questionH, 2, 2, 'F');
    setFont(doc, 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(`${i + 1}`, PDF_MARGIN + 4, y + 7);
    doc.setTextColor(30, 41, 59);
    setFont(doc, 'normal');
    doc.text(lines, PDF_WIDTH - PDF_MARGIN - 4, y + 7, { align: 'right' });
    y += questionH + 4;

    if (q.options) {
      Object.entries(q.options).forEach(([key, val]) => {
        y = checkNewPage(doc, y, 8);
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text(`.${key}  ${val}`, PDF_WIDTH - PDF_MARGIN - 4, y + 5, { align: 'right' });
        y += 7;
      });
      y += 4;
    } else if (q.answer === 'כן' || q.answer === 'לא') {
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.rect(PDF_WIDTH - PDF_MARGIN - 24, y, 8, 6);
      doc.text('כן', PDF_WIDTH - PDF_MARGIN - 14, y + 5, { align: 'right' });
      doc.rect(PDF_WIDTH - PDF_MARGIN - 40, y, 8, 6);
      doc.text('לא', PDF_WIDTH - PDF_MARGIN - 30, y + 5, { align: 'right' });
      y += 12;
    } else {
      for (let l = 0; l < 3; l++) {
        y = checkNewPage(doc, y, 8);
        doc.setDrawColor(203, 213, 225);
        doc.line(PDF_MARGIN, y + 6, PDF_WIDTH - PDF_MARGIN, y + 6);
        y += 9;
      }
      y += 4;
    }
  });

  doc.save(buildFilename('blank', undefined, 'pdf'));
};

export const exportGradedPdf = async (questions: Question[], gradeResult: GradeResult) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadHebrewFont(doc);
  doc.setR2L(true);
  const pct = Math.round((gradeResult.score / questions.length) * 100);
  let y = addPdfHeader(doc, `דוח ציון  ${gradeResult.score}/${questions.length} )${pct}%(`);
  addPdfFooter(doc, 1);

  const scoreColor: [number, number, number] =
    pct >= 80 ? [220, 252, 231] : pct >= 60 ? [254, 249, 195] : [254, 226, 226];
  doc.setFillColor(...scoreColor);
  doc.roundedRect(PDF_MARGIN, y, PDF_CONTENT_WIDTH, 14, 3, 3, 'F');
  doc.setFontSize(12);
  setFont(doc, 'bold');
  doc.setTextColor(pct >= 80 ? 22 : pct >= 60 ? 133 : 185, pct >= 80 ? 101 : pct >= 60 ? 77 : 28, pct >= 80 ? 52 : pct >= 60 ? 14 : 26);
  doc.text(`ציון סופי ${gradeResult.score} / ${questions.length} )${pct}%(`, PDF_WIDTH - PDF_MARGIN - 4, y + 9, { align: 'right' });
  y += 22;

  gradeResult.feedback.forEach((fb, i) => {
    const q = questions[i];
    const isCorrect = fb.points === 1;
    const isPartial = fb.points === 0.5;
    const bgColor: [number, number, number] = isCorrect ? [220, 252, 231] : isPartial ? [254, 249, 195] : [254, 226, 226];
    const borderColor: [number, number, number] = isCorrect ? [134, 239, 172] : isPartial ? [253, 224, 71] : [252, 165, 165];

    doc.setFontSize(10);
    setFont(doc, 'normal');
    const qLines = doc.splitTextToSize(q.question, PDF_CONTENT_WIDTH - 24);
    const questionH = 8 + (qLines.length - 1) * 5;
    y = checkNewPage(doc, y, questionH + 20);

    doc.setFillColor(...bgColor);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(PDF_MARGIN, y, PDF_CONTENT_WIDTH, questionH, 2, 2, 'FD');
    setFont(doc, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`${i + 1}`, PDF_MARGIN + 4, y + 5.5);
    doc.text(`${fb.points}/1`, PDF_WIDTH - PDF_MARGIN - 4, y + 5.5, { align: 'right' });
    setFont(doc, 'normal');
    doc.text(qLines, PDF_WIDTH - PDF_MARGIN - 16, y + 5.5, { align: 'right' });
    y += questionH + 2;

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const answerLabel = 'תשובה נכונה: ';
    const answerText = answerLabel + q.answer;
    const answerLines = doc.splitTextToSize(answerText, PDF_CONTENT_WIDTH);
    y = checkNewPage(doc, y, answerLines.length * 5 + 4);
    doc.text(answerLines, PDF_WIDTH - PDF_MARGIN - 4, y + 4, { align: 'right' });
    y += answerLines.length * 5 + 4;

    if (fb.explanation) {
      const expLines = doc.splitTextToSize(fb.explanation, PDF_CONTENT_WIDTH);
      doc.setTextColor(100, 116, 139);
      doc.text(expLines, PDF_WIDTH - PDF_MARGIN - 4, y + 4, { align: 'right' });
      y += expLines.length * 5 + 4;
    }
    y += 4;
  });

  doc.save(buildFilename('graded', gradeResult.score, 'pdf'));
};

// ── DOCX ──────────────────────────────────────────────────────────────────────

const hebrewRun = (text: string, opts: Record<string, unknown> = {}) =>
  new TextRun({ text: sanitize(text), font: 'Arial', rightToLeft: true, ...opts } as ConstructorParameters<typeof TextRun>[0]);

const hrLine = () =>
  new Paragraph({
    border: { bottom: { color: 'CBD5E1', style: BorderStyle.SINGLE, size: 1 } },
    spacing: { after: 120 },
  });

export const exportBlankDocx = async (questions: Question[]) => {
  const children: Paragraph[] = [
    new Paragraph({
      children: [hebrewRun('בחינה', { bold: true, size: 36, color: 'FFFFFF' })],
      alignment: AlignmentType.RIGHT,
      shading: { type: ShadingType.SOLID, color: '2563EB', fill: '2563EB' },
      spacing: { after: 320 },
    }),
  ];

  questions.forEach((q, i) => {
    children.push(new Paragraph({
      children: [
        hebrewRun(`${i + 1}. `, { bold: true, color: '2563EB', size: 24 }),
        hebrewRun(q.question, { bold: true, size: 24 }),
      ],
      alignment: AlignmentType.RIGHT,
      shading: { type: ShadingType.SOLID, color: 'EFF6FF', fill: 'EFF6FF' },
      spacing: { before: 160, after: 80 },
    }));

    if (q.options) {
      Object.entries(q.options).forEach(([key, val]) =>
        children.push(new Paragraph({
          children: [hebrewRun(`${val}  .${key}`, { size: 22, color: '475569' })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 60 },
        }))
      );
    } else if (q.answer === 'כן' || q.answer === 'לא') {
      children.push(new Paragraph({
        children: [hebrewRun('☐ כן    ☐ לא', { size: 22, color: '475569' })],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 80 },
      }));
    } else {
      for (let l = 0; l < 3; l++) {
        children.push(new Paragraph({
          children: [hebrewRun('_'.repeat(80), { color: 'CBD5E1', size: 18 })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 60 },
        }));
      }
    }
    children.push(hrLine());
  });

  const doc = new Document({
    sections: [{ children }],
    styles: { default: { document: { run: { font: 'Arial', rightToLeft: true } } } },
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, buildFilename('blank', undefined, 'docx'));
};

export const exportGradedDocx = async (questions: Question[], gradeResult: GradeResult) => {
  const pct = Math.round((gradeResult.score / questions.length) * 100);
  const scoreColor = pct >= 80 ? 'D1FAE5' : pct >= 60 ? 'FEF9C3' : 'FEE2E2';
  const scoreTextColor = pct >= 80 ? '166534' : pct >= 60 ? '854D0E' : 'B91C1C';

  const children: Paragraph[] = [
    new Paragraph({
      children: [hebrewRun('דוח ציון', { bold: true, size: 36, color: 'FFFFFF' })],
      alignment: AlignmentType.RIGHT,
      shading: { type: ShadingType.SOLID, color: '2563EB', fill: '2563EB' },
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [hebrewRun(new Date().toLocaleDateString('he-IL'), { size: 22, color: 'FFFFFF' })],
      alignment: AlignmentType.RIGHT,
      shading: { type: ShadingType.SOLID, color: '2563EB', fill: '2563EB' },
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [hebrewRun(`ציון סופי: ${gradeResult.score} / ${questions.length} (${pct}%)`, { bold: true, size: 28, color: scoreTextColor })],
      alignment: AlignmentType.RIGHT,
      shading: { type: ShadingType.SOLID, color: scoreColor, fill: scoreColor },
      spacing: { before: 120, after: 320 },
    }),
  ];

  gradeResult.feedback.forEach((fb, i) => {
    const q = questions[i];
    const isCorrect = fb.points === 1;
    const isPartial = fb.points === 0.5;
    const bg = isCorrect ? 'D1FAE5' : isPartial ? 'FEF9C3' : 'FEE2E2';
    const textColor = isCorrect ? '166534' : isPartial ? '854D0E' : 'B91C1C';
    const icon = isCorrect ? '✓' : isPartial ? '~' : '✗';

    children.push(
      new Paragraph({
        children: [hebrewRun(`${icon} שאלה ${i + 1} — ${fb.points}/1`, { bold: true, size: 24, color: textColor })],
        alignment: AlignmentType.RIGHT,
        shading: { type: ShadingType.SOLID, color: bg, fill: bg },
        spacing: { before: 160, after: 80 },
      }),
      new Paragraph({
        children: [hebrewRun(q.question, { size: 22, bold: true })],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [
          hebrewRun('תשובה נכונה: ', { bold: true, size: 20, color: '166534' }),
          hebrewRun(q.answer, { size: 20, color: '166534' }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 60 },
      }),
    );

    if (fb.explanation) {
      children.push(new Paragraph({
        children: [hebrewRun(fb.explanation, { size: 20, color: '64748B', italics: true })],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 60 },
      }));
    }

    if (fb.covered_points?.length > 0) {
      children.push(new Paragraph({
        children: [hebrewRun('נקודות שכוסו:', { bold: true, size: 20, color: '166534' })],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
      }));
      fb.covered_points.forEach(p => children.push(new Paragraph({
        children: [hebrewRun(`✓ ${p}`, { size: 20, color: '166534' })],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
      })));
    }

    if (fb.missed_points?.length > 0) {
      children.push(new Paragraph({
        children: [hebrewRun('נקודות חסרות:', { bold: true, size: 20, color: 'B91C1C' })],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
      }));
      fb.missed_points.forEach(p => children.push(new Paragraph({
        children: [hebrewRun(`✗ ${p}`, { size: 20, color: 'B91C1C' })],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
      })));
    }

    children.push(hrLine());
  });

  const doc = new Document({
    sections: [{ children }],
    styles: { default: { document: { run: { font: 'Arial', rightToLeft: true } } } },
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, buildFilename('graded', gradeResult.score, 'docx'));
};