# Toner System

A browser-based tool for applying a consistent toner-style effect to text and images.

## What It Does

- Processes text and uploaded images through the same toner pipeline
- Supports batch image import
- Exports a single processed image or a ZIP of a full batch
- Lets users tune dot spacing, blur, threshold, jitter, softness, texture, and image normalization

## Local Use

Install dependencies and run the app locally:

```bash
npm install
npm run web
```

For the Electron wrapper:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## GitHub Pages Deploy

This repo is configured to deploy to GitHub Pages with GitHub Actions.

### 1. Push The Repo

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Enable Pages

In GitHub:

1. Open the repository
2. Go to `Settings` -> `Pages`
3. Under `Build and deployment`, set `Source` to `GitHub Actions`

### 3. Deploy

Every push to `main` will build and deploy automatically.

Your app will be available at:

```text
https://<your-github-username>.github.io/<your-repo-name>/
```

## Notes

- The Vite base path is derived automatically during GitHub Actions builds, so the same repo can deploy under its own GitHub Pages path.
- Batch export creates a ZIP in the browser; no backend is required.
