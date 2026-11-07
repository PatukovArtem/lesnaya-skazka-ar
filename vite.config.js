import { defineConfig } from 'vite';

// Relative asset paths let the same build work at both a GitHub Pages project URL
// and a custom domain.
export default defineConfig({
  base: './',
});
