import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Yerel canlı provası (npm run prova) geliştirme sunucusunun .next klasörüne
  // dokunmasın diye derlemeyi ayrı klasöre yazabilir.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
