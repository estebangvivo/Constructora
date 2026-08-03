"""Generate promo narration with Gemini TTS. Reads GEMINI_API_KEY from .env (never prints it)."""
from __future__ import annotations

import base64
import wave
from pathlib import Path

ROOT = Path(r"C:\Users\esteb\Constructora")
OUT_DIR = ROOT / "public" / "marketing" / "video" / "voice-tests"
OUT_WAV = OUT_DIR / "gemini-amena.wav"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def load_key() -> str:
    env = ROOT / ".env"
    for line in env.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        if k.strip() == "GEMINI_API_KEY":
            return v.strip().strip('"').strip("'")
    raise SystemExit("GEMINI_API_KEY no encontrada en .env")


SCRIPT = """Hola. Si hoy tu obra vive en Excel y WhatsApp, es fácil perder el control.
Con SimpleObra podés ver tus obras, el avance y la tesorería, todo en un solo lugar.
Recibos, órdenes de pago, cheques y caja, siempre al día.
Gestión de obras, sin complicaciones.
Entrá a bunas punto com punto ar, registrate, y aprovechá tu prueba gratis.
Si querés, escribinos por WhatsApp al tres cinco tres, cuatro uno nueve, siete seis cuatro cero.
Estamos para ayudarte."""

PROMPT = (
    "Decí el siguiente texto en español rioplatense, tono amable, cercano y profesional, "
    "como una persona real. Natural, sin sonar robot. "
    "Pronunciá claramente 'bunas punto com punto ar'.\n\n" + SCRIPT
)


def write_wav(path: Path, pcm: bytes, channels=1, rate=24000, sample_width=2):
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm)


def main():
    api_key = load_key()
    print("key_loaded", len(api_key) >= 20)

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    # 1) New Interactions TTS API
    for model in ("gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"):
        try:
            print("try_interactions", model)
            interaction = client.interactions.create(
                model=model,
                input=PROMPT,
                response_format={"type": "audio"},
                generation_config={"speech_config": [{"voice": "Kore"}]},
            )
            raw = interaction.outputs[0].audio.data if hasattr(interaction, "outputs") else None
            if raw is None and hasattr(interaction, "output_audio"):
                raw = interaction.output_audio.data
            if isinstance(raw, str):
                raw = base64.b64decode(raw)
            write_wav(OUT_WAV, raw)
            print("ok_interactions", model, OUT_WAV.stat().st_size)
            return
        except Exception as e:
            print("fail_interactions", model, type(e).__name__, str(e)[:220])

    # 2) Classic generate_content AUDIO modality
    for model in (
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-pro-preview-tts",
        "gemini-2.5-flash-tts",
    ):
        try:
            print("try_generate", model)
            response = client.models.generate_content(
                model=model,
                contents=PROMPT,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name="Kore",
                            )
                        )
                    ),
                ),
            )
            inline = response.candidates[0].content.parts[0].inline_data
            data = inline.data
            if isinstance(data, str):
                data = base64.b64decode(data)
            mime = (inline.mime_type or "").lower()
            print("mime", mime, "bytes", len(data))
            if "mp3" in mime or "mpeg" in mime:
                mp3 = OUT_DIR / "gemini-amena.mp3"
                mp3.write_bytes(data)
                print("ok_generate_mp3", model, mp3.stat().st_size)
                return
            write_wav(OUT_WAV, data)
            print("ok_generate", model, OUT_WAV.stat().st_size)
            return
        except Exception as e:
            print("fail_generate", model, type(e).__name__, str(e)[:220])

    raise SystemExit("No se pudo generar audio con Gemini TTS")


if __name__ == "__main__":
    main()
