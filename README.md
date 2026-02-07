# BlogHub

BlogHub is a static blog plus browser admin built for GitHub Pages.
You edit posts, media, and settings from the admin UI, and BlogHub commits those changes directly to your GitHub repository.

## Core workflow

1. Log in with a GitHub Personal Access Token (PAT).
2. Edit content in `/admin`.
3. Changes are committed to `develop`.
4. Deploy merges `develop` into `main`.
5. GitHub Pages publishes from `main`.

## Prerequisites

- Node.js 20+
- npm 10+
- A GitHub repository with a `main` branch
- GitHub Pages enabled for the repository (GitHub Actions source)

## Installation

1. Clone or fork this repository.
2. Install dependencies:

```bash
npm install
```

3. Create `.env.local` in the project root:

```env
VITE_REPO_URL=https://github.com/OWNER/REPO
```

4. Start development:

```bash
npm run dev
```

5. Open the local URL shown by Vite and go to `/login`.

## GitHub token (PAT)

BlogHub uses a token directly from the browser (no OAuth backend required).

### Recommended token type

Fine-grained personal access token.

### Required access

- Repository access: your BlogHub repository
- Repository permissions:
  - `Contents`: Read and write
  - `Metadata`: Read-only (default)

Classic PATs also work when they have repository write access.

### Important notes

- The token is stored in browser `localStorage` under `bloghub.githubToken`.
- Use a dedicated token for this repository.
- Revoke/regenerate the token immediately if it is exposed.

## Basic usage

1. Log in at `/login`.
2. Open `/admin/posts` to create or edit posts.
3. Open `/admin/media` to upload/manage media.
4. Open `/admin/theme` to activate and customize themes.
5. Open `/admin/settings` for site settings and permalink structure.
6. Use `Deploy` in the admin top bar to merge `develop` into `main`.

## NPM scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | validate + generate + run Vite |
| `npm run build` | validate + generate + typecheck + production build |
| `npm run preview` | preview the production build locally |
| `npm run validate` | validate settings and themes |
| `npm run generate` | regenerate post/media manifests |
| `npm run lint` | run ESLint |
| `npm run fix:settings` | normalize theme vars in `public/site/settings.json` |

## Project content structure

- `public/site/settings.json`: site config and active theme
- `public/posts/*.md`: source markdown posts with frontmatter
- `public/media/*`: uploaded media files
- `public/generated/*`: generated indexes and route manifests
- `src/themes/*`: theme implementations
- `src/routes/admin/*`: admin interface

## Detailed tutorials (blog posts)

- Create and publish a post: `/bloghub-create-and-publish-a-post/`
- Change and customize a theme: `/bloghub-change-and-customize-theme/`
- Add and manage media: `/bloghub-add-and-manage-media/`
- Settings, branches, and deploy flow: `/bloghub-settings-branches-and-deploy/`

Source markdown files:

- `public/posts/bf4bf1af-3a3e-4f59-8f9d-2338b4f7d101.md`
- `public/posts/d893c4e8-7f43-4b2f-84f4-b3be28eeb202.md`
- `public/posts/2c7c81e2-d5f8-468d-a8f5-f3dbf7644303.md`
- `public/posts/85ae2fd9-82a6-4fd9-a3f0-fd63fb6b8404.md`

## Troubleshooting

- `Missing VITE_REPO_URL`: ensure `.env.local` contains `VITE_REPO_URL=https://github.com/OWNER/REPO`.
- `Token does not have write permissions to repo`: update PAT repository permissions.
- `Cannot sync branches` on login: merge `main` into `develop` on GitHub and resolve conflicts, then log in again.
