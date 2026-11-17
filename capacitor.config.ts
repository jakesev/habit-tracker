import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jakesev.routine",
  appName: "Ember",
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
      iconColor: "#ff6a2b",
    },
  },
};

export default config;
