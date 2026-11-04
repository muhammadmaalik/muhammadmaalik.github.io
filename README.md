# Muhammad Maalik - GitHub Pages website

The existing homepage, aircraft model, blog, fonts, and vendor files are retained. The Portfolio link now opens portfolio.html; portfolio.pdf is the updated printable document.

## Portfolio organization
- data/projects.json: ordered project descriptions, dates, tools, image captions, and links.
- public/images/projects/<project>/: optimized documentary images with descriptive names.
- assets/css/portfolio.css: the portfolio page styles and responsive breakpoints.
- scripts/build_portfolio.py: rebuilds portfolio.html from project data using Python 3, with no extra packages.
- portfolio-source/: editable LaTeX, one file per project, plus images. Compile main.tex in Overleaf with pdfLaTeX.
- archive/portfolio-before-update.pdf: the previous PDF retained for reference.

To add a website project, add an object to data/projects.json, put its photos in public/images/projects/<id>/, and run `python scripts/build_portfolio.py`. Include id, title, subtitle, category, date, status, tools, summary, body (heading/text pairs), and images (src/caption objects); link is optional. The index and project count regenerate automatically. Update the LaTeX project source separately and replace portfolio.pdf after exporting its compiled PDF.

## Preview
Run `python -m http.server 8765 --bind 127.0.0.1` from this directory, then open http://127.0.0.1:8765/portfolio.html.

## Publish to the existing GitHub Pages site
Copy this package into the repository checkout, review the changes, commit, and push to main using an account with write access. No framework build or hosting migration is required. Keep the repository's existing GitHub Pages settings.

## Verification
LaTeX main.tex compiled successfully with the Codex desktop compiler. The supplied downloadable PDF was typeset separately from the same project content; its page layout may differ from the LaTeX preview. The PDF was rendered and visually reviewed. Website links and image files were checked locally, with browser review of desktop and mobile layouts.

Batman is a team project. The personal division of work has not been supplied. No awards or pickup reliability claims were invented. Additional new projects beyond Batman await the owner's descriptions.
