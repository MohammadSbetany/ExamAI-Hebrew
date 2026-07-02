import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { Question, GradeResult } from '@/types/questions';
import i18n from '@/lib/i18n';

const sanitize = (text: string) => (text || '').replace(/\r/g, '');

const buildFilename = (type: 'blank' | 'graded', score?: number) => {
  if (type === 'graded' && score !== undefined) return `Exam_Graded_${score}.docx`;
  return `Exam_Blank.docx`;
};

// ── DOCX ──────────────────────────────────────────────────────────────────────

const hebrewRun = (text: string, opts: Record<string, unknown> = {}) =>
  new TextRun({ text: sanitize(text), font: 'Arial', rightToLeft: true, ...opts } as ConstructorParameters<typeof TextRun>[0]);

// Every Hebrew paragraph is RTL + bidirectional to prevent letters/punctuation flipping
const hebrewPara = (children: TextRun[], opts: Record<string, unknown> = {}) =>
  new Paragraph({
    children,
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    ...opts,
  } as ConstructorParameters<typeof Paragraph>[0]);

const hrLine = () =>
  new Paragraph({
    border: { bottom: { color: 'CBD5E1', style: BorderStyle.SINGLE, size: 1 } },
    spacing: { after: 120 },
  });

export const exportBlankDocx = async (questions: Question[]) => {
  const children: Paragraph[] = [
    hebrewPara([hebrewRun(i18n.t('export.exam'), { bold: true, size: 36, color: 'FFFFFF' })], {
      shading: { type: ShadingType.SOLID, color: '2563EB', fill: '2563EB' },
      spacing: { after: 320 },
    }),
  ];

  questions.forEach((q, i) => {
    children.push(hebrewPara(
      [
        hebrewRun(`${i + 1}. `, { bold: true, color: '2563EB', size: 24 }),
        hebrewRun(q.question, { bold: true, size: 24 }),
      ],
      {
        shading: { type: ShadingType.SOLID, color: 'EFF6FF', fill: 'EFF6FF' },
        spacing: { before: 160, after: 80 },
      }
    ));

    if (q.options) {
      Object.entries(q.options).forEach(([key, val]) =>
        children.push(hebrewPara(
          [hebrewRun(`${val}  .${key}`, { size: 22, color: '475569' })],
          { spacing: { after: 60 } }
        ))
      );
    } else if (q.answer === 'כן' || q.answer === 'לא') {
      children.push(hebrewPara(
        [hebrewRun('☐ כן    ☐ לא', { size: 22, color: '475569' })],
        { spacing: { after: 80 } }
      ));
    } else {
      for (let l = 0; l < 3; l++) {
        children.push(hebrewPara(
          [hebrewRun('_'.repeat(80), { color: 'CBD5E1', size: 18 })],
          { spacing: { after: 60 } }
        ));
      }
    }
    children.push(hrLine());
  });

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: 'Arial', rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      },
    },
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, buildFilename('blank'));
};

export const exportGradedDocx = async (questions: Question[], gradeResult: GradeResult) => {
  if (questions.length === 0) return;
  const pct = Math.round((gradeResult.score / questions.length) * 100);
  const scoreColor = pct >= 80 ? 'D1FAE5' : pct >= 60 ? 'FEF9C3' : 'FEE2E2';
  const scoreTextColor = pct >= 80 ? '166534' : pct >= 60 ? '854D0E' : 'B91C1C';

  const children: Paragraph[] = [
    hebrewPara([hebrewRun(i18n.t('export.gradeReport'), { bold: true, size: 36, color: 'FFFFFF' })], {
      shading: { type: ShadingType.SOLID, color: '2563EB', fill: '2563EB' },
      spacing: { after: 80 },
    }),
    hebrewPara([hebrewRun(new Date().toLocaleDateString('he-IL'), { size: 22, color: 'FFFFFF' })], {
      shading: { type: ShadingType.SOLID, color: '2563EB', fill: '2563EB' },
      spacing: { after: 200 },
    }),
    hebrewPara([hebrewRun(i18n.t('export.finalScore', { score: gradeResult.score, total: questions.length, pct }), { bold: true, size: 28, color: scoreTextColor })], {
      shading: { type: ShadingType.SOLID, color: scoreColor, fill: scoreColor },
      spacing: { before: 120, after: 320 },
    }),
  ];

  const docxFeedbackCount = Math.min(questions.length, gradeResult.feedback.length);
  gradeResult.feedback.slice(0, docxFeedbackCount).forEach((fb, i) => {
    const q = questions[i];
    const isCorrect = fb.points === 1;
    const isPartial = fb.points === 0.5;
    const bg = isCorrect ? 'D1FAE5' : isPartial ? 'FEF9C3' : 'FEE2E2';
    const textColor = isCorrect ? '166534' : isPartial ? '854D0E' : 'B91C1C';
    const icon = isCorrect ? '✓' : isPartial ? '~' : '✗';

    children.push(
      hebrewPara([hebrewRun(`${icon} ${i18n.t('export.question')} ${i + 1} — ${fb.points}/1`, { bold: true, size: 24, color: textColor })], {
        shading: { type: ShadingType.SOLID, color: bg, fill: bg },
        spacing: { before: 160, after: 80 },
      }),
      hebrewPara([hebrewRun(q.question, { size: 22, bold: true })], {
        spacing: { after: 80 },
      }),
      hebrewPara(
        [
          hebrewRun(i18n.t('export.correctAnswer'), { bold: true, size: 20, color: '166534' }),
          hebrewRun(q.answer, { size: 20, color: '166534' }),
        ],
        { spacing: { after: 60 } }
      ),
    );

    if (fb.explanation) {
      children.push(hebrewPara(
        [hebrewRun(fb.explanation, { size: 20, color: '64748B', italics: true })],
        { spacing: { after: 60 } }
      ));
    }

    if (fb.covered_points?.length > 0) {
      children.push(hebrewPara(
        [hebrewRun(i18n.t('export.coveredPoints'), { bold: true, size: 20, color: '166534' })],
        { spacing: { after: 40 } }
      ));
      fb.covered_points.forEach(p => children.push(hebrewPara(
        [hebrewRun(`✓ ${p}`, { size: 20, color: '166534' })],
        { spacing: { after: 40 } }
      )));
    }

    if (fb.missed_points?.length > 0) {
      children.push(hebrewPara(
        [hebrewRun(i18n.t('export.missedPoints'), { bold: true, size: 20, color: 'B91C1C' })],
        { spacing: { after: 40 } }
      ));
      fb.missed_points.forEach(p => children.push(hebrewPara(
        [hebrewRun(`✗ ${p}`, { size: 20, color: 'B91C1C' })],
        { spacing: { after: 40 } }
      )));
    }

    children.push(hrLine());
  });

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: 'Arial', rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      },
    },
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, buildFilename('graded', gradeResult.score));
};
