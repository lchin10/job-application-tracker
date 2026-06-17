import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base must match the GitHub Pages repo path: https://<user>.github.io/job-application-tracker/
export default defineConfig({
  plugins: [react()],
  base: "/job-application-tracker/",
});
