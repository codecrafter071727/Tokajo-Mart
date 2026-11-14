import { createHmac, timingSafeEqual } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type InvoiceData = {
  orderNumber: string;
  deliveredAt: Date;
  placedAt: Date;
  customerName: string;
  customerPhone: string;
  addressLines: string[];
  storeName: string;
  items: {
    name: string;
    unit: string;
    quantity: number;
    unitPricePaise: number;
    mrpPaise: number;
  }[];
  itemTotalPaise: number;
  discountPaise: number;
  couponCode: string | null;
  deliveryFeePaise: number;
  handlingFeePaise: number;
  tipPaise: number;
  totalPaise: number;
  paymentMethod: "cod" | "online";
  razorpayPaymentId: string | null;
};

/** "QC-261113-00008" becomes "INV-261113-00008": one invoice per order, easy to match up. */
export const invoiceNumber = (orderNumber: string) => orderNumber.replace(/^QC-/, "INV-");

/**
 * The standard PDF fonts only know the Windows Latin set, so the rupee sign and Indian scripts
 * cannot be drawn. Money is written as "Rs." and any character the font cannot show becomes "?",
 * so a name in Hindi never breaks the invoice.
 */
// Written as escapes so no invisible or special character sits in the source
const RUPEE = new RegExp("\\u20B9", "g");
const DASHES = new RegExp("[\\u2013\\u2014]", "g");
const SINGLE_QUOTES = new RegExp("[\\u2018\\u2019]", "g");
const DOUBLE_QUOTES = new RegExp("[\\u201C\\u201D]", "g");
const THIN_SPACES = new RegExp("[\\u202F\\u2009\\u2007]", "g");
const NOT_WIN_ANSI = new RegExp("[^\\x20-\\x7E\\xA0-\\xFF]", "g");

export function pdfSafe(text: string): string {
  return text
    .replace(RUPEE, "Rs.")
    .replace(DASHES, "-")
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(THIN_SPACES, " ")
    .replace(NOT_WIN_ANSI, "?");
}

export const rupees = (paise: number) => {
  const value = (paise / 100).toFixed(2);
  const [whole, decimals] = value.split(".") as [string, string];
  // Indian grouping: 1,23,456.00
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return `Rs. ${grouped}.${decimals}`;
};

const IST = (d: Date) =>
  d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// Brand green #42C86E and its dark text, matching the apps
const GREEN = rgb(0x42 / 255, 0xc8 / 255, 0x6e / 255);
const GREEN_SOFT = rgb(0xf1 / 255, 0xfc / 255, 0xf5 / 255);
const INK = rgb(0x14 / 255, 0x20 / 255, 0x1e / 255);
const MUTED = rgb(0x6b / 255, 0x7a / 255, 0x77 / 255);
const LINE = rgb(0xdd / 255, 0xe5 / 255, 0xe3 / 255);

const A4 = { width: 595.28, height: 841.89 };
const M = 48;

/** Cuts text to fit a width, ending with "..." when it had to shorten it. */
function fit(font: PDFFont, text: string, size: number, width: number): string {
  const safe = pdfSafe(text);
  if (font.widthOfTextAtSize(safe, size) <= width) return safe;
  let out = safe;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > width)
    out = out.slice(0, -1);
  return `${out}...`;
}

