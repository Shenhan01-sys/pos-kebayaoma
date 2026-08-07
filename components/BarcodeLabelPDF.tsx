import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

interface LabelData {
  productName: string;
  size: string;
  price: number;
  barcode: string;
}

interface BarcodeLabelPDFProps {
  labels: LabelData[];
}

export function BarcodeLabelPDF({ labels }: BarcodeLabelPDFProps) {
  // Generate barcode as base64 (simplified - in real app, use JsBarcode to generate image)
  // For now, we'll use a placeholder
  const barcodeImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; // Placeholder 1x1 pixel

  return (
    <Document>
      <Page size={[60, 30]} style={styles.page}> {/* 60x30mm */}
        {labels.map((label, index) => (
          <View key={index} style={styles.label}>
            {/* Barcode (placeholder) */}
            <View style={styles.barcodeContainer}>
              <Image style={styles.barcode} src={barcodeImage} />
              <Text style={styles.barcodeText}>{label.barcode}</Text>
            </View>
            
            {/* Product Info */}
            <View style={styles.infoContainer}>
              <Text style={styles.productName}>{label.productName}</Text>
              <Text style={styles.variantInfo}>Size: {label.size}</Text>
              <Text style={styles.price}>Rp {label.price.toLocaleString("id-ID")}</Text>
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 5,
  },
  label: {
    width: 60,
    height: 30,
    border: "1pt solid #ccc",
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    margin: 2,
  },
  barcodeContainer: {
    flex: 1,
    alignItems: "center",
  },
  barcode: {
    width: "100%",
    height: 15,
  },
  barcodeText: {
    fontSize: 6,
    marginTop: 1,
  },
  infoContainer: {
    width: 25,
    textAlign: "right",
    paddingLeft: 5,
  },
  productName: {
    fontSize: 7,
    fontWeight: "bold",
  },
  variantInfo: {
    fontSize: 6,
    color: "#666",
  },
  price: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#775533",
    marginTop: 1,
  },
});
