"use client";

import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { SafeImage } from "@/components/SafeImage";
import type { Category, CatalogProduct, Company } from "@/types";

type PublicCatalogProps = {
  company: Pick<Company, "name" | "slug" | "paid_until">;
  categories: Category[];
  products: CatalogProduct[];
};

export function PublicCatalog({ company, categories, products }: PublicCatalogProps) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      const categoryMatched = categoryId === "all" || product.category_id === categoryId;
      if (!categoryMatched) return false;
      if (!normalizedQuery) return true;
      const category = categories.find((item) => item.id === product.category_id);

      return [product.product_code, product.name, product.specification, product.description, category?.name, category?.code]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [categories, categoryId, products, query]);

  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <div className="catalog-company">
          <span className="catalog-mark">{company.name.slice(0, 1)}</span>
          <div>
            <h1>{company.name}</h1>
            <p>产品册</p>
          </div>
        </div>
      </header>

      <section className="catalog-tools">
        <label className="catalog-search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、规格、编号" />
        </label>
        <button className="catalog-filter" type="button" aria-label="筛选">
          <SlidersHorizontal size={17} />
        </button>
        <nav className="category-tabs" aria-label="产品分类">
          <button className={categoryId === "all" ? "active" : ""} type="button" onClick={() => setCategoryId("all")}>
            全部
          </button>
          {categories.map((category) => (
            <button
              className={categoryId === category.id ? "active" : ""}
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </nav>
      </section>

      <section className="catalog-count">
        <span>{visibleProducts.length} 个产品</span>
        <span>仅展示产品信息，无在线下单</span>
      </section>

      {visibleProducts.length > 0 ? (
        <section className="product-grid" aria-label="产品列表">
          {visibleProducts.map((product) => (
            <Link className="product-card" href={`/${company.slug}/浏览页/p/${product.product_code}`} key={product.id}>
              <div className="product-image">
                <SafeImage src={product.image_url} alt={product.name} sizes="(max-width: 720px) 50vw, 220px" />
              </div>
              <div className="product-card-body">
                <span className="product-code">{product.product_code}</span>
                <h2>{product.name}</h2>
                <p>{product.specification || "规格待确认"}</p>
                {product.unit_price !== null ? <strong>{formatPrice(product.unit_price)}</strong> : <em>询价</em>}
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <div className="catalog-empty">没有匹配的产品。</div>
      )}
    </main>
  );
}
