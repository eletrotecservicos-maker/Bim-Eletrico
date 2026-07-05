#!/usr/bin/env python3
"""Gerador do vídeo de treinamento NR-10 com instrutor virtual.

Produz um MP4 (1280x720) em que um instrutor animado apresenta a NR-10
(Segurança em Instalações e Serviços em Eletricidade), com narração em
português brasileiro sintetizada offline (espeak-ng + mbrola br1) e boca
sincronizada com a amplitude do áudio.

Dependências de sistema: ffmpeg, espeak-ng, mbrola, mbrola-br1
Dependências Python: pillow, numpy

Uso:
    python3 gerar_video.py [saida.mp4]
"""

import math
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
FPS = 15
VOICE = "mb-br1"          # voz masculina pt-BR (mbrola)
SPEECH_RATE = "130"       # palavras por minuto
PAUSE_S = 0.8             # silêncio entre cenas

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
F_TITLE = ImageFont.truetype(f"{FONT_DIR}/DejaVuSans-Bold.ttf", 40)
F_BIG = ImageFont.truetype(f"{FONT_DIR}/DejaVuSans-Bold.ttf", 96)
F_SUB = ImageFont.truetype(f"{FONT_DIR}/DejaVuSans-Bold.ttf", 30)
F_BULLET = ImageFont.truetype(f"{FONT_DIR}/DejaVuSans.ttf", 27)
F_SMALL = ImageFont.truetype(f"{FONT_DIR}/DejaVuSans.ttf", 18)

# ---------------------------------------------------------------------------
# Conteúdo: título do slide, tópicos, narração
# ---------------------------------------------------------------------------
SCENES = [
    {
        "title": "NR-10",
        "subtitle": "Segurança em Instalações e Serviços em Eletricidade",
        "bullets": [],
        "narration": (
            "Olá! Seja bem-vindo ao nosso treinamento de segurança. "
            "Eu sou o seu instrutor, e hoje vamos falar sobre a Norma "
            "Regulamentadora número dez, a NR dez, que trata da segurança "
            "em instalações e serviços em eletricidade."
        ),
    },
    {
        "title": "O que é a NR-10?",
        "bullets": [
            "Norma do Ministério do Trabalho e Emprego",
            "Requisitos mínimos de segurança em eletricidade",
            "Vale para geração, transmissão, distribuição e consumo",
            "Abrange projeto, construção, operação e manutenção",
        ],
        "narration": (
            "A NR dez é uma norma do Ministério do Trabalho que estabelece "
            "os requisitos e as condições mínimas de segurança para quem "
            "trabalha com eletricidade. Ela se aplica às fases de geração, "
            "transmissão, distribuição e consumo de energia elétrica, "
            "incluindo o projeto, a construção, a montagem, a operação e a "
            "manutenção das instalações elétricas."
        ),
    },
    {
        "title": "Principais riscos elétricos",
        "bullets": [
            "Choque elétrico — pode ser fatal",
            "Arco elétrico — queimaduras graves",
            "Incêndio e explosão",
            "Quedas e acidentes indiretos",
        ],
        "narration": (
            "Trabalhar com eletricidade envolve riscos graves. O choque "
            "elétrico pode causar queimaduras, parada cardíaca e até a "
            "morte. O arco elétrico provoca queimaduras gravíssimas e pode "
            "gerar incêndios e explosões. Além disso, o susto de um choque "
            "pode causar quedas de altura e outros acidentes indiretos. "
            "Por isso, nunca subestime a eletricidade."
        ),
    },
    {
        "title": "Medidas de proteção coletiva",
        "bullets": [
            "Desenergização — a medida mais segura",
            "Seccionamento e bloqueio de reenergização",
            "Constatação de ausência de tensão",
            "Aterramento temporário e sinalização",
        ],
        "narration": (
            "A principal medida de proteção coletiva é a desenergização. "
            "Ela segue uma sequência obrigatória: seccionar o circuito, "
            "impedir a reenergização com bloqueio e etiqueta, constatar a "
            "ausência de tensão, instalar o aterramento temporário e "
            "sinalizar a área de trabalho. Somente após essas etapas o "
            "serviço pode começar."
        ),
    },
    {
        "title": "Equipamentos de proteção individual",
        "bullets": [
            "Capacete com classe de isolação",
            "Luvas isolantes de borracha",
            "Vestimenta resistente a arco elétrico",
            "Calçado e ferramentas isoladas",
        ],
        "narration": (
            "Quando a proteção coletiva não for suficiente, use os "
            "equipamentos de proteção individual. Capacete de segurança com "
            "isolação elétrica, luvas isolantes de borracha testadas, "
            "vestimenta resistente ao arco elétrico, calçado isolante e "
            "ferramentas com isolação adequada. E lembre-se: o E P I só "
            "protege se estiver em boas condições e for usado corretamente."
        ),
    },
    {
        "title": "Capacitação e autorização",
        "bullets": [
            "Curso básico de 40 horas",
            "Reciclagem a cada 2 anos",
            "Curso complementar para alta tensão (SEP)",
            "Só trabalhador autorizado pode intervir",
        ],
        "narration": (
            "A NR dez exige capacitação. O curso básico tem carga mínima de "
            "quarenta horas, com reciclagem a cada dois anos. Quem atua no "
            "sistema elétrico de potência, em alta tensão, precisa também do "
            "curso complementar. E atenção: somente o trabalhador capacitado, "
            "habilitado e formalmente autorizado pela empresa pode intervir "
            "em instalações elétricas."
        ),
    },
    {
        "title": "Segurança em primeiro lugar",
        "bullets": [
            "A vida vem sempre em primeiro lugar",
            "Na dúvida, não improvise: desenergize",
            "Eletricidade não dá segunda chance",
        ],
        "narration": (
            "Chegamos ao fim deste treinamento. Guarde bem estas lições: "
            "planeje o serviço, use as proteções, respeite os procedimentos "
            "e nunca trabalhe sozinho em circuitos energizados. A "
            "eletricidade não dá segunda chance, mas a prevenção salva "
            "vidas. Obrigado pela atenção e trabalhe sempre com segurança!"
        ),
    },
]

