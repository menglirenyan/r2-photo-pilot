import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createR2Client, getMaxUploadBytes, getR2Config } from "@/lib/r2";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function sanitizeFileName(fileName: string) {
  const clean = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return clean || "photo.jpg";
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "未登录后台，不能上传图片。" }, { status: 401 });
  }

  const config = getR2Config();
  const maxUploadBytes = getMaxUploadBytes();

  if (!config) {
    return NextResponse.json(
      {
        error: "R2 is not configured. Fill R2_* environment variables to enable real uploads.",
        code: "NOT_CONFIGURED"
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as {
    fileName?: string;
    contentType?: string;
    size?: number;
    companyId?: string;
  };

  const fileName = body.fileName ? sanitizeFileName(body.fileName) : "photo.jpg";
  const contentType = body.contentType || "application/octet-stream";
  const size = Number(body.size || 0);
  const companyId = (body.companyId || "unknown").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80);

  if (!allowedTypes.has(contentType)) {
    return NextResponse.json({ error: "仅支持 jpg、png、webp 图片。" }, { status: 400 });
  }

  if (!Number.isFinite(size) || size <= 0 || size > maxUploadBytes) {
    return NextResponse.json(
      { error: `Image must be smaller than ${Math.round(maxUploadBytes / 1024 / 1024)}MB.` },
      { status: 400 }
    );
  }

  const datePrefix = new Date().toISOString().slice(0, 10);
  const objectKey = `companies/${companyId}/products/${datePrefix}/${crypto.randomUUID()}-${fileName}`;
  const client = createR2Client(config);

  const signedUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      ContentType: contentType
    }),
    { expiresIn: 300 }
  );

  return NextResponse.json({
    signedUrl,
    publicUrl: `${config.publicBaseUrl}/${objectKey}`,
    objectKey,
    maxUploadBytes
  });
}
