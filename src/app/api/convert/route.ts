import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const FORMAT_MAP: Record<string, keyof sharp.FormatEnum> = {
  webp: "webp",
  avif: "avif",
  jpeg: "jpeg",
  jpg: "jpeg",
  png: "png",
  jfif: "jpeg",
  bmp: "png", // sharp não suporta bmp nativo, usamos png como fallback
  tiff: "tiff",
};

const SUPPORTED_INPUTS = new Set([
  "image/webp",
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/bmp",
  "image/tiff",
  "image/gif",
]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const format = (formData.get("format") as string || "webp").toLowerCase();
    const quality = parseInt(formData.get("quality") as string || "90", 10);

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    if (!SUPPORTED_INPUTS.has(file.type) && !file.name.match(/\.(jfif|tif)$/i)) {
      return NextResponse.json(
        { error: `Formato não suportado: ${file.type}` },
        { status: 400 }
      );
    }

    const targetFormat = FORMAT_MAP[format];
    if (!targetFormat) {
      return NextResponse.json(
        { error: `Formato de destino inválido: ${format}` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let pipeline = sharp(buffer);

    // Configurar formato de saída
    switch (targetFormat) {
      case "webp":
        pipeline = pipeline.webp({ quality });
        break;
      case "avif":
        pipeline = pipeline.avif({ quality });
        break;
      case "jpeg":
        pipeline = pipeline.flatten({ background: "#ffffff" }).jpeg({ quality });
        break;
      case "png":
        pipeline = pipeline.png({ compressionLevel: Math.round((100 - quality) / 11) });
        break;
      case "tiff":
        pipeline = pipeline.tiff({ quality });
        break;
    }

    const outputBuffer = await pipeline.toBuffer();
    const ext = format === "jpg" ? "jpg" : format === "jfif" ? "jfif" : format;
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const outputName = `${baseName}.${ext}`;

    const mimeMap: Record<string, string> = {
      webp: "image/webp",
      avif: "image/avif",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      png: "image/png",
      jfif: "image/jpeg",
      bmp: "image/png",
      tiff: "image/tiff",
    };

    const responseBody = new Uint8Array(outputBuffer);

    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": mimeMap[format] || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${outputName}"`,
        "X-Output-Filename": outputName,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