# Paleta
BG_TOP = (24, 34, 52)
BG_BOTTOM = (38, 52, 76)
FLOOR = (20, 27, 40)
SLIDE_BG = (248, 249, 251)
HEADER = (18, 60, 110)
ACCENT = (245, 130, 30)
TEXT_DARK = (35, 42, 52)
SKIN = (232, 184, 138)
SKIN_SHADOW = (208, 158, 112)
SHIRT = (42, 92, 158)
VEST = (243, 116, 33)
VEST_STRIPE = (250, 224, 80)
PANTS = (52, 58, 68)
HAT = (240, 242, 245)
HAT_SHADOW = (210, 214, 222)


def synthesize_scene(text: str, path: str) -> None:
    subprocess.run(
        ["espeak-ng", "-v", VOICE, "-s", SPEECH_RATE, "-a", "180",
         "-w", path, text],
        check=True, capture_output=True,
    )


def read_wav(path: str):
    with wave.open(path, "rb") as w:
        assert w.getsampwidth() == 2 and w.getnchannels() == 1
        rate = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return rate, data


def build_audio(tmp: str):
    """Sintetiza todas as cenas e devolve (rate, samples, limites por cena)."""
    rate = None
    chunks, bounds = [], []
    pos = 0
    for i, scene in enumerate(SCENES):
        path = os.path.join(tmp, f"scene{i}.wav")
        synthesize_scene(scene["narration"], path)
        r, data = read_wav(path)
        rate = rate or r
        assert r == rate
        pause = np.zeros(int(PAUSE_S * rate), dtype=np.int16)
        start = pos
        chunks += [data, pause]
        pos += len(data) + len(pause)
        bounds.append((start, start + len(data)))
    samples = np.concatenate(chunks)
    return rate, samples, bounds


def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def draw_lightning(draw, cx, cy, size, color=ACCENT):
    s = size
    pts = [(cx + 0.10 * s, cy - 0.50 * s), (cx - 0.22 * s, cy + 0.08 * s),
           (cx - 0.02 * s, cy + 0.08 * s), (cx - 0.12 * s, cy + 0.50 * s),
           (cx + 0.24 * s, cy - 0.10 * s), (cx + 0.02 * s, cy - 0.10 * s)]
    draw.polygon(pts, fill=color)


