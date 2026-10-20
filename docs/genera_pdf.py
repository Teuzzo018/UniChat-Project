"""Impagina la guida Markdown di UniChat in un PDF vettoriale A4.

Uso: python3 docs/genera_pdf.py
Richiede matplotlib e Pillow presenti nell'ambiente di generazione.
"""

from pathlib import Path
import re

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.font_manager import FontProperties
from PIL import ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "DOCUMENTAZIONE_CODICE_UNICHAT.md"
TARGET = ROOT.parent / "DOCUMENTAZIONE_CODICE_UNICHAT.pdf"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_PROP = FontProperties(fname=FONT)
BOLD_PROP = FontProperties(fname=FONT_BOLD)

PAGE_W, PAGE_H = 595.28, 841.89  # punti PDF, A4
LEFT, RIGHT, TOP, BOTTOM = 56, 56, 71, 61
TEXT_W = PAGE_W - LEFT - RIGHT
INK = "#1c2532"
MUTED = "#5a6675"
ACCENT = "#c15a20"
LINE = "#d8dfe6"


def plain(value):
    return re.sub(r"(?<!\*)\*\*|`", "", value).replace("**", "").strip()


def blocks_from_markdown(raw):
    chunks = re.split(r"\n\s*\n", raw.strip())
    result = []
    for chunk in chunks:
        lines = [line.strip() for line in chunk.splitlines() if line.strip()]
        for line in lines:
            if line.startswith("# "):
                result.append(("title", plain(line[2:])))
            elif line.startswith("## "):
                result.append(("heading", plain(line[3:])))
            elif re.match(r"^\d+\. ", line):
                result.append(("list", plain(line)))
            else:
                result.append(("para", plain(line)))
    return result


def wrap(text, size, max_width):
    font_path = FONT_BOLD if size >= 14 else FONT
    font = ImageFont.truetype(font_path, max(1, round(size * 150 / 72)))
    max_px = max_width * 150 / 72
    words = text.split()
    rows = []
    row = ""
    for word in words:
        candidate = word if not row else row + " " + word
        if font.getlength(candidate) <= max_px:
            row = candidate
        else:
            if row:
                rows.append(row)
            row = word
    if row:
        rows.append(row)
    return rows


def new_page():
    return []


def layout(blocks):
    pages = [new_page()]
    headings = []
    y = TOP

    for kind, value in blocks:
        if kind == "title":
            continue
        if kind == "heading":
            if pages[-1]:
                pages.append(new_page())
            y = TOP
            headings.append((value, len(pages) + 2))  # copertina + indice
            for row in wrap(value, 17.5, TEXT_W):
                pages[-1].append(("heading", row, LEFT, y))
                y += 24
            y += 26
            continue

        size = 9.8 if kind == "para" else 9.7
        line_h = 15.1
        x = LEFT if kind == "para" else LEFT + 14
        width = TEXT_W if kind == "para" else TEXT_W - 14
        rows = wrap(value, size, width)
        if not rows:
            continue
        for row in rows:
            if y + line_h > PAGE_H - BOTTOM:
                pages.append(new_page())
                y = TOP
            pages[-1].append((kind, row, x, y))
            y += line_h
        y += 11 if kind == "para" else 6
        if y > PAGE_H - BOTTOM:
            pages.append(new_page())
            y = TOP

    while pages and not pages[-1]:
        pages.pop()
    return pages, headings


def base_page(fig, number, total, subtitle):
    fig.patch.set_facecolor("white")
    fig.text(LEFT / PAGE_W, 1 - 33 / PAGE_H, "UNICHAT  /  GUIDA AL CODICE",
             color=ACCENT, fontsize=8, fontproperties=BOLD_PROP, va="top")
    fig.text((PAGE_W - RIGHT) / PAGE_W, 1 - 33 / PAGE_H, subtitle,
             color=MUTED, fontsize=7.6, fontproperties=FONT_PROP, va="top", ha="right")
    fig.lines.append(plt.Line2D([LEFT / PAGE_W, 1 - RIGHT / PAGE_W],
                                [1 - 49 / PAGE_H, 1 - 49 / PAGE_H],
                                transform=fig.transFigure, color=LINE, linewidth=.7))
    fig.lines.append(plt.Line2D([LEFT / PAGE_W, 1 - RIGHT / PAGE_W],
                                [47 / PAGE_H, 47 / PAGE_H],
                                transform=fig.transFigure, color=LINE, linewidth=.7))
    fig.text(LEFT / PAGE_W, 29 / PAGE_H, "Edizione 20 ottobre 2026",
             color=MUTED, fontsize=7.4, fontproperties=FONT_PROP, va="bottom")
    fig.text(1 - RIGHT / PAGE_W, 29 / PAGE_H, f"{number} / {total}",
             color=MUTED, fontsize=7.4, fontproperties=FONT_PROP, va="bottom", ha="right")


