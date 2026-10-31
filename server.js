
import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import { File } from "node:buffer";
import { fal } from "@fal-ai/client";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ status: "Fresh AI Studio server is running" });
});

app.post("/api/generate", upload.single("file"), async (req, res) => {
  try {
    if (!process.env.FAL_KEY) {
      return res.status(500).json({
        error: "FAL API key is not configured on the server."
      });
    }

    const { mode, prompt, duration, ratio } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        error: "Please enter a prompt."
      });
    }

    let model;
    let input = {
      prompt: prompt.trim(),
      duration: duration === "10" ? "10" : "5",
      enable_safety_checker: true
    };

    if (mode === "text-to-video") {
      model = "fal-ai/kling-video/v2.5-turbo/pro/text-to-video";
      input.aspect_ratio = ["16:9", "9:16", "1:1"].includes(ratio)
        ? ratio
        : "16:9";

    } else if (mode === "image-to-video") {
      if (!req.file) {
        return res.status(400).json({
          error: "Please upload an image."
        });
      }

      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({
          error: "Please upload an image file."
        });
      }

      model = "fal-ai/kling-video/v2.5-turbo/standard/image-to-video";

      const imageFile = new File(
        [req.file.buffer],
        req.file.originalname,
        { type: req.file.mimetype }
      );

      input.image_url = await fal.storage.upload(imageFile);

    } else {
      return res.status(400).json({
        error: "This feature is not connected yet. Start with Image to Video or Text to Video."
      });
    }

    const result = await fal.subscribe(model, {
      input,
      logs: true
    });

    const videoUrl = result.data?.video?.url;

    if (!videoUrl) {
      throw new Error("No video was returned. Please try again.");
    }

    res.json({
      success: true,
      video_url: videoUrl,
      message: "Your video has been created!"
    });

  } catch (error) {
    console.error("Generation error:", error.message);

    res.status(500).json({
      error: error.message || "Video generation failed."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Fresh AI Studio running on port ${PORT}`);
});
