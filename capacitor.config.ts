import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "id.kebayaoma.pos",
  appName: "Kebaya Oma POS",
  webDir: ".next",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#F2F5E2",
      showSpinner: false,
    },
  },
};

export default config;
