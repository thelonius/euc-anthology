import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  // GitHub Pages serves the site under /<repo-name>/, so all asset URLs
  // need that prefix. Local `npm run dev` and `npm run preview` stay on '/'.
  base: process.env.GITHUB_ACTIONS ? '/euc-anthology/' : '/',
})
