import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { SafeImage } from "@/components/SafeImage";
import { getProductDetail } from "@/lib/data";
import { formatPrice } from "@/lib/format";

type PageProps = {
  params: Promise<{ companySlug: string; productCode: string }>;
};

export default async function ProductDetailPage({ params }: PageProps) {
  const { companySlug, productCode } = await params;
  const detail = await getProductDetail(companySlug, productCode);

  if (!detail || !detail.product) notFound();

  const { catalog, product } = detail;
  const category = catalog.categories.find((item) => item.id === product.category_id);

  return (
    <main className="detail-page">
      <Link className="back-link" href={`/${catalog.company.slug}/浏览页`}>
        <ArrowLeft size={17} />
        返回产品册
      </Link>
      <section className="detail-layout">
        <div className="detail-image">
          <SafeImage src={product.image_url} alt={product.name} priority sizes="(max-width: 800px) 100vw, 50vw" />
        </div>
        <article className="detail-info">
          <span className="product-code">{product.product_code}</span>
          <h1>{product.name}</h1>
          <dl>
            <div>
              <dt>分类</dt>
              <dd>{category?.name || "未分类"}</dd>
            </div>
            <div>
              <dt>规格</dt>
              <dd>{product.specification || "待确认"}</dd>
            </div>
            <div>
              <dt>单价</dt>
              <dd>{product.unit_price !== null ? formatPrice(product.unit_price) : "询价"}</dd>
            </div>
          </dl>
          <p>{product.description || "暂无描述。"}</p>
        </article>
      </section>
    </main>
  );
}
