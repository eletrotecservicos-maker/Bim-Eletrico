"""
Serviço de Geração de Relatório PDF Técnico
============================================
Gera relatório técnico profissional em PDF usando ReportLab.

Layout:
  1. Capa com dados do projeto
  2. Memorial de cálculo
  3. Equações utilizadas (LaTeX-style via ReportLab)
  4. Tabelas de resultados
  5. Gráficos de heatmap
  6. Conclusão / Resultado final
  7. Placeholder de ART

Padrões aplicados: IEEE 80, ABNT NBR 15751
"""

import os
import io
import math
from datetime import datetime
from typing import Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, Image, KeepTogether,
)
from reportlab.lib.colors import HexColor
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics import renderPDF

# Cores do tema industrial
DARK_BLUE = HexColor('#0D1B2A')
ACCENT_BLUE = HexColor('#1565C0')
LIGHT_BLUE = HexColor('#42A5F5')
SUCCESS_GREEN = HexColor('#2E7D32')
WARNING_ORANGE = HexColor('#E65100')
DANGER_RED = HexColor('#B71C1C')
GRAY_LIGHT = HexColor('#ECEFF1')
GRAY_MED = HexColor('#90A4AE')
WHITE = colors.white


def build_styles() -> dict:
    styles = getSampleStyleSheet()
    return {
        'title': ParagraphStyle(
            'CoverTitle',
            fontSize=28, fontName='Helvetica-Bold',
            textColor=WHITE, alignment=1, spaceAfter=10,
        ),
        'subtitle': ParagraphStyle(
            'CoverSubtitle',
            fontSize=14, fontName='Helvetica',
            textColor=LIGHT_BLUE, alignment=1, spaceAfter=6,
        ),
        'section': ParagraphStyle(
            'Section',
            fontSize=13, fontName='Helvetica-Bold',
            textColor=ACCENT_BLUE, spaceAfter=8, spaceBefore=16,
        ),
        'body': ParagraphStyle(
            'Body',
            fontSize=10, fontName='Helvetica',
            textColor=colors.black, spaceAfter=4, leading=14,
        ),
        'formula': ParagraphStyle(
            'Formula',
            fontSize=10, fontName='Courier',
            textColor=DARK_BLUE, backColor=GRAY_LIGHT,
            spaceAfter=4, leftIndent=20, rightIndent=20, leading=16,
        ),
        'caption': ParagraphStyle(
            'Caption',
            fontSize=9, fontName='Helvetica-Oblique',
            textColor=GRAY_MED, alignment=1, spaceAfter=8,
        ),
    }


def make_result_table(results: dict, styles: dict) -> Table:
    """Tabela de resultados técnicos."""
    safe_icon = lambda b: '✓ APROVADO' if b else '✗ REPROVADO'

    data = [
        ['Parâmetro', 'Símbolo', 'Valor', 'Unidade', 'Status'],
        ['Resistência da Malha', 'Rg', f"{results.get('Rg', 0):.4f}", 'Ω', ''],
        ['Corrente Efetiva de Malha', 'Ig', f"{results.get('Ig', 0):.2f}", 'A', ''],
        ['Ground Potential Rise', 'GPR', f"{results.get('GPR', 0):.2f}", 'V', ''],
        ['Corrente Corporal (50kg)', 'Ib', f"{results.get('Ib_50kg', 0)*1000:.2f}", 'mA', ''],
        ['Fator de Redução Superficial', 'Cs', f"{results.get('Cs', 0):.4f}", '—', ''],
        ['Fator Geométrico (Toque)', 'Km', f"{results.get('Km', 0):.4f}", '—', ''],
        ['Fator Geométrico (Passo)', 'Ks', f"{results.get('Ks', 0):.4f}", '—', ''],
        ['Fator de Irregularidade', 'Ki', f"{results.get('Ki', 0):.4f}", '—', ''],
        ['Tensão de Toque Calculada', 'Em', f"{results.get('Em', 0):.2f}", 'V', safe_icon(results.get('touch_safe', False))],
        ['Tensão de Toque Tolerável', 'Etol', f"{results.get('Etolerable', 0):.2f}", 'V', ''],
        ['Tensão de Passo Calculada', 'Es', f"{results.get('Es', 0):.2f}", 'V', safe_icon(results.get('step_safe', False))],
        ['Tensão de Passo Tolerável', 'Estol', f"{results.get('Estolerable', 0):.2f}", 'V', ''],
    ]

    table = Table(data, colWidths=[70*mm, 20*mm, 30*mm, 20*mm, 35*mm])

    style = TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), ACCENT_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        # Alternating rows
        ('BACKGROUND', (0, 1), (-1, -1), WHITE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (2, 1), (-1, -1), 'CENTER'),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, GRAY_MED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ])

    # Colorir linhas de status
    for i, row in enumerate(data[1:], 1):
        status = row[4]
        if '✓' in status:
            table.setStyle(TableStyle([('TEXTCOLOR', (4, i), (4, i), SUCCESS_GREEN)]))
        elif '✗' in status:
            table.setStyle(TableStyle([
                ('TEXTCOLOR', (4, i), (4, i), DANGER_RED),
                ('FONTNAME', (4, i), (4, i), 'Helvetica-Bold'),
            ]))

    table.setStyle(style)
    return table