export async function renderInvoice(data: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Milcki invoice ${invoiceNumber(data.orderNumber)}`);
  pdf.setAuthor("Milcki");
  pdf.setCreator("Milcki");
  pdf.setCreationDate(data.deliveredAt);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([A4.width, A4.height]);
  let y = A4.height;

  const text = (
    value: string,
    x: number,
    at: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {},
  ) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? regular;
    const safe = pdfSafe(value);
    const drawX = opts.right ? x - font.widthOfTextAtSize(safe, size) : x;
    page.drawText(safe, { x: drawX, y: at, size, font, color: opts.color ?? INK });
  };

  // Header band
  page.drawRectangle({ x: 0, y: A4.height - 96, width: A4.width, height: 96, color: GREEN });
  text("Milcki", M, A4.height - 52, { size: 24, font: bold });
  text("Groceries in minutes", M, A4.height - 72, { size: 10 });
  text("INVOICE", A4.width - M, A4.height - 52, { size: 18, font: bold, right: true });
  text(invoiceNumber(data.orderNumber), A4.width - M, A4.height - 72, { size: 10, right: true });
  y = A4.height - 130;

  // Order facts and billed to
  const col2 = A4.width / 2 + 10;
  text("BILLED TO", M, y, { size: 8, font: bold, color: MUTED });
  text("ORDER", col2, y, { size: 8, font: bold, color: MUTED });
  y -= 16;
  const left = [data.customerName || "Customer", ...data.addressLines, data.customerPhone].filter(
    Boolean,
  );
  const right = [
    `Order ${data.orderNumber}`,
    `Placed ${IST(data.placedAt)}`,
    `Delivered ${IST(data.deliveredAt)}`,
    `Sold by ${data.storeName}`,
  ];
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if (left[i])
      text(fit(regular, left[i] as string, 10, col2 - M - 16), M, y, {
        font: i === 0 ? bold : regular,
      });
    if (right[i]) text(fit(regular, right[i] as string, 10, A4.width - M - col2), col2, y);
    y -= 15;
  }
  y -= 14;

  // Items table
  const cols = { qty: 330, unit: 400, mrp: 465, amount: A4.width - M };
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: A4.width - 2 * M, height: 22, color: GREEN_SOFT });
    text("Item", M + 8, y, { size: 9, font: bold });
    text("Qty", cols.qty, y, { size: 9, font: bold, right: true });
    text("Price", cols.unit, y, { size: 9, font: bold, right: true });
    text("MRP", cols.mrp, y, { size: 9, font: bold, right: true });
    text("Amount", cols.amount - 8, y, { size: 9, font: bold, right: true });
    y -= 26;
  };
  header();
  for (const item of data.items) {
    if (y < 140) {
      page = pdf.addPage([A4.width, A4.height]);
      y = A4.height - M;
      header();
    }
    text(fit(regular, item.name, 10, cols.qty - M - 60), M + 8, y, { size: 10 });
    text(fit(regular, item.unit, 8, cols.qty - M - 60), M + 8, y - 11, { size: 8, color: MUTED });
    text(String(item.quantity), cols.qty, y, { right: true });
    text(rupees(item.unitPricePaise), cols.unit, y, { right: true });
    text(item.mrpPaise > item.unitPricePaise ? rupees(item.mrpPaise) : "", cols.mrp, y, {
      right: true,
      color: MUTED,
    });
    text(rupees(item.unitPricePaise * item.quantity), cols.amount - 8, y, { right: true });
    y -= 28;
    page.drawLine({
      start: { x: M, y: y + 12 },
      end: { x: A4.width - M, y: y + 12 },
      color: LINE,
      thickness: 0.5,
    });
  }

  // Totals
  if (y < 230) {
    page = pdf.addPage([A4.width, A4.height]);
    y = A4.height - M;
  }
  y -= 6;
  const labelX = A4.width - M - 220;
  const row = (label: string, value: string, strong = false) => {
    text(label, labelX, y, { font: strong ? bold : regular, size: strong ? 12 : 10 });
    text(value, A4.width - M - 8, y, {
      font: strong ? bold : regular,
      size: strong ? 12 : 10,
      right: true,
    });
    y -= strong ? 22 : 16;
  };
  row("Item total", rupees(data.itemTotalPaise));
  if (data.discountPaise > 0) {
    row(
      data.couponCode ? `Discount (${data.couponCode})` : "Discount",
      `- ${rupees(data.discountPaise)}`,
    );
  }
  row("Delivery fee", data.deliveryFeePaise > 0 ? rupees(data.deliveryFeePaise) : "Free");
  row("Handling fee", rupees(data.handlingFeePaise));
  if (data.tipPaise > 0) row("Rider tip", rupees(data.tipPaise));
  page.drawLine({
    start: { x: labelX, y: y + 8 },
    end: { x: A4.width - M, y: y + 8 },
    color: INK,
    thickness: 0.8,
  });
  y -= 6;
  row("Total paid", rupees(data.totalPaise), true);

  // Payment and notes
  y -= 8;
  text("PAYMENT", M, y, { size: 8, font: bold, color: MUTED });
  y -= 15;
  text(
    data.paymentMethod === "online"
      ? `Paid online${data.razorpayPaymentId ? ` (Razorpay ${data.razorpayPaymentId})` : ""}`
      : "Cash on delivery",
    M,
    y,
  );
  y -= 28;
  text("Prices are inclusive of all taxes.", M, y, { size: 9, color: MUTED });
  y -= 13;
  text("This is a computer generated invoice and needs no signature.", M, y, {
    size: 9,
    color: MUTED,
  });

  for (const p of pdf.getPages()) {
    p.drawText(pdfSafe("Thank you for shopping with Milcki"), {
      x: M,
      y: 32,
      size: 9,
      font: regular,
      color: MUTED,
    });
  }
  return pdf.save();
}

// --- Short lived links, so a phone can open the PDF in its browser without a token -----------

const LINK_TTL_SECONDS = 10 * 60;

const mac = (secret: string, payload: string) =>
  createHmac("sha256", `invoice-link|${secret}`).update(payload).digest("base64url");

/** A link token that opens one order's invoice for 10 minutes. */
export function signInvoiceToken(secret: string, orderId: string, now: Date) {
  const expires = Math.floor(now.getTime() / 1000) + LINK_TTL_SECONDS;
  const payload = `${orderId}.${expires}`;
  return { token: `${payload}.${mac(secret, payload)}`, expiresAt: new Date(expires * 1000) };
}

/** The order id the token opens, or null when it is forged, malformed or expired. */
export function readInvoiceToken(secret: string, token: string, now: Date): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [orderId, expires, signature] = parts as [string, string, string];
  if (!/^[0-9a-f-]{36}$/.test(orderId) || !/^\d{9,11}$/.test(expires)) return null;
  const expected = Buffer.from(mac(secret, `${orderId}.${expires}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expires) * 1000 < now.getTime()) return null;
  return orderId;
}
