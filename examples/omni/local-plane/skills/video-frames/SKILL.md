---
name: video-frames
description: Extract frames or short clips from videos using ffmpeg.
homepage: https://ffmpeg.org
metadata:
  {
    "omni":
      {
        "emoji": "🎞️",
        "requires": { "bins": ["ffmpeg"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "ffmpeg",
              "bins": ["ffmpeg"],
              "label": "Install ffmpeg (brew)",
            },
            {
              "id": "apt",
              "kind": "apt",
              "package": "ffmpeg",
              "bins": ["ffmpeg"],
              "label": "Install ffmpeg (apt)",
            },
          ],
      },
  }
---

# Video Frames (ffmpeg)

Extract frames from videos for inspection or analysis.

## Extract a single frame

First frame:

```bash
ffmpeg -i /path/to/video.mp4 -vframes 1 /tmp/frame.jpg
```

At a specific timestamp (e.g., 10 seconds):

```bash
ffmpeg -ss 00:00:10 -i /path/to/video.mp4 -vframes 1 /tmp/frame-10s.jpg
```

## Extract multiple frames

Every 1 second:

```bash
ffmpeg -i /path/to/video.mp4 -vf "fps=1" /tmp/frame_%04d.jpg
```

Every 5 seconds:

```bash
ffmpeg -i /path/to/video.mp4 -vf "fps=1/5" /tmp/frame_%04d.jpg
```

## Extract a short clip

Extract 5 seconds starting at 30 seconds:

```bash
ffmpeg -ss 00:00:30 -i /path/to/video.mp4 -t 5 -c copy /tmp/clip.mp4
```

## Get video info

```bash
ffprobe -v quiet -print_format json -show_format -show_streams /path/to/video.mp4
```

## Notes

- Use `-ss` before `-i` for fast seeking (seeks to nearest keyframe)
- Use `-ss` after `-i` for accurate seeking (slower, decodes from start)
- Use `.jpg` for quick share; use `.png` for crisp UI frames
- `-vframes 1` limits output to single frame
