"use client";

export type CompressedProductImage = {
  file: File;
  width: number;
  height: number;
};

export async function compressProductImage(file: File): Promise<CompressedProductImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件。");
  }

  if (file.size > 25 * 1024 * 1024) {
    throw new Error("原图不能超过 25MB，请先在手机相册中适当裁剪。");
  }

  const bitmap = await createImageBitmap(file);

  try {
    const maxEdge = 960;
    const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器不支持图片压缩。");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) resolve(nextBlob);
        else reject(new Error("图片压缩失败。"));
      }, "image/webp", 0.74);
    });

    const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "product";
    const compressedFile = new File([blob], `${baseName}.webp`, { type: "image/webp" });
    return { file: compressedFile, width, height };
  } finally {
    bitmap.close();
  }
}

export function uploadProductImageToR2(
  signedUrl: string,
  file: File,
  onProgress: (percent: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("Cache-Control", "public, max-age=31536000, immutable");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("图片上传失败：无法连接图片存储，请检查网络后重试。"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("图片上传失败：图片存储拒绝了本次上传。"));
    };
    xhr.send(file);
  });
}
