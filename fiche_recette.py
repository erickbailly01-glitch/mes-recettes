"""Générateur de fiche recette A4 (gabarit maison « Flan pâtissier café-rhum »).

Usage : python fiche_recette.py recette.json sortie.pdf

Le JSON décrit la recette :
{
  "categorie": "PÂTISSERIE  ·  RECETTE MAISON",
  "titre": "Flan pâtissier café-rhum",
  "sous_titre": "Café renforcé, pâte sucrée aux amandes, une nuit de maturation",
  "type": "Gâteau",                      # obligatoire : un des types de types.json (donne la couleur)
  "portions": {"n": 10, "u": "parts"},   # quand ça a un sens (sert au réglage des quantités du site, pas à la fiche)
  "infos": [["PRÉPARATION", "≈ 45 min"], ...],          # 3 à 5 cases
  "ingredients": [["PÂTE SUCRÉE", [["120 g", "beurre pommade", "beurre"], ...]], ...],
                                         # [quantité, ingrédient, identifiant] : identifiant obligatoire,
                                         # en minuscules sans accent (« beurre », « sucre-glace »), unique
                                         # dans la recette ; il sert aux liens des étapes (pas à la fiche)
  "materiel": "Moule · fouet · ...",
  "planning": [["J-1", "..."], ["J+1", "..."]],          # facultatif
  "note": "Phrase sur un choix clé.",                    # facultatif
  "phases": [["La pâte", [["Préparer la pâte", "10 min", "Texte.", "Astuce ou null",
                            ["beurre", "sucre-glace", ["sucre", "100 g"]]], ...]], ...]
}
5e élément de chaque étape (obligatoire, éventuellement []) : les ingrédients qu'elle utilise.
« "beurre" » = toute la quantité de l'ingrédient ; « ["sucre", "100 g"] » = seulement la part de
cette étape (ingrédient utilisé en plusieurs fois). Le mode cuisine du site les affiche sur l'étape ;
la fiche PDF les ignore.
La numérotation des étapes est continue d'une phase à l'autre.
Charte : vert sapin, sauge, et la couleur du type (bandeau d'infos, pastilles des étapes, filets des phases).
"""
import json
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily, stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Frame, Paragraph, Spacer, Table, TableStyle
from xml.sax.saxutils import escape

D = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("Sans", D + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("Sans-B", D + "DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Sans-I", D + "DejaVuSans-Oblique.ttf"))
pdfmetrics.registerFont(TTFont("Serif-B", D + "DejaVuSerif-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Serif-I", D + "DejaVuSerif-Italic.ttf"))
registerFontFamily("Sans", normal="Sans", bold="Sans-B", italic="Sans-I", boldItalic="Sans-B")

SAPIN_HEX = "#1F4D3A"      # en-tête, titres
VERT_HEX = "#2F6A4E"       # petits titres, durées
TEXTE_HEX = "#1E2A23"
SAPIN = colors.HexColor(SAPIN_HEX)
VERT = colors.HexColor(VERT_HEX)
SAUGE = colors.HexColor("#E3EDE4")    # encadrés
TRAIT = colors.HexColor("#C3D6C8")    # filets
TEXTE = colors.HexColor(TEXTE_HEX)
SOURDINE = colors.HexColor("#5B6B61")

# Couleurs des types de recette (fichier types.json à la racine du dépôt).
with open(Path(__file__).resolve().parent / "types.json", encoding="utf-8") as fh:
    TYPES = {t["nom"]: t["couleur"] for t in json.load(fh)["types"]}


def luminance(hexa):
    rgb = [int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def texte_sur(hexa):
    """Blanc ou texte foncé : celui qui se lit le mieux sur la couleur donnée."""
    fond = luminance(hexa)
    contraste_blanc = 1.05 / (fond + 0.05)
    contraste_fonce = (fond + 0.05) / (luminance(TEXTE_HEX) + 0.05)
    return "#FFFFFF" if contraste_blanc >= contraste_fonce else TEXTE_HEX


# Couleur du type de la recette en cours (fixée par build).
TYPE_HEX = TYPE_TXT_HEX = None
TYPE = TYPE_TXT = None

W, H = A4
M = 13 * mm

h2 = ParagraphStyle("h2", fontName="Serif-B", fontSize=11.5, textColor=SAPIN, spaceBefore=4, spaceAfter=3, leading=14)
sub = ParagraphStyle("sub", fontName="Sans-B", fontSize=7.6, textColor=VERT, leading=10, spaceBefore=4, spaceAfter=1)
ing = ParagraphStyle("ing", fontName="Sans", fontSize=8.8, textColor=TEXTE, leading=11.4)
body = ParagraphStyle("body", fontName="Sans", fontSize=8.7, textColor=TEXTE, leading=11.2)
tip = ParagraphStyle("tip", fontName="Sans", fontSize=7.9, textColor=SOURDINE, leading=10)
small = ParagraphStyle("small", fontName="Sans", fontSize=8.1, textColor=TEXTE, leading=10.5)


def e(s):
    return escape(s or "")


class Flex(Spacer):
    def __init__(self, base, weight=1):
        Spacer.__init__(self, 1, base)
        self.weight = weight


def justify(flows, width, height):
    total = 0
    for i, f in enumerate(flows):
        _, h = f.wrap(width, height)
        total += h + f.getSpaceAfter() + (f.getSpaceBefore() if i else 0)
    extra = height - total - 3
    flex = [f for f in flows if isinstance(f, Flex)]
    wsum = sum(f.weight for f in flex)
    if extra > 0 and wsum:
        for f in flex:
            f.height += extra * f.weight / wsum
    return extra


def ing_table(rows, width):
    data = [[Paragraph(f"<b>{e(q)}</b>", ing), Paragraph(e(n), ing)] for q, n, *_ in rows]
    t = Table(data, colWidths=[17 * mm, width - 17 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 1.2), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, TRAIT),
    ]))
    return t


