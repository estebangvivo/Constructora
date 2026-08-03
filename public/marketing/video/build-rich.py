"""Build a richer promo: many clips, varied transitions, human-ish MMS voice + soft BGM."""
import math
import subprocess
from pathlib import Path

OUT = Path(r"C:\Users\esteb\Constructora\public\marketing\video")
REC = next((OUT / "app-recording-rich").glob("*.webm"))
VOICE_RAW = OUT / "voice-tests" / "mms-spa.wav"
BGM = OUT / "bgm-calm.wav"
CLIPS = OUT / "rich-clips"
CLIPS.mkdir(exist_ok=True)
WALK = OUT / "app-walkthrough-rich.mp4"
MIX = OUT / "narracion-mms-musica.mp3"
EDIT = OUT / "rich-edit-tmp.mp4"
HOLD = OUT / "rich-cta-hold.mp4"
FINAL = OUT / "simpleobra-promo-app-recorrido-16x9.mp4"


def run(cmd, check=True):
    print(">", " ".join(str(c) for c in cmd[:8]), "...")
    return subprocess.run(cmd, check=check, capture_output=True, text=True)


def duration(path: Path) -> float:
    r = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(r.stdout.strip())


# 1) convert recording
run(
    [
        "ffmpeg",
        "-y",
        "-i",
        str(REC),
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-an",
        str(WALK),
    ]
)
vdur = duration(WALK)
print("walk", vdur)

# 2) soften voice + mix bgm
# upsample-ish feel via loudnorm and mild EQ
soft = OUT / "voice-tests" / "mms-spa-soft.wav"
run(
    [
        "ffmpeg",
        "-y",
        "-i",
        str(VOICE_RAW),
        "-af",
        "highpass=f=80,lowpass=f=10000,equalizer=f=300:t=q:w=1:g=2,equalizer=f=3500:t=q:w=1:g=-2,acompressor=threshold=-18dB:ratio=2.2:attack=20:release=200:makeup=1.5,loudnorm=I=-16:TP=-1.5:LRA=11",
        str(soft),
    ]
)
adur = duration(soft)
print("voice", adur)

run(
    [
        "ffmpeg",
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        str(BGM),
        "-i",
        str(soft),
        "-filter_complex",
        (
            f"[0:a]atrim=0:{adur:.3f},afade=t=in:st=0:d=1.2,"
            f"afade=t=out:st={max(0, adur-2.2):.3f}:d=2.2,volume=0.14[bg];"
            "[1:a]volume=1.05[vg];"
            "[bg][vg]amix=inputs=2:duration=first:dropout_transition=0,"
            "loudnorm=I=-15:TP=-1.5:LRA=11[a]"
        ),
        "-map",
        "[a]",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "192k",
        str(MIX),
    ]
)
adur = duration(MIX)

# 3) pick many moments across the long recording
n = 10
clip_len = 4.4
# skip first ~8s (login), spread over rest
usable = max(20.0, vdur - 12)
starts = [8 + i * (usable / (n - 1)) for i in range(n)]
starts = [min(s, vdur - clip_len - 0.2) for s in starts]

zooms = [
    "min(1.12,1+0.0011*on)",
    "if(eq(on,1),1.12,max(1.0,1.12-0.0011*on))",
    "min(1.15,1+0.0014*on)",
    "if(eq(on,1),1.1,max(1.0,1.1-0.0009*on))",
    "min(1.13,1+0.0012*on)",
    "if(eq(on,1),1.14,max(1.02,1.14-0.0013*on))",
    "min(1.11,1+0.0010*on)",
    "if(eq(on,1),1.13,max(1.0,1.13-0.0012*on))",
    "min(1.16,1+0.0015*on)",
    "if(eq(on,1),1.12,max(1.0,1.12-0.0010*on))",
]

for i, ss in enumerate(starts):
    z = zooms[i % len(zooms)]
    clip = CLIPS / f"c{i}.mp4"
    vf = (
        "scale=1920:1080:force_original_aspect_ratio=decrease,"
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1220,"
        "fps=30,"
        f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,"
        "eq=contrast=1.05:saturation=1.12:brightness=0.01,"
        "unsharp=5:5:0.55:5:5:0.0,format=yuv420p"
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{ss:.3f}",
            "-t",
            str(clip_len),
            "-i",
            str(WALK),
            "-vf",
            vf,
            "-an",
            str(clip),
        ]
    )
    print("clip", i, "from", round(ss, 1))

# 4) xfade chain with varied transitions
transitions = [
    "fade",
    "slideleft",
    "fadeblack",
    "slideright",
    "fade",
    "slideup",
    "fade",
    "slidedown",
    "slideleft",
]
xfade = 0.32
cmd = ["ffmpeg", "-y"]
for i in range(n):
    cmd += ["-i", str(CLIPS / f"c{i}.mp4")]

parts = []
prev = "[0:v]"
offset = clip_len - xfade
for i in range(1, n):
    tr = transitions[(i - 1) % len(transitions)]
    label = "[vout]" if i == n - 1 else f"[vx{i}]"
    parts.append(
        f"{prev}[{i}:v]xfade=transition={tr}:duration={xfade}:offset={offset:.3f}{label}"
    )
    prev = label
    offset += clip_len - xfade

cmd += [
    "-filter_complex",
    ";".join(parts),
    "-map",
    "[vout]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-an",
    str(EDIT),
]
run(cmd)
edur = duration(EDIT)
print("edit", edur)

# 5) CTA hold if audio longer
hold = max(1.2, adur - edur + 0.2)
run(
    [
        "ffmpeg",
        "-y",
        "-sseof",
        "-0.05",
        "-i",
        str(EDIT),
        "-vframes",
        "1",
        str(OUT / "rich-last.png"),
    ]
)
run(
    [
        "ffmpeg",
        "-y",
        "-loop",
        "1",
        "-t",
        f"{hold:.3f}",
        "-i",
        str(OUT / "rich-last.png"),
        "-vf",
        "zoompan=z='min(1.1,1+0.0007*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,format=yuv420p",
        "-an",
        str(HOLD),
    ]
)
joined = OUT / "rich-edit-hold.mp4"
run(
    [
        "ffmpeg",
        "-y",
        "-i",
        str(EDIT),
        "-i",
        str(HOLD),
        "-filter_complex",
        "[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p[v]",
        "-map",
        "[v]",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-an",
        str(joined),
    ]
)
jdur = duration(joined)
spd = jdur / adur
print("joined", jdur, "speed", spd)

# optional subtle end caption via drawtext if font available — skip for reliability

run(
    [
        "ffmpeg",
        "-y",
        "-i",
        str(joined),
        "-i",
        str(MIX),
        "-filter_complex",
        f"[0:v]setpts=PTS/{spd:.6f},format=yuv420p[v]",
        "-map",
        "[v]",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        str(FINAL),
    ]
)
print("FINAL", FINAL, duration(FINAL))
