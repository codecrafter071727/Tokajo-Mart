import React, { useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from "../../src/theme";
import { AddButton } from "../../src/components/AddButton";
import { ProductCard } from "../../src/components/ProductCard";
import { isNotFound, useProduct, useProducts, useStock } from "../../src/lib/queries";
import { ErrorState } from "../../src/components/StateViews";
import { Skeleton } from "../../src/components/Skeleton";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { ImageGallery } from "../../src/components/product/ImageGallery";
import { VariantChips } from "../../src/components/product/VariantChips";

const { width: SCREEN_W } = Dimensions.get("window");
const GALLERY_SIZE = Math.min(SCREEN_W * 0.82, 360);

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const productQuery = useProduct(id);
  const product = productQuery.data;
  const stock = useStock(id ?? "");
  const similarQuery = useProducts(
    { categoryId: product?.categoryId, limit: 8 },
    { enabled: product !== undefined },
  );
  const similarProducts = (similarQuery.data ?? []).filter((p) => p.id !== product?.id).slice(0, 6);

  if (!product) {
    const missing = productQuery.isError && isNotFound(productQuery.error);
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScreenHeader title="" />
        {productQuery.isPending ? (
          <View style={styles.loadingBox}>
            <Skeleton
              style={{ width: SCREEN_W * 0.7, aspectRatio: 1, height: undefined }}
              borderRadius={Radius.lg}
            />
            <Skeleton width={SCREEN_W * 0.6} height={20} />
            <Skeleton width={SCREEN_W * 0.3} height={14} />
            <Skeleton width={SCREEN_W * 0.25} height={24} />
          </View>
        ) : productQuery.isError && !missing ? (
          <ErrorState
            error={productQuery.error}
            title="Could not load this product"
            onRetry={() => void productQuery.refetch()}
          />
        ) : (
          <View style={styles.notFound}>
            <Ionicons name="search-outline" size={56} color={Colors.border} />
            <Text style={styles.notFoundText}>We could not find that product</Text>
            <Pressable style={styles.backHome} onPress={() => router.replace("/(tabs)")}>
              <Text style={styles.backHomeText}>Back to home</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  const savings = product.mrp - product.price;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={product.name}
        right={
          <Pressable
            onPress={() =>
              void Share.share({
                message: `${product.name} (${product.unit}) for ₹${product.price} on Tokajo Mart`,
              }).catch(() => undefined)
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share"
          >
            <Ionicons name="share-social-outline" size={22} color={Colors.textPrimary} />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Image section */}
        <View style={styles.imageSection}>
          {product.discount ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{product.discount}% OFF</Text>
            </View>
          ) : null}

          <View style={styles.deliveryPill}>
            <Text style={styles.deliveryPillText}>{product.deliveryMins ?? 10} MINS</Text>
          </View>

          <ImageGallery
            key={product.id}
            images={product.images}
            emoji={product.image}
            fit={product.imageFit}
            size={GALLERY_SIZE}
          />
        </View>

        {/* Product info */}
        <View style={styles.infoCard}>
          {product.brand ? (
            <Pressable
              onPress={() => router.push({ pathname: "/search", params: { q: product.brand } })}
              accessibilityRole="link"
              accessibilityLabel={`More from ${product.brand}`}
              hitSlop={6}
            >
              <Text style={styles.brand}>
                {product.brand} <Ionicons name="chevron-forward" size={11} />
              </Text>
            </Pressable>
          ) : null}
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.unit}>{product.unit}</Text>
          <VariantChips
            variants={product.variants}
            selectedId={product.id}
            onSelect={(variantId) => router.setParams({ id: variantId })}
          />
          {product.tags?.length ? (
            <View style={styles.tagRow}>
              {product.tags.slice(0, 6).map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.priceBlock}>
            <View style={styles.priceRow}>
              <Text style={styles.price}>₹{product.price}</Text>
              {product.mrp > product.price && <Text style={styles.mrp}>MRP ₹{product.mrp}</Text>}
              {savings > 0 && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsBadgeText}>Save ₹{savings}</Text>
                </View>
              )}
            </View>
            <Text style={styles.taxNote}>Inclusive of all taxes</Text>
            {stock?.status === "out" ? (
              <View style={[styles.stockNote, styles.stockOut]}>
                <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                <Text style={[styles.stockNoteText, { color: Colors.danger }]}>
                  Out of stock right now. Tap Notify me and we will tell you when it is back.
                </Text>
              </View>
            ) : stock?.status === "low" && stock.remaining !== null ? (
              <View style={[styles.stockNote, styles.stockLow]}>
                <Ionicons name="flame" size={14} color={Colors.warning} />
                <Text style={[styles.stockNoteText, { color: Colors.warning }]}>
                  Only {stock.remaining} left, order soon
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Product details */}
        <View style={styles.card}>
          <Pressable
            style={styles.accordionHeader}
            onPress={() => setDetailsExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsExpanded }}
          >
            <Text style={styles.accordionTitle}>Product details</Text>
            <Ionicons
              name={detailsExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={Colors.brandText}
            />
          </Pressable>
          {detailsExpanded ? (
            <View style={styles.accordionBody}>
              {product.description ? (
                <Text style={styles.accordionText}>{product.description}</Text>
              ) : null}
              {product.brand ? <DetailRow label="Brand" value={product.brand} /> : null}
              <DetailRow label="Pack size" value={product.unit} />
              <DetailRow
                label="Delivery"
                value={`In about ${product.deliveryMins ?? 10} minutes`}
              />
              <DetailRow label="Country of origin" value="India" />
              <DetailRow label="Return policy" value="Report damaged or wrong items at delivery" />
            </View>
          ) : null}
        </View>

        {/* Why shop from Tokajo Mart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Why shop from Tokajo Mart?</Text>
          <View style={styles.trustRow}>
            <Ionicons name="flash" size={22} color={Colors.brandText} />
            <View style={styles.trustText}>
              <Text style={styles.trustHeading}>Superfast 10-Minute Delivery</Text>
              <Text style={styles.trustSub}>
                Get your order delivered fresh to your doorstep in minutes.
              </Text>
            </View>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustRow}>
            <Ionicons name="pricetag" size={22} color={Colors.brandText} />
            <View style={styles.trustText}>
              <Text style={styles.trustHeading}>Best Prices & Deals</Text>
              <Text style={styles.trustSub}>
                Direct warehouse sourcing brings you lowest everyday prices.
              </Text>
            </View>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark" size={22} color={Colors.brandText} />
            <View style={styles.trustText}>
              <Text style={styles.trustHeading}>100% Fresh & Authentic</Text>
              <Text style={styles.trustSub}>
                Strict quality checks and hygienic packaging guaranteed.
              </Text>
            </View>
          </View>
        </View>

        {/* Similar products */}
        {similarProducts.length > 0 && (
          <View style={styles.similarSection}>
            <Text style={styles.similarTitle}>Similar products</Text>
            <FlatList
              data={similarProducts}
              keyExtractor={(p) => p.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarList}
              ItemSeparatorComponent={() => <View style={{ width: Spacing[8] }} />}
              renderItem={({ item }) => (
                <View style={{ width: 144 }}>
                  <ProductCard product={item} />
                </View>
              )}
            />
          </View>
        )}
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing[8] }]}>
        <View style={styles.bottomPriceBlock}>
          <View style={styles.bottomPriceRow}>
            <Text style={styles.bottomPrice}>₹{product.price}</Text>
            {product.mrp > product.price && <Text style={styles.bottomMrp}>₹{product.mrp}</Text>}
          </View>
          {savings > 0 ? (
            <Text style={styles.bottomSavingsText}>You save ₹{savings}</Text>
          ) : (
            <Text style={styles.bottomTaxNote}>Inclusive of all taxes</Text>
          )}
        </View>
        <AddButton productId={product.id} productData={product} size="lg" />
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  detailRow: { gap: 2, marginTop: Spacing[8] },
  stockNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing[10],
    paddingHorizontal: Spacing[10],
    paddingVertical: Spacing[8],
    borderRadius: Radius.sm,
  },
  stockOut: { backgroundColor: "#FDF1F1" },
  stockLow: { backgroundColor: "#FFF4E5" },
  stockNoteText: { flex: 1, fontSize: FontSize.caption, fontWeight: "700" },
  detailLabel: { fontSize: FontSize.caption, fontWeight: "700", color: Colors.textTertiary },
  detailValue: { fontSize: FontSize.body, color: Colors.textPrimary },
  loadingBox: {
    alignItems: "center",
    gap: Spacing[12],
    paddingTop: Spacing[24],
  },
  backHome: {
    marginTop: Spacing[12],
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[20],
    paddingVertical: Spacing[10],
  },
  backHomeText: {
    fontSize: FontSize.body,
    fontWeight: "800",
    color: Colors.onBrand,
  },
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing[8],
  },
  backBtn: {
    padding: Spacing[4],
  },
  backBtnText: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
  },
  shareBtn: {
    padding: Spacing[4],
  },
  shareBtnText: {
    fontSize: 20,
    color: Colors.textSecondary,
  },

  scroll: { flex: 1 },
  scrollContent: {
    gap: Spacing[12],
    padding: Spacing[12],
  },

  // Image section
  // Edge to edge hero: cancels the scroll content padding so the photo runs to the screen edges
  imageSection: {
    backgroundColor: Colors.surface,
    marginHorizontal: -Spacing[12],
    marginTop: -Spacing[12],
    paddingVertical: Spacing[16],
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    position: "relative",
  },
  discountBadge: {
    position: "absolute",
    zIndex: 2,
    top: 12,
    left: 16,
    backgroundColor: Colors.brandGreen,
    borderRadius: Radius.xs,
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
  },
  discountText: {
    fontSize: FontSize.caption,
    fontWeight: "800",
    color: Colors.onBrand,
  },
  deliveryPill: {
    position: "absolute",
    zIndex: 2,
    top: 12,
    right: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
  },
  deliveryPillText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.micro,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  imageArea: {
    width: Math.min(SCREEN_W * 0.82, 360),
    height: Math.min(SCREEN_W * 0.82, 360),
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  productEmoji: {
    fontSize: 120,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 5,
    marginTop: Spacing[8],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textTertiary,
  },
  dotActive: {
    backgroundColor: Colors.brandGreen,
    width: 18,
  },

  // Info card
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing[4],
  },
  brand: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandText,
    marginBottom: 2,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: Spacing[12] },
  tagPill: {
    backgroundColor: Colors.canvas,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[8],
    paddingVertical: 3,
  },
  tagText: { fontSize: 11, fontWeight: "600", color: Colors.textSecondary },
  productName: {
    fontSize: FontSize.h1,
    fontWeight: FontWeight.h1,
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  unit: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing[8],
  },
  priceBlock: {
    gap: Spacing[4],
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[8],
  },
  price: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  mrp: {
    fontSize: FontSize.body,
    color: Colors.textTertiary,
    textDecorationLine: "line-through",
  },
  savingsBadge: {
    backgroundColor: Colors.greenTint,
    borderRadius: Radius.xs,
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[2],
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  savingsBadgeText: {
    fontSize: FontSize.caption,
    fontWeight: "700",
    color: Colors.brandText,
  },
  taxNote: {
    fontSize: 11,
    color: Colors.textTertiary,
  },

  // Generic card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing[16],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing[12],
  },

  // Accordion
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accordionTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.h2,
    color: Colors.brandText,
  },
  accordionChevron: {
    fontSize: 18,
    color: Colors.textSecondary,
  },
  accordionBody: {
    marginTop: Spacing[12],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing[12],
  },
  accordionText: {
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Highlights
  highlightRow: {
    flexDirection: "row",
    gap: Spacing[8],
    marginBottom: Spacing[8],
  },
  highlightDot: {
    fontSize: FontSize.body,
    fontWeight: "700",
    color: Colors.brandText,
    width: 18,
  },
  highlightText: {
    flex: 1,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Similar products
  similarSection: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingTop: Spacing[16],
    paddingBottom: Spacing[12],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  similarTitle: {
    fontSize: FontSize.h2,
    fontWeight: FontWeight.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing[12],
    paddingHorizontal: Spacing[16],
  },
  similarList: {
    paddingHorizontal: Spacing[16],
    paddingBottom: 4,
  },

  // Trust section
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[12],
    paddingVertical: Spacing[6],
  },
  trustEmoji: {
    fontSize: 22,
  },
  trustText: {
    flex: 1,
  },
  trustHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  trustSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  trustDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing[4],
  },

  // Bottom bar
  bottomBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing[16],
    paddingTop: Spacing[10],
    ...Shadow.sticky,
  },
  bottomPriceBlock: {
    gap: 2,
  },
  bottomPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing[8],
  },
  bottomPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  bottomMrp: {
    fontSize: 13,
    color: Colors.textTertiary,
    textDecorationLine: "line-through",
  },
  bottomSavingsText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.brandText,
  },
  bottomTaxNote: {
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // Not found
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[12],
  },
  notFoundEmoji: {
    fontSize: 64,
  },
  notFoundText: {
    fontSize: FontSize.h2,
    color: Colors.textSecondary,
  },
});
