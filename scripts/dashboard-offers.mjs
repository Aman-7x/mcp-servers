// Read-only dashboard offers from the checkout's canonical product catalogue.
import { PRODUCTS, PRODUCT_ALIASES } from '../billing/src/index.js';
import { FREE_IDS } from '../billing/src/figures.js';
const BUY_BASE = 'https://mcp.zovo.one/buy/';
const source = 'billing/src/index.js PRODUCTS/PRODUCT_ALIASES; billing/src/figures.js FREE_IDS';
const bundle = () => ({ product_id: 'bundle', price_usd: PRODUCTS.bundle.usd, url: `${BUY_BASE}bundle` });

export function offerForServer(id) {
  const direct = Object.hasOwn(PRODUCTS, id);
  const productId = direct ? id : PRODUCT_ALIASES[id];
  const product = productId && Object.hasOwn(PRODUCTS, productId) ? PRODUCTS[productId] : null;
  if (!direct && FREE_IDS.includes(id)) {
    return { kind: 'free', price_usd: 0, product_id: null, url: null,
      label: 'Free; no separate Pro', optional_bundle: bundle(), source };
  }
  if (!product) return { kind: 'unmeasured', price_usd: null, product_id: null, url: null, label: 'No canonical offer', source };
  const kind = productId === 'bundle' ? 'bundle' : 'single';
  return { kind, price_usd: product.usd, product_id: productId, url: `${BUY_BASE}${productId}`,
    label: kind === 'bundle' ? `Estate bundle $${product.usd}` : `Pro $${product.usd}`, source };
}

export function canonicalProducts() {
  return Object.keys(PRODUCTS).map(id => ({ id, name: PRODUCTS[id].name, ...offerForServer(id) }));
}