def write_pdf(blocks):
    content, headings = layout(blocks)
    total = len(content) + 2
    plt.rcParams["pdf.fonttype"] = 42  # incorpora TrueType, testo selezionabile
    plt.rcParams["font.family"] = "DejaVu Sans"

    with PdfPages(TARGET, metadata={
        "Title": "UniChat - Guida completa al codice",
        "Author": "Documentazione tecnica UniChat",
        "Subject": "Architettura, funzioni, API, database, realtime e manutenzione",
        "Keywords": "UniChat, Express, Prisma, Socket.IO, WebRTC, LiveKit",
    }) as pdf:
        fig = plt.figure(figsize=(PAGE_W / 72, PAGE_H / 72))
        fig.patch.set_facecolor("#101820")
        fig.text(.095, .80, "UNICHAT", color="#e57636", fontsize=17,
                 fontproperties=BOLD_PROP, va="top")
        fig.text(.095, .69, "Guida completa\nal codice", color="white",
                 fontsize=31, fontproperties=BOLD_PROP, va="top", linespacing=1.25)
        fig.text(.095, .45, "Architettura · funzionalità · API · database\n"
                 "interfaccia · realtime · sicurezza · manutenzione",
                 color="#d4dbe3", fontsize=12, fontproperties=FONT_PROP,
                 va="top", linespacing=1.8)
        fig.text(.095, .16, f"Edizione tecnica  /  20 ottobre 2026\n{total} pagine",
                 color="#aab7c4", fontsize=10, fontproperties=FONT_PROP,
                 va="top", linespacing=1.7)
        pdf.savefig(fig)
        plt.close(fig)

        fig = plt.figure(figsize=(PAGE_W / 72, PAGE_H / 72))
        base_page(fig, 2, total, "Indice")
        fig.text(LEFT / PAGE_W, 1 - 80 / PAGE_H, "Indice dei capitoli",
                 fontsize=20, color=INK, fontproperties=BOLD_PROP, va="top")
        y = 127
        for title, page in headings:
            title_rows = wrap(title, 9.4, TEXT_W - 37)
            for i, row in enumerate(title_rows):
                fig.text(LEFT / PAGE_W, 1 - y / PAGE_H, row,
                         fontsize=9.4, color=INK, fontproperties=FONT_PROP, va="top")
                if i == 0:
                    fig.text((PAGE_W - RIGHT) / PAGE_W, 1 - y / PAGE_H, str(page),
                             fontsize=9.4, color=ACCENT, fontproperties=BOLD_PROP,
                             va="top", ha="right")
                y += 18
            y += 5
        if y > PAGE_H - 58:
            raise RuntimeError("L'indice richiede più di una pagina")
        pdf.savefig(fig)
        plt.close(fig)

        current_heading = "Introduzione"
        for index, commands in enumerate(content, start=3):
            fig = plt.figure(figsize=(PAGE_W / 72, PAGE_H / 72))
            current_heading = next((v for k, v, *_ in commands if k == "heading"), current_heading)
            base_page(fig, index, total, current_heading[:51])
            last_heading_y = max((y for k, _, _, y in commands if k == "heading"), default=None)
            for kind, value, x, y in commands:
                if kind == "heading":
                    fig.text(x / PAGE_W, 1 - y / PAGE_H, value, fontsize=17.5,
                             color=INK, fontproperties=BOLD_PROP, va="top")
                    if y == last_heading_y:
                        fig.lines.append(plt.Line2D([x / PAGE_W, (PAGE_W - RIGHT) / PAGE_W],
                                                    [1 - (y + 34) / PAGE_H] * 2,
                                                    transform=fig.transFigure,
                                                    color=ACCENT, linewidth=1.3))
                else:
                    fig.text(x / PAGE_W, 1 - y / PAGE_H, value, fontsize=9.8,
                             color=INK, fontproperties=FONT_PROP, va="top")
            pdf.savefig(fig)
            plt.close(fig)
    return total


if __name__ == "__main__":
    raw = SOURCE.read_text(encoding="utf-8")
    page_count = write_pdf(blocks_from_markdown(raw))
    print(f"Creato {TARGET} ({page_count} pagine, {TARGET.stat().st_size} byte)")