def step(num, title, time, text, note=None, width=None):
    head = Paragraph(f'<font name="Sans-B" color="{SAPIN_HEX}">{e(title)}</font>'
                     f'<font name="Sans" size="7.2" color="{VERT_HEX}">   {e(time)}</font>', body)
    cells = [head, Paragraph(e(text), body)]
    if note:
        cells.append(Paragraph(f'<font color="{VERT_HEX}">›</font> {e(note)}', tip))
    inner = Table([[c] for c in cells], colWidths=[width - 8 * mm - 7])
    inner.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                               ("TOPPADDING", (0, 0), (-1, -1), 0.4), ("BOTTOMPADDING", (0, 0), (-1, -1), 0.4)]))
    badge = Paragraph(f'<font name="Sans-B" color="{TYPE_TXT_HEX}" size="8">{num}</font>',
                      ParagraphStyle("b", alignment=1, leading=10))
    t = Table([[badge, inner]], colWidths=[8 * mm, width - 8 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (0, 0), TYPE),
        ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (0, 0), 2), ("BOTTOMPADDING", (0, 0), (0, 0), 2),
        ("LEFTPADDING", (1, 0), (1, 0), 6), ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (1, 0), (1, 0), 0), ("BOTTOMPADDING", (1, 0), (1, 0), 0),
    ]))
    return [t, Flex(5, 1)]


