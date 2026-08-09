/**
 * Export PDF de l'emploi du temps — habillage aux couleurs du logo
 * (vert & orange, drapeau ivoirien). A4 portrait, en-tête institutionnel
 * personnalisé (logo & emblème, filet bicolore), cartouche classe vert,
 * grille jours × horaires : matières en vert gras, enseignants en orange gras,
 * bandes Récréation / Après-midi en orange, filigrane logo, pied de page daté.
 * jsPDF + jspdf-autotable, images embarquées en base64.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/images/logo.png';
import emblemeUrl from '../assets/images/embleme.jpg';

// Palette issue du logo (vert & orange du drapeau ivoirien).
const GREEN: [number, number, number] = [30, 158, 75];        // #1E9E4B — anneau / « S »
const GREEN_DARK: [number, number, number] = [14, 110, 52];   // #0E6E34
const ORANGE: [number, number, number] = [238, 125, 34];      // #EE7D22 — bannière
const ORANGE_DARK: [number, number, number] = [193, 92, 18];  // #C15C12
const GREEN_TINT: [number, number, number] = [228, 245, 235]; // fond colonne horaires
const ZEBRA: [number, number, number] = [242, 250, 245];      // zébrage lignes de cours
const BAND_FILL: [number, number, number] = [253, 238, 224];  // fond bande (orange très clair)
const INK_DARK: [number, number, number] = [31, 41, 33];      // texte neutre foncé
const SLATE: [number, number, number] = [90, 100, 92];
const LINE: [number, number, number] = [140, 165, 148];       // filets (vert-gris, plus contrasté pour rester visible à l'impression)

const MINISTERE = "MINISTÈRE DE L'ÉDUCATION NATIONALE\nET DE L'ALPHABÉTISATION\n---------------";
const REPUBLIQUE = "RÉPUBLIQUE DE CÔTE D'IVOIRE\nUnion - Discipline - Travail\n---------------";
const ECOLE = 'ÉCOLE LE SOUVERAIN DE LARABIA';

interface Img { dataUrl: string; ratio: number; fmt: 'PNG' | 'JPEG'; }

async function loadImg(url: string, fmt: 'PNG' | 'JPEG'): Promise<Img | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((r) => {
      const f = new FileReader();
      f.onloadend = () => r(f.result as string);
      f.readAsDataURL(blob);
    });
    const ratio: number = await new Promise((r) => {
      const i = new Image();
      i.onload = () => r(i.width / i.height || 1);
      i.onerror = () => r(1);
      i.src = dataUrl;
    });
    return { dataUrl, ratio, fmt };
  } catch {
    return null;
  }
}

export interface TimetableEntry {
  day_of_week: string;
  start_time: string;
  end_time: string;
  subject?: { name?: string; code?: string } | null;
  teacher?: { first_name?: string; last_name?: string } | null;
  classroom?: { name?: string } | null;
}
export interface TimetableSlot {
  start: string; end: string; label: string;
  isBreak?: boolean; isSeparator?: boolean; bandLabel?: string;
}
export interface TimetableDay { value: string; label: string; }

export interface TimetablePdfParams {
  className: string;
  yearName: string;
  mainTeacherName?: string;
  days: TimetableDay[];
  slots: TimetableSlot[];
  entries: TimetableEntry[];
}

const isEPS = (e?: TimetableEntry | null) =>
  !!(e?.subject?.code === 'EPS' || e?.subject?.name?.toUpperCase().includes('EPS'));

export async function downloadTimetablePdf(params: TimetablePdfParams): Promise<void> {
  const { className, yearName, mainTeacherName, days, slots, entries } = params;
  const [logo, embleme] = await Promise.all([loadImg(logoUrl, 'PNG'), loadImg(emblemeUrl, 'JPEG')]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const PAGE_W = 210;
  const PAGE_H = 297;
  const M = 10;
  const RIGHT = PAGE_W - M;
  const CENTER = PAGE_W / 2;

  // ---------- En-tête institutionnel ----------
  // Ministère : bloc calé sur la marge GAUCHE (bord = M) ; République : bloc calé
  // sur la marge DROITE (bord = RIGHT) — mêmes marges que le tableau. Lignes en
  // gras (devise ivoirienne en italique), centrées à l'intérieur de leur bloc.
  const headTop = 10;
  const headLH = 3.5;
  const minFont = (i: number) => (i < 2 ? 'bold' : 'normal');
  const repFont = (i: number) => (i === 0 ? 'bold' : i === 1 ? 'italic' : 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  const minLines = MINISTERE.split('\n');
  let minW = 0;
  minLines.forEach((ln, i) => { doc.setFont('helvetica', minFont(i)); minW = Math.max(minW, doc.getTextWidth(ln)); });
  const minCenter = M + minW / 2;
  minLines.forEach((ln, i) => { doc.setFont('helvetica', minFont(i)); doc.text(ln, minCenter, headTop + i * headLH, { align: 'center' }); });

  const repLines = REPUBLIQUE.split('\n');
  let repW = 0;
  repLines.forEach((ln, i) => { doc.setFont('helvetica', repFont(i)); repW = Math.max(repW, doc.getTextWidth(ln)); });
  const repCenter = RIGHT - repW / 2;
  repLines.forEach((ln, i) => { doc.setFont('helvetica', repFont(i)); doc.text(ln, repCenter, headTop + i * headLH, { align: 'center' }); });

  // Logos centrés sous leur bloc de texte (alignés avec les tirets).
  if (logo) { const h = 15; const w = h * logo.ratio; doc.addImage(logo.dataUrl, logo.fmt, minCenter - w / 2, 19, w, h); }
  if (embleme) { const h = 14; const w = h * embleme.ratio; doc.addImage(embleme.dataUrl, embleme.fmt, repCenter - w / 2, 19.5, w, h); }

  // École (vert foncé, gras).
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(GREEN_DARK[0], GREEN_DARK[1], GREEN_DARK[2]);
  doc.text(ECOLE, CENTER, 38, { align: 'center' });

  // Cartouche unique « EMPLOI DU TEMPS   CLASSE : XXX » (comme le modèle) :
  // fond blanc, bordure verte, titre en vert + classe en orange, gras.
  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  const part1 = 'EMPLOI DU TEMPS';
  const sep = '    ';
  const part2 = `CLASSE : ${(className || '—').toUpperCase()}`;
  const w1 = doc.getTextWidth(part1);
  const wSep = doc.getTextWidth(sep);
  const w2 = doc.getTextWidth(part2);
  const total = w1 + wSep + w2;
  const boxW = total + 16;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.setLineWidth(0.7);
  doc.roundedRect(CENTER - boxW / 2, 40.5, boxW, 9, 2, 2, 'FD');
  let tx = CENTER - total / 2;
  const ty = 46.4;
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.text(part1, tx, ty);
  tx += w1 + wSep;
  doc.setTextColor(ORANGE_DARK[0], ORANGE_DARK[1], ORANGE_DARK[2]);
  doc.text(part2, tx, ty);
  doc.setTextColor(0, 0, 0);

  // Ligne prof. principal (gauche) + année (droite), libellés en gras.
  const infoY = 54;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(GREEN_DARK[0], GREEN_DARK[1], GREEN_DARK[2]);
  doc.text('Professeur principal : ', M, infoY);
  const ppLabelW = doc.getTextWidth('Professeur principal : ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(INK_DARK[0], INK_DARK[1], INK_DARK[2]);
  doc.text(mainTeacherName || '—', M + ppLabelW, infoY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(GREEN_DARK[0], GREEN_DARK[1], GREEN_DARK[2]);
  const yrValue = yearName || '—';
  doc.text(yrValue, RIGHT, infoY, { align: 'right' });
  const yrValueW = doc.getTextWidth(yrValue);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text('Année scolaire : ', RIGHT - yrValueW, infoY, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Filet bicolore (vert + orange) façon drapeau, pleine largeur.
  const barY = 57;
  const half = (PAGE_W - 2 * M) / 2;
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.rect(M, barY, half, 1.1, 'F');
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.rect(M + half, barY, half, 1.1, 'F');

  // ---------- Corps du tableau ----------
  const head = [['HORAIRES', ...days.map((d) => d.label.toUpperCase())]];
  const meta: { isBand: boolean; start: string; end: string }[] = [];
  const body: any[] = slots.map((slot) => {
    if (slot.isBreak || slot.isSeparator) {
      meta.push({ isBand: true, start: slot.start, end: slot.end });
      const bandStyle = { fontStyle: 'bold', halign: 'center', valign: 'middle', textColor: ORANGE_DARK, fillColor: BAND_FILL, minCellHeight: 8 } as any;
      return [
        { content: slot.label, styles: bandStyle },
        { content: slot.bandLabel || (slot.isBreak ? 'RÉCRÉATION' : 'APRÈS-MIDI'), colSpan: days.length, styles: bandStyle },
      ];
    }
    meta.push({ isBand: false, start: slot.start, end: slot.end });
    const dayCells = days.map((d) => {
      const e = entries.find((x) => x.day_of_week === d.value && x.start_time === slot.start && x.end_time === slot.end);
      // La matière (en majuscules) sert de contenu ; enseignant & salle sont
      // dessinés dessous en didDrawCell.
      const subj = e ? (e.subject?.name || e.subject?.code || '') : '';
      return { content: subj ? subj.toUpperCase() : '' };
    });
    return [{ content: slot.label }, ...dayCells];
  });

  const timeW = 26;
  const dayW = (PAGE_W - 2 * M - timeW) / days.length;
  const columnStyles: Record<number, any> = { 0: { cellWidth: timeW, valign: 'middle' } };
  days.forEach((_, i) => { columnStyles[i + 1] = { cellWidth: dayW }; });

  autoTable(doc, {
    startY: 60,
    margin: { left: M, right: M },
    theme: 'grid',
    head,
    body,
    styles: {
      font: 'helvetica', fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
      lineColor: LINE, lineWidth: 0.35, textColor: INK_DARK, valign: 'top', halign: 'center', minCellHeight: 16,
      fontStyle: 'bold',
    },
    headStyles: {
      fillColor: GREEN, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', valign: 'middle',
      fontSize: 8.5, minCellHeight: 8.5, cellPadding: 2, lineColor: GREEN_DARK, lineWidth: 0.35,
    },
    tableLineColor: GREEN_DARK,
    tableLineWidth: 0.4,
    columnStyles,
    didParseCell: (data: any) => {
      if (data.section !== 'body') return;
      const m = meta[data.row.index];
      if (!m || m.isBand) return;
      if (data.column.index === 0) {
        // Colonne horaires : vert foncé sur fond vert clair.
        data.cell.styles.textColor = GREEN_DARK;
        data.cell.styles.fillColor = GREEN_TINT;
        data.cell.styles.valign = 'middle';
      } else {
        // Cellule cours : matière en vert gras + zébrage discret.
        data.cell.styles.textColor = GREEN;
        if (data.row.index % 2 === 1) data.cell.styles.fillColor = ZEBRA;
      }
    },
    didDrawCell: (data: any) => {
      try {
        if (data.section !== 'body' || data.column.index === 0) return;
        const m = meta[data.row.index];
        if (!m || m.isBand) return;
        const day = days[data.column.index - 1];
        const e = entries.find((x) => x.day_of_week === day.value && x.start_time === m.start && x.end_time === m.end);
        if (!e) return;
        const cx = data.cell.x + data.cell.width / 2;
        let y = data.cell.y + 8.5;
        const room = !isEPS(e) ? (e.classroom?.name || '') : '';
        const teacher = e.teacher ? `${e.teacher.first_name ?? ''} ${e.teacher.last_name ?? ''}`.trim() : '';
        if (room) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(GREEN_DARK[0], GREEN_DARK[1], GREEN_DARK[2]);
          doc.text(room, cx, y, { align: 'center' });
          y += 3.4;
        }
        if (teacher) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
          doc.text(teacher, cx, y, { align: 'center' });
        }
        doc.setTextColor(0, 0, 0);
      } catch {
        /* dessin custom best-effort */
      }
    },
  });

  // ---------- Filigrane (logo centré, léger) ----------
  if (logo) {
    try {
      doc.saveGraphicsState();
      (doc as any).setGState(new (doc as any).GState({ opacity: 0.05 }));
      const w = 110;
      const h = w / logo.ratio;
      doc.addImage(logo.dataUrl, logo.fmt, (PAGE_W - w) / 2, (PAGE_H - h) / 2, w, h);
      doc.restoreGraphicsState();
    } catch {
      /* GState indisponible : filigrane ignoré */
    }
  }

  // ---------- Pied de page (filet bicolore + mentions) ----------
  const footY = PAGE_H - 9;
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.rect(M, footY, half, 0.9, 'F');
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.rect(M + half, footY, half, 0.9, 'F');
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(`${ECOLE} — généré le ${today}`, M, footY + 4);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ORANGE_DARK[0], ORANGE_DARK[1], ORANGE_DARK[2]);
  doc.text('HorizonÉcole', RIGHT, footY + 4, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  const safe = (className || 'classe').replace(/[^\w-]+/g, '_');
  doc.save(`Emploi_du_temps_${safe}.pdf`);
}
