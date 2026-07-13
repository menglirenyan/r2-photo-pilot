import type { AdminSnapshot, Category, Company, Product, PublicCatalog, ShipmentSheet } from "@/types";
import { isCompanyAccessible } from "@/lib/format";

const now = new Date().toISOString();
const paidUntil = "2027-07-06";

export const sampleCompany: Company = {
  id: "00000000-0000-0000-0000-000000000001",
  company_number: 1,
  name: "华悟样品厂",
  slug: "demo-catalog",
  login_username: "demo",
  status: "active",
  paid_until: paidUntil,
  contact_name: "站点运营",
  contact_note: "演示企业，后台可替换为真实企业。",
  public_contact_phone: "138 0000 0000",
  created_at: now,
  updated_at: now
};

export const sampleCategories: Category[] = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    company_id: sampleCompany.id,
    name: "五金配件",
    code: "HW",
    sort_order: 10,
    created_at: now
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    company_id: sampleCompany.id,
    name: "包装材料",
    code: "BZ",
    sort_order: 20,
    created_at: now
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    company_id: sampleCompany.id,
    name: "陶瓷样品",
    code: "TC",
    sort_order: 30,
    created_at: now
  }
];

const images = [
  "/demo-products/hardware.svg",
  "/demo-products/hardware.svg",
  "/demo-products/packaging.svg",
  "/demo-products/packaging.svg",
  "/demo-products/ceramics.svg",
  "/demo-products/ceramics.svg",
  "/demo-products/hardware.svg",
  "/demo-products/packaging.svg"
];

export const sampleProducts: Product[] = [
  ["HW-001", "不锈钢连接件", "304 / 28mm", 3.8, "适合样品架、展示件和轻型结构连接。", sampleCategories[0]],
  ["HW-002", "黑色调节脚", "M8 / 35mm", 1.6, "底部防滑，适合设备脚垫和货架调平。", sampleCategories[0]],
  ["BZ-001", "透明吸塑托盘", "12 格 / 0.6mm", 0.42, "用于小件产品陈列和批量包装。", sampleCategories[1]],
  ["BZ-002", "牛皮纸天地盖", "160x90x35mm", null, "可定制贴标，适合礼品和样品发货。", sampleCategories[1]],
  ["TC-001", "哑光白瓷片", "80x80mm", 2.5, "表面细腻，适合色卡和材质样本。", sampleCategories[2]],
  ["TC-002", "釉面圆形杯垫", "直径 95mm", null, "支持图案定制，样品单独报价。", sampleCategories[2]],
  ["HW-003", "铝合金把手", "96 孔距", 4.2, "轻量化表面拉丝，常用于箱体与柜门。", sampleCategories[0]],
  ["BZ-003", "白色珍珠棉内衬", "20mm", 0.85, "按图开槽，适合易碎件保护。", sampleCategories[1]]
].map((item, index) => {
  const [productCode, name, specification, unitPrice, description, category] = item;
  const typedCategory = category as Category;

  return {
    id: `00000000-0000-0000-0000-00000000020${index}`,
    company_id: sampleCompany.id,
    category_id: typedCategory.id,
    product_number: Number(String(productCode).split("-")[1]),
    product_code: String(productCode),
    name: String(name),
    specification: String(specification),
    unit_price: unitPrice as number | null,
    description: String(description),
    image_url: images[index],
    object_key: `sample/${String(productCode).toLowerCase()}.svg`,
    image_width: 640,
    image_height: 460,
    status: "active",
    sort_order: index + 1,
    created_at: now,
    updated_at: now,
    categories: {
      id: typedCategory.id,
      name: typedCategory.name,
      code: typedCategory.code
    }
  };
});

export const sampleShipmentSheets: ShipmentSheet[] = [
  {
    id: "00000000-0000-0000-0000-000000000301",
    company_id: sampleCompany.id,
    title: "样品历史单据",
    customer_name: "演示客户",
    note: "本地无 Supabase 环境时显示的示例记录。",
    total_price: 28.4,
    created_at: now
  }
];

export function getSampleCatalog(slug = sampleCompany.slug): PublicCatalog | null {
  if (slug !== sampleCompany.slug) return null;

  return {
    company: sampleCompany,
    categories: sampleCategories,
    products: sampleProducts,
    isAccessible: isCompanyAccessible(sampleCompany.status, sampleCompany.paid_until)
  };
}

export function getSampleAdminSnapshot(): AdminSnapshot {
  return {
    companies: [sampleCompany],
    categories: sampleCategories,
    products: sampleProducts,
    shipmentSheets: sampleShipmentSheets,
    configured: false
  };
}