def phase(label, width):
    t = Table([[Paragraph(f'<font name="Serif-B" size="10.5" color="{SAPIN_HEX}">{e(label)}</font>', body)]],
              colWidths=[width])
    t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.8, TYPE),
                           ("LEFTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                           ("TOPPADDING", (0, 0), (-1, -1), 2)]))
    return [Flex(2, 1.6), t, Spacer(1, 6)]


def fit_size(text, font, size, maxw, minsize):
    while size > minsize and stringWidth(text, font, size) > maxw:
        size -= 0.5
    return size


def draw_motif(c, band_h):
    """Petit brin de feuillage, motif neutre en haut à droite du bandeau."""
    cx, cy = W - M - 12 * mm, H - band_h / 2
    c.saveState()
    c.setStrokeColor(SAUGE); c.setLineWidth(1.4); c.setLineCap(1)
    tige = c.beginPath()
    tige.moveTo(cx - 2 * mm, cy - 12 * mm)
    tige.curveTo(cx - 1 * mm, cy - 4 * mm, cx + 1 * mm, cy + 4 * mm, cx + 3 * mm, cy + 12 * mm)
    c.drawPath(tige, stroke=1, fill=0)
    # (position le long de la tige, côté, longueur de la feuille)
    for t, cote, long in ((-7, -1, 7.5), (-3, 1, 7.5), (1.5, -1, 6.5), (5.5, 1, 6), (10, -1, 4.5)):
        x = cx - 2 * mm + (t + 12) / 24 * 5 * mm
        c.saveState()
        c.translate(x, cy + t * mm)
        c.rotate(90 - cote * 55)
        c.ellipse(0, -1.4 * mm, long * mm, 1.4 * mm, stroke=1, fill=0)
        c.line(0, 0, long * 0.8 * mm, 0)
        c.restoreState()
    c.restoreState()


def build(r, out):
    global TYPE_HEX, TYPE_TXT_HEX, TYPE, TYPE_TXT
    if r.get("type") not in TYPES:
        probleme = f"type « {r['type']} » inconnu" if "type" in r else "champ « type » manquant"
        sys.exit(f"ERREUR : {probleme}. Types possibles (types.json) : {', '.join(TYPES)}.")
    TYPE_HEX = TYPES[r["type"]]
    TYPE_TXT_HEX = texte_sur(TYPE_HEX)
    TYPE, TYPE_TXT = colors.HexColor(TYPE_HEX), colors.HexColor(TYPE_TXT_HEX)

    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle(r["titre"])
    c.setAuthor("Erick")

    # ---- Bandeau d'en-tête
    band_h = 36 * mm
    c.setFillColor(SAPIN)
    c.rect(0, H - band_h, W, band_h, stroke=0, fill=1)
    draw_motif(c, band_h)
    textw = W - 2 * M - 32 * mm
    c.setFillColor(SAUGE); c.setFont("Sans-B", 8)
    c.drawString(M, H - 11 * mm, r.get("categorie", "RECETTE MAISON"))
    c.setFillColor(colors.white)
    ts = fit_size(r["titre"], "Serif-B", 25, textw, 16)
    c.setFont("Serif-B", ts)
    c.drawString(M, H - 22 * mm, r["titre"])
    if r.get("sous_titre"):
        c.setFillColor(SAUGE)
        ss = fit_size(r["sous_titre"], "Serif-I", 10.5, textw, 8)
        c.setFont("Serif-I", ss)
        c.drawString(M, H - 29 * mm, r["sous_titre"])

    # ---- Bandeau d'infos
    strip_y = H - band_h - 11 * mm
    c.setFillColor(TYPE); c.rect(0, strip_y, W, 11 * mm, stroke=0, fill=1)
    infos = r["infos"]
    colw = (W - 2 * M) / len(infos)
    for i, (k, v) in enumerate(infos):
        x = M + i * colw
        c.setFillColor(TYPE_TXT, alpha=0.8); c.setFont("Sans-B", 6.3); c.drawString(x, strip_y + 6.6 * mm, k)
        vs = fit_size(v, "Sans-B", 8.6, colw - 5 * mm, 6.5)
        c.setFillColor(TYPE_TXT, alpha=1); c.setFont("Sans-B", vs); c.drawString(x, strip_y + 2.5 * mm, v)
        if i:
            c.setStrokeColor(TYPE_TXT, alpha=0.4); c.setLineWidth(0.6)
            c.line(x - 3 * mm, strip_y + 2 * mm, x - 3 * mm, strip_y + 9 * mm)

    top = strip_y - 7 * mm
    bottom = M
    left_w = 56 * mm
    gap = 10 * mm
    right_x = M + left_w + gap
    right_w = W - M - right_x

    # ---- Colonne gauche
    c.setFillColor(SAUGE)
    c.roundRect(M - 4.5 * mm, bottom, left_w + 9 * mm, top - bottom, 3 * mm, stroke=0, fill=1)

    L = [Paragraph("Ingrédients", h2)]
    for gi, (group, rows) in enumerate(r["ingredients"]):
        if gi:
            L.append(Flex(2, 1))
        if group:
            L.append(Paragraph(e(group), sub))
        L.append(ing_table(rows, left_w))
    if r.get("materiel"):
        L.append(Flex(6, 2))
        L.append(Paragraph("Matériel", h2))
        L.append(Paragraph(e(r["materiel"]), small))
    if r.get("planning"):
        L.append(Flex(6, 2))
        L.append(Paragraph("Planning", h2))
        plan = r["planning"]
        pt = Table([[Paragraph(f'<font name="Sans-B" color="{TYPE_TXT_HEX}">{e(a)}</font>',
                               ParagraphStyle("x", fontSize=8, alignment=1, leading=10)),
                     Paragraph(e(b), small)] for a, b in plan], colWidths=[10 * mm, left_w - 10 * mm])
        st = [("BACKGROUND", (0, 0), (0, -1), TYPE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
              ("LEFTPADDING", (1, 0), (1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 3),
              ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
        if len(plan) > 1:
            st.append(("LINEBELOW", (0, 0), (-1, -2), 2, SAUGE))
        pt.setStyle(TableStyle(st))
        L.append(pt)
    if r.get("note"):
        L.append(Flex(7, 2))
        L.append(Paragraph(f'<font name="Serif-I" size="8.4" color="{SAPIN_HEX}">{e(r["note"])}</font>',
                           ParagraphStyle("q", leading=11)))

    lh = top - bottom - 9 * mm
    extra_l = justify(L, left_w, lh)
    Frame(M, bottom + 4.5 * mm, left_w, lh, leftPadding=0, rightPadding=0, topPadding=0,
          bottomPadding=0, showBoundary=0).addFromList(L, c)

    # ---- Colonne droite : étapes
    R = []
    n = 0
    for pi, (label, steps) in enumerate(r["phases"]):
        p = phase(label, right_w)
        R += p[1:] if pi == 0 else p
        for s in steps:
            n += 1
            title, time, text = s[0], s[1], s[2]
            note = s[3] if len(s) > 3 else None
            R.extend(step(n, title, time, text, note, right_w))

    extra_r = justify(R, right_w, top - bottom)
    f = Frame(right_x, bottom, right_w, top - bottom, leftPadding=0, rightPadding=0, topPadding=0,
              bottomPadding=0, showBoundary=0)
    f.addFromList(R, c)
    c.showPage()
    c.save()

    problems = []
    if L:
        problems.append(f"colonne gauche trop longue ({-extra_l / mm:.0f} mm en trop)")
    if R:
        problems.append(f"colonne droite trop longue ({-extra_r / mm:.0f} mm en trop)")
    if problems:
        sys.exit("DÉBORDEMENT : " + " ; ".join(problems) + " — raccourcir les textes puis relancer.")
    print(f"OK — marge libre : gauche {extra_l / mm:.0f} mm, droite {extra_r / mm:.0f} mm")


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8") as fh:
        build(json.load(fh), sys.argv[2])
