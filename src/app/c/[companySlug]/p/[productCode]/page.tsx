import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeDollarSign, Boxes, Ruler } from "lucide-react";
import { notFound } from "next/navigation";
import { SafeImage } from "@/components/SafeImage";
import { getProductDetail } from "@/lib/data";
import { formatPrice } from "@/lib/format";

export const revalidate = 300;
export const dynamic = "force-static";

type PageProps = {
  params: Promise<{ companySlug: string; productCode: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { companySlug, productCode } = await params;
  const detail = await getProductDetail(companySlug, productCode);

  return {
    title: detail?.product ? `${detail.product.name} · ${detail.company.name}` : "产品不存在",
    description: detail?.product?.description || detail?.product?.specification || "产品详情"
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { companySlug, productCode } = await params;
  const detail = await getProductDetail(companySlug, productCode);

  if (!detail || !detail.product) notFound();

  const { company, product } = detail;

  return (
    <main className="detail-page">
      <header className="detail-topbar">
        <Link className="back-link" href={`/c/${company.slug}`}>
          <ArrowLeft size={17} />
          返回产品册
        </Link>
        <span>{company.name}</span>
      </header>
      <section className="detail-layout">
        <div className="detail-image">
          <SafeImage src={product.image_url} alt={product.name} priority sizes="(max-width: 800px) 100vw, 60vw" />
        </div>
        <article className="detail-info">
          <span className="product-code">{product.product_code}</span>
          <h1>{product.name}</h1>
          <dl>
            <div>
              <dt><Boxes size={15} />分类</dt>
              <dd>{product.categories?.name || "未分类"}</dd>
            </div>
            <div>
              <dt><Ruler size={15} />规格</dt>
              <dd>{product.specification || "待确认"}</dd>
            </div>
            <div>
              <dt><BadgeDollarSign size={15} />单价</dt>
              <dd className="detail-price">{product.unit_price !== null ? formatPrice(product.unit_price) : null}</dd>
            </div>
          </dl>
          <section className="detail-description">
            <h2>产品说明</h2>
            <p>{product.description || "暂无描述。"}</p>
          </section>
          <footer>产品信息仅供参考，具体规格与价格请线下确认。</footer>
        </article>
      </section>
    </main>
  );
}