def make_background():
    img = Image.new("RGB", (W, H))
    top, bot = np.array(BG_TOP, float), np.array(BG_BOTTOM, float)
    grad = top[None, :] + (bot - top)[None, :] * (np.arange(H) / H)[:, None]
    arr = np.repeat(grad[:, None, :], W, axis=1).astype(np.uint8)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 655, W, H], fill=FLOOR)
    d.line([0, 655, W, 655], fill=(60, 75, 100), width=2)
    return img


def make_slide(scene_idx: int, n_visible: int):
    """Slide (parte estática do quadro) com n_visible tópicos revelados."""
    scene = SCENES[scene_idx]
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = 430, 55, 1235, 645
    d.rounded_rectangle([x0 + 6, y0 + 8, x1 + 6, y1 + 8], 18,
                        fill=(0, 0, 0, 90))
    d.rounded_rectangle([x0, y0, x1, y1], 18, fill=SLIDE_BG)

    if scene_idx == 0:
        # Slide de abertura
        d.rounded_rectangle([x0, y0, x1, y0 + 14], 18, fill=ACCENT)
        # Triângulo de advertência com raio
        tx, ty, ts = (x0 + x1) // 2, y0 + 175, 150
        tri = [(tx, ty - ts // 2), (tx - ts // 2 - 15, ty + ts // 2),
               (tx + ts // 2 + 15, ty + ts // 2)]
        d.polygon(tri, fill=(255, 205, 0), outline=(40, 40, 40))
        d.line(tri + [tri[0]], fill=(40, 40, 40), width=5)
        draw_lightning(d, tx, ty + 14, 95, color=(35, 35, 35))
        d.text(((x0 + x1) // 2, y0 + 330), "NR-10", font=F_BIG,
               fill=HEADER, anchor="mm")
        for j, ln in enumerate(wrap(d, scene["subtitle"], F_SUB,
                                    x1 - x0 - 120)):
            d.text(((x0 + x1) // 2, y0 + 415 + j * 40), ln, font=F_SUB,
                   fill=TEXT_DARK, anchor="mm")
        d.text(((x0 + x1) // 2, y1 - 40),
               "Treinamento de Segurança do Trabalho", font=F_SMALL,
               fill=(120, 128, 140), anchor="mm")
    else:
        d.rounded_rectangle([x0, y0, x1, y0 + 86], 18, fill=HEADER)
        d.rectangle([x0, y0 + 60, x1, y0 + 86], fill=HEADER)
        d.rectangle([x0, y0 + 86, x1, y0 + 94], fill=ACCENT)
        draw_lightning(d, x0 + 48, y0 + 44, 52, color=(255, 205, 0))
        d.text((x0 + 90, y0 + 43), scene["title"], font=F_TITLE,
               fill=(255, 255, 255), anchor="lm")
        y = y0 + 150
        for b, bullet in enumerate(scene["bullets"][:n_visible]):
            d.rectangle([x0 + 55, y - 11, x0 + 77, y + 11], fill=ACCENT)
            lines = wrap(d, bullet, F_BULLET, x1 - x0 - 170)
            for ln in lines:
                d.text((x0 + 100, y), ln, font=F_BULLET, fill=TEXT_DARK,
                       anchor="lm")
                y += 36
            y += 42 - 36 + 36
        d.text(((x0 + x1) // 2, y1 - 28),
               f"NR-10  •  Segurança em Eletricidade  •  "
               f"{scene_idx + 1}/{len(SCENES)}",
               font=F_SMALL, fill=(130, 138, 150), anchor="mm")
    return img


def draw_instructor(d: ImageDraw.ImageDraw, mouth: float, blink: bool,
                    bob: float, point: float):
    """Desenha o instrutor. mouth/point em 0..1, bob em pixels."""
    cx = 215
    oy = int(round(bob))

    # Pernas e sapatos
    d.rectangle([cx - 52, 545 + oy, cx - 12, 660], fill=PANTS)
    d.rectangle([cx + 12, 545 + oy, cx + 52, 660], fill=PANTS)
    d.ellipse([cx - 66, 645, cx - 6, 672], fill=(25, 25, 28))
    d.ellipse([cx + 6, 645, cx + 66, 672], fill=(25, 25, 28))

    # Torso (camisa + colete refletivo)
    d.rounded_rectangle([cx - 78, 398 + oy, cx + 78, 560 + oy], 26,
                        fill=SHIRT)
    d.rounded_rectangle([cx - 62, 402 + oy, cx + 62, 556 + oy], 22,
                        fill=VEST)
    d.rectangle([cx - 44, 402 + oy, cx - 28, 556 + oy], fill=VEST_STRIPE)
    d.rectangle([cx + 28, 402 + oy, cx + 44, 556 + oy], fill=VEST_STRIPE)
    d.rectangle([cx - 62, 468 + oy, cx + 62, 484 + oy], fill=VEST_STRIPE)

    # Braço esquerdo (abaixado, segurando prancheta)
    d.line([cx - 70, 420 + oy, cx - 92, 530 + oy], fill=SHIRT, width=26)
    d.ellipse([cx - 106, 518 + oy, cx - 78, 546 + oy], fill=SKIN)
    d.rounded_rectangle([cx - 128, 500 + oy, cx - 86, 560 + oy], 6,
                        fill=(150, 105, 60))
    d.rounded_rectangle([cx - 122, 508 + oy, cx - 92, 552 + oy], 4,
                        fill=(245, 245, 240))

    # Braço direito (apontando para o quadro; sobe/desce com `point`)
    hx = cx + 148
    hy = int(340 + oy + (1.0 - point) * 130)
    d.line([cx + 70, 425 + oy, hx, hy], fill=SHIRT, width=26)
    d.ellipse([hx - 14, hy - 14, hx + 14, hy + 14], fill=SKIN)
    d.line([hx, hy, hx + 62, hy - 26], fill=(90, 90, 95), width=7)
    d.ellipse([hx + 56, hy - 32, hx + 68, hy - 20], fill=ACCENT)

    # Pescoço e cabeça
    d.rectangle([cx - 16, 372 + oy, cx + 16, 402 + oy], fill=SKIN_SHADOW)
    d.ellipse([cx - 58, 268 + oy, cx + 58, 392 + oy], fill=SKIN)
    d.ellipse([cx - 70, 312 + oy, cx - 50, 344 + oy], fill=SKIN)
    d.ellipse([cx + 50, 312 + oy, cx + 70, 344 + oy], fill=SKIN)

    # Óculos de segurança
    d.rounded_rectangle([cx - 52, 300 + oy, cx + 52, 336 + oy], 12,
                        outline=(70, 78, 90), width=4,
                        fill=(190, 215, 235))
    d.line([cx - 6, 308 + oy, cx + 6, 308 + oy], fill=(70, 78, 90), width=4)
    # Olhos
    if blink:
        d.line([cx - 36, 318 + oy, cx - 14, 318 + oy], fill=(45, 45, 50),
               width=4)
        d.line([cx + 14, 318 + oy, cx + 36, 318 + oy], fill=(45, 45, 50),
               width=4)
    else:
        d.ellipse([cx - 32, 310 + oy, cx - 18, 326 + oy], fill=(45, 45, 50))
        d.ellipse([cx + 18, 310 + oy, cx + 32, 326 + oy], fill=(45, 45, 50))
    # Sobrancelhas
    d.line([cx - 38, 296 + oy, cx - 14, 293 + oy], fill=(70, 50, 35),
           width=5)
    d.line([cx + 14, 293 + oy, cx + 38, 296 + oy], fill=(70, 50, 35),
           width=5)
    # Nariz
    d.line([cx, 326 + oy, cx - 4, 346 + oy], fill=SKIN_SHADOW, width=4)

    # Boca (sincronizada com o áudio)
    mh = 3 + mouth * 20
    if mh < 6:
        d.arc([cx - 18, 352 + oy, cx + 18, 372 + oy], 15, 165,
              fill=(120, 60, 50), width=4)
    else:
        d.ellipse([cx - 16, 362 + oy - mh / 2, cx + 16, 362 + oy + mh / 2],
                  fill=(96, 40, 38))
        if mh > 12:
            d.rectangle([cx - 10, 362 + oy - mh / 2 + 2, cx + 10,
                         362 + oy - mh / 2 + 6], fill=(240, 240, 235))

    # Capacete de segurança
    d.pieslice([cx - 62, 240 + oy, cx + 62, 330 + oy], 180, 360, fill=HAT)
    d.rounded_rectangle([cx - 74, 278 + oy, cx + 74, 294 + oy], 8,
                        fill=HAT_SHADOW)
    d.rectangle([cx - 12, 244 + oy, cx + 12, 282 + oy], fill=HAT_SHADOW)
    draw_lightning(d, cx, 266 + oy, 30, color=ACCENT)


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "video/nr10_treinamento.mp4"
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="nr10_")
    try:
        print("Sintetizando narração...")
        rate, samples, bounds = build_audio(tmp)
        audio_path = os.path.join(tmp, "narracao.wav")
        with wave.open(audio_path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(samples.tobytes())

        spf = rate / FPS  # amostras por quadro
        total_frames = int(len(samples) / spf)
        dur = len(samples) / rate
        print(f"Áudio: {dur:.1f}s  •  {total_frames} quadros a {FPS} fps")

        # Envelope de amplitude por quadro (para a boca)
        rms = np.array([
            np.sqrt(np.mean(samples[int(i * spf):int((i + 1) * spf)]
                            .astype(np.float64) ** 2) + 1e-9)
            for i in range(total_frames)
        ])
        peak = np.percentile(rms[rms > 100], 90) if (rms > 100).any() else 1
        mouth_env = np.clip(rms / peak, 0, 1)
        # suavização simples
        mouth_env = np.convolve(mouth_env, [0.3, 0.5, 0.2], mode="same")

        background = make_background()
        slide_cache = {}

        print("Renderizando vídeo...")
        ffmpeg = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
             "-r", str(FPS), "-i", "-",
             "-i", audio_path,
             "-c:v", "libx264", "-preset", "medium", "-crf", "25",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k",
             "-movflags", "+faststart", "-shortest", out_path],
            stdin=subprocess.PIPE,
        )

        for f in range(total_frames):
            sample = f * spf
            scene_idx = 0
            for i, (s0, s1) in enumerate(bounds):
                if sample >= s0:
                    scene_idx = i
            s0, s1 = bounds[scene_idx]
            scene = SCENES[scene_idx]
            scene_pos = ((sample - s0) / max(1, (s1 - s0)))
            scene_pos = min(1.0, max(0.0, scene_pos))

            n_bullets = len(scene["bullets"])
            n_visible = min(n_bullets,
                            int(scene_pos * (n_bullets + 0.35)) + 1) \
                if n_bullets else 0

            key = (scene_idx, n_visible)
            if key not in slide_cache:
                base = background.copy()
                base.paste(make_slide(scene_idx, n_visible), (0, 0),
                           make_slide(scene_idx, n_visible))
                slide_cache[key] = base
            frame = slide_cache[key].copy()

            t = f / FPS
            speaking = sample < s1
            mouth = float(mouth_env[f]) if speaking else 0.0
            blink = (f + scene_idx * 17) % 52 < 3
            bob = 3.0 * math.sin(t * 1.9)
            point = 0.15 if n_bullets == 0 else \
                min(1.0, (n_visible - 0.4) / max(1, n_bullets - 1) * 0.9 + 0.1)

            draw_instructor(ImageDraw.Draw(frame), mouth, blink, bob, point)
            ffmpeg.stdin.write(frame.tobytes())

        ffmpeg.stdin.close()
        ffmpeg.wait()
        if ffmpeg.returncode != 0:
            sys.exit("ffmpeg falhou")
        size_mb = os.path.getsize(out_path) / 1e6
        print(f"OK: {out_path}  ({dur:.0f}s, {size_mb:.1f} MB)")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
