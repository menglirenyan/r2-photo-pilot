"use client";

import { Fragment, ReactNode, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { SafeImage } from "@/components/SafeImage";
import { formatPrice } from "@/lib/format";
import type { CatalogProduct, Category, Company, ProductStatus } from "@/types";

export type CatalogListProduct = CatalogProduct & {
  status?: ProductStatus;
};

type ProductCatalogViewProps = {
  asMain?: boolean;
  categories: Category[];
  company: Pick<Company, "name" | "slug">;
  countNote?: string;
  emptyText?: string;
  products: CatalogListProduct[];
  renderProduct: (product: CatalogListProduct, index: number) => ReactNode;
};

export function ProductCardContent({ product, priority = false }: { product: CatalogListProduct; priority?: boolean }) {
  return (
    <>
      <div className="product-image">
        <SafeImage
          src={product.image_url}
          alt={product.name}
          priority={priority}
          sizes="(max-width: 720px) 50vw, 220px"
        />
      </div>
      <div className="product-card-body">
        <h2>{product.name}</h2>
        <span className="product-code">{product.product_code}</span>
        <p>{product.specification || "规格待确认"}</p>
        {product.unit_price !== null ? <strong>{formatPrice(product.unit_price)}</strong> : null}
      </div>
    </>
  );
}

export function ProductCatalogView({
  asMain = false,
  categories,
  company,
  countNote,
  emptyText = "没有匹配的产品。",
  products,
  renderProduct
}: ProductCatalogViewProps) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const Wrapper: "main" | "section" = asMain ? "main" : "section";

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId]
  );

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
    <Wrapper className={asMain ? "catalog-page" : "catalog-page catalog-embedded"}>
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
        <button
          aria-controls="catalog-categories"
          aria-expanded={filtersOpen}
          aria-label={filtersOpen ? "收起产品分类" : "筛选产品分类"}
          className={filtersOpen ? "catalog-filter active" : "catalog-filter"}
          data-testid="catalog-filter-toggle"
          onClick={() => setFiltersOpen((current) => !current)}
          type="button"
        >
          <SlidersHorizontal size={17} />
          <span>分类</span>
        </button>
        <nav
          className={filtersOpen ? "category-tabs open" : "category-tabs"}
          id="catalog-categories"
          aria-label="产品分类"
        >
          <button
            className={categoryId === "all" ? "active" : ""}
            aria-pressed={categoryId === "all"}
            type="button"
            onClick={() => {
              setCategoryId("all");
            }}
          >
            全部
          </button>
          {categories.map((category) => (
            <button
              className={categoryId === category.id ? "active" : ""}
              aria-pressed={categoryId === category.id}
              key={category.id}
              type="button"
              onClick={() => {
                setCategoryId(category.id);
              }}
            >
              {category.name}
            </button>
          ))}
        </nav>
      </section>

      <section className="catalog-count" aria-live="polite">
        <span>
          {selectedCategory ? `${selectedCategory.name} · ` : ""}
          {visibleProducts.length} 个产品
        </span>
        {countNote ? <span>{countNote}</span> : null}
      </section>

      {visibleProducts.length > 0 ? (
        <section className="product-grid" aria-label="产品列表">
          {visibleProducts.map((product, index) => (
            <Fragment key={product.id}>{renderProduct(product, index)}</Fragment>
          ))}
        </section>
      ) : (
        <div className="catalog-empty">
          <strong>{emptyText}</strong>
          <span>可更换关键词或产品分类后重试。</span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategoryId("all");
              setFiltersOpen(false);
            }}
          >
            清除筛选
          </button>
        </div>
      )}
    </Wrapper>
  );
}