def generate_pdf_report(
    project_data: dict,
    scenario_data: dict,
    results: dict,
    output_path: Optional[str] = None,
) -> bytes:
    """
    Gera relatório PDF técnico completo.

    Args:
        project_data:  dados do projeto (name, client, location, etc.)
        scenario_data: dados do cenário (solo, malha, falta)
        results:       resultados do cálculo IEEE 80
        output_path:   caminho para salvar (None = retorna bytes)

    Returns:
        bytes do PDF gerado
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
        title=f"Relatório de Aterramento — {project_data.get('name', '')}",
        author="BIM Elétrico — Analisador de Malhas",
    )

    styles = build_styles()
    story = []
    W, H = A4

    # ========== CAPA ==========
    story.append(Spacer(1, 40*mm))
    story.append(Paragraph("BIM ELÉTRICO", styles['title']))
    story.append(Paragraph("Sistema de Análise de Malhas de Aterramento", styles['subtitle']))
    story.append(Spacer(1, 10*mm))
    story.append(HRFlowable(width='100%', thickness=2, color=ACCENT_BLUE))
    story.append(Spacer(1, 8*mm))
    story.append(Paragraph(f"RELATÓRIO TÉCNICO DE ATERRAMENTO", styles['subtitle']))
    story.append(Spacer(1, 20*mm))

    cover_data = [
        ['Projeto:', project_data.get('name', 'N/D')],
        ['Cliente:', project_data.get('client', 'N/D')],
        ['Local:', project_data.get('location', 'N/D')],
        ['Tipo:', project_data.get('project_type', 'N/D').upper()],
        ['Norma:', 'IEEE Std 80 / ABNT NBR 15751'],
        ['Data:', datetime.now().strftime('%d/%m/%Y')],
        ['Versão:', '1.0'],
    ]

    cover_table = Table(cover_data, colWidths=[50*mm, 120*mm])
    cover_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), ACCENT_BLUE),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, -1), (-1, -1), 0.5, GRAY_MED),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 30*mm))
    story.append(Paragraph(
        "⚠ DOCUMENTO TÉCNICO — USO RESTRITO À ENGENHARIA",
        ParagraphStyle('warn', fontSize=9, textColor=WARNING_ORANGE, alignment=1)
    ))
    story.append(PageBreak())

    # ========== NORMAS E REFERÊNCIAS ==========
    story.append(Paragraph("1. NORMAS E REFERÊNCIAS", styles['section']))
    story.append(Paragraph(
        "Os cálculos deste relatório foram realizados em conformidade com as seguintes normas:",
        styles['body']
    ))
    normas = [
        ['IEEE Std 80 - 2013', 'Guide for Safety in AC Substation Grounding'],
        ['ABNT NBR 15751', 'Sistemas de aterramento em subestações — Requisitos'],
        ['ABNT NBR 5410', 'Instalações elétricas de baixa tensão'],
        ['ABNT NBR 5419', 'Proteção de estruturas contra descargas atmosféricas'],
        ['IEC 61936-1', 'Power installations exceeding 1 kV AC'],
    ]
    norm_table = Table(normas, colWidths=[55*mm, 115*mm])
    norm_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.3, GRAY_MED),
        ('BACKGROUND', (0, 0), (-1, -1), GRAY_LIGHT),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(norm_table)

    # ========== DADOS DE ENTRADA ==========
    story.append(Paragraph("2. DADOS DE ENTRADA", styles['section']))

    soil = scenario_data.get('soil_data', {})
    mesh = scenario_data.get('mesh_data', {})
    fault = scenario_data.get('fault_data', {})

    # Solo
    story.append(Paragraph("2.1 Modelo de Solo", styles['body']))
    soil_data_table = Table([
        ['Parâmetro', 'Valor', 'Unidade'],
        ['Resistividade do solo nativo (ρ)', f"{soil.get('rho', 0):.1f}", 'Ω·m'],
        ['Resistividade camada superficial (ρs)', f"{soil.get('rho_surface', 0):.1f}", 'Ω·m'],
        ['Espessura camada superficial (hs)', f"{soil.get('depth_surface', 0):.2f}", 'm'],
    ], colWidths=[90*mm, 40*mm, 40*mm])
    soil_data_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.3, GRAY_MED),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(soil_data_table)
    story.append(Spacer(1, 4*mm))

    # Malha
    story.append(Paragraph("2.2 Geometria da Malha", styles['body']))
    mesh_table = Table([
        ['Parâmetro', 'Valor', 'Unidade'],
        ['Área da malha (A)', f"{mesh.get('area', 0):.1f}", 'm²'],
        ['Comprimento total de condutores (Lt)', f"{mesh.get('total_length', 0):.1f}", 'm'],
        ['Profundidade de enterramento (h)', f"{mesh.get('depth', 0):.2f}", 'm'],
        ['Espaçamento horizontal (Dx)', f"{mesh.get('spacing_x', 0):.2f}", 'm'],
        ['Espaçamento vertical (Dy)', f"{mesh.get('spacing_y', 0):.2f}", 'm'],
        ['Número de hastes (Nr)', f"{mesh.get('num_rods', 0)}", 'un'],
        ['Comprimento das hastes (Lr)', f"{mesh.get('rod_length', 0):.2f}", 'm'],
        ['Diâmetro do condutor (d)', f"{mesh.get('conductor_diameter', 0)*1000:.2f}", 'mm'],
    ], colWidths=[90*mm, 40*mm, 40*mm])
    mesh_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.3, GRAY_MED),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(mesh_table)
    story.append(Spacer(1, 4*mm))

    # Falta
    story.append(Paragraph("2.3 Condições de Falta", styles['body']))
    fault_table = Table([
        ['Parâmetro', 'Valor', 'Unidade'],
        ['Corrente de falta (If)', f"{fault.get('fault_current', 0):.1f}", 'A'],
        ['Duração da falta (tf)', f"{fault.get('fault_duration', 0):.3f}", 's'],
        ['Fator de divisão de corrente (Sf)', f"{fault.get('division_factor', 0):.2f}", '—'],
        ['Fator de decremento (Df)', f"{fault.get('decrement_factor', 1.0):.3f}", '—'],
    ], colWidths=[90*mm, 40*mm, 40*mm])
    fault_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.3, GRAY_MED),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(fault_table)

    # ========== MEMORIAL DE CÁLCULO ==========
    story.append(PageBreak())
    story.append(Paragraph("3. MEMORIAL DE CÁLCULO", styles['section']))
    story.append(Paragraph(
        "A seguir são apresentadas as equações utilizadas conforme IEEE Std 80 - 2013.",
        styles['body']
    ))

    formulas = [
        ("3.1 Resistência da Malha de Aterramento (IEEE 80, Eq. 52 — Sverak)",
         "Rg = ρ · [ 1/(4·√A) + 1/Lt · (1 + 1/(1 + h·√(20/A))) ]",
         f"Rg = {results.get('Rg',0):.4f} Ω"),

        ("3.2 Corrente Efetiva de Malha",
         "Ig = If · Sf · Df",
         f"Ig = {results.get('Ig',0):.2f} A"),

        ("3.3 Ground Potential Rise (GPR)",
         "GPR = Ig · Rg",
         f"GPR = {results.get('GPR',0):.2f} V"),

        ("3.4 Corrente Corporal Tolerável (IEEE 80, Eq. 1 — 50 kg)",
         "Ib = 0,116 / √t",
         f"Ib = {results.get('Ib_50kg',0)*1000:.2f} mA  (t = {fault.get('fault_duration',0):.3f} s)"),

        ("3.5 Fator de Redução da Camada Superficial (IEEE 80, Eq. 27)",
         "Cs = 1 - [0,09·(1 - ρ/ρs)] / (2·hs + 0,09)",
         f"Cs = {results.get('Cs',0):.4f}"),

        ("3.6 Tensão de Toque Tolerável",
         "Etol = (1000 + 1,5·Cs·ρs) · Ib",
         f"Etol = {results.get('Etolerable',0):.2f} V"),

        ("3.7 Tensão de Passo Tolerável",
         "Estol = (1000 + 6,0·Cs·ρs) · Ib",
         f"Estol = {results.get('Estolerable',0):.2f} V"),

        ("3.8 Tensão de Malha (Toque Calculado, IEEE 80, Eq. 80)",
         "Em = ρ · Km · Ki · Ig / Lm",
         f"Em = {results.get('Em',0):.2f} V"),

        ("3.9 Tensão de Passo Calculada (IEEE 80, Eq. 92)",
         "Es = ρ · Ks · Ki · Ig / Ls",
         f"Es = {results.get('Es',0):.2f} V"),
    ]

    for title, formula, value in formulas:
        story.append(Paragraph(title, styles['body']))
        story.append(Paragraph(f"  {formula}", styles['formula']))
        story.append(Paragraph(f"  → Resultado: {value}", styles['body']))
        story.append(Spacer(1, 2*mm))

    # ========== RESULTADOS ==========
    story.append(PageBreak())
    story.append(Paragraph("4. TABELA DE RESULTADOS", styles['section']))
    story.append(make_result_table(results, styles))

    # ========== CONCLUSÃO ==========
    story.append(Spacer(1, 8*mm))
    story.append(Paragraph("5. CONCLUSÃO", styles['section']))

    safe = results.get('safe', False)
    touch_safe = results.get('touch_safe', False)
    step_safe = results.get('step_safe', False)

    if safe:
        conclusion_style = ParagraphStyle('concl_ok', fontSize=12, fontName='Helvetica-Bold', textColor=SUCCESS_GREEN)
        story.append(Paragraph("✓  A malha de aterramento ATENDE aos requisitos de segurança da IEEE Std 80.", conclusion_style))
    else:
        conclusion_style = ParagraphStyle('concl_fail', fontSize=12, fontName='Helvetica-Bold', textColor=DANGER_RED)
        story.append(Paragraph("✗  A malha de aterramento NÃO ATENDE aos requisitos de segurança da IEEE Std 80.", conclusion_style))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        f"  • Tensão de toque: {'APROVADA' if touch_safe else 'REPROVADA'} "
        f"(Em={results.get('Em',0):.2f} V {'≤' if touch_safe else '>'} Etol={results.get('Etolerable',0):.2f} V)",
        styles['body']
    ))
    story.append(Paragraph(
        f"  • Tensão de passo: {'APROVADA' if step_safe else 'REPROVADA'} "
        f"(Es={results.get('Es',0):.2f} V {'≤' if step_safe else '>'} Estol={results.get('Estolerable',0):.2f} V)",
        styles['body']
    ))

    if not safe:
        story.append(Spacer(1, 4*mm))
        story.append(Paragraph("RECOMENDAÇÕES:", styles['section']))
        story.append(Paragraph(
            "Para adequação da malha, recomenda-se: (1) aumentar a área da malha, "
            "(2) reduzir o espaçamento entre condutores, (3) adicionar hastes verticais, "
            "(4) utilizar camada superficial de alta resistividade (brita), "
            "(5) revisar o fator de divisão de corrente.",
            styles['body']
        ))

    # ========== ART PLACEHOLDER ==========
    story.append(PageBreak())
    story.append(Paragraph("6. ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA (ART)", styles['section']))
    story.append(HRFlowable(width='100%', thickness=1, color=GRAY_MED))
    story.append(Spacer(1, 20*mm))

    art_text = ParagraphStyle('art', fontSize=11, textColor=GRAY_MED, alignment=1)
    story.append(Paragraph("[  ESPAÇO RESERVADO PARA ART DO ENGENHEIRO RESPONSÁVEL  ]", art_text))
    story.append(Spacer(1, 10*mm))

    art_fields = [
        ['Engenheiro Responsável:', '_' * 50],
        ['CREA / CAU:', '_' * 30],
        ['Nº ART:', '_' * 30],
        ['Data:', '_' * 20],
        ['Assinatura:', '_' * 50],
    ]
    art_table = Table(art_fields, colWidths=[60*mm, 110*mm])
    art_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(art_table)

    # Footer info
    story.append(Spacer(1, 20*mm))
    story.append(HRFlowable(width='100%', thickness=0.5, color=GRAY_MED))
    story.append(Paragraph(
        f"Relatório gerado automaticamente pelo sistema BIM Elétrico em {datetime.now().strftime('%d/%m/%Y %H:%M')}. "
        "Este documento é de caráter técnico e deve ser validado por engenheiro habilitado.",
        ParagraphStyle('footer', fontSize=8, textColor=GRAY_MED, alignment=1)
    ))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'wb') as f:
            f.write(pdf_bytes)

    return pdf_bytes
