import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jakesev.routine",
  appName: "Shugyo",
  webDir: "dist",
  backgroundColor: "#08080a",
  android: {
    backgroundColor: "#08080a",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      style: "DARK",
      initialViewportFitValueHint: "cover",
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#f0502e",
    },
  },
};

export default config;
