# muhammadmaalik.github.io

Personal portfolio, served as a static site from GitHub Pages. No build step.

## Run it locally

```bash
python3 serve.py
```

Then open http://127.0.0.1:5220/. `serve.py` is a plain static server plus one
endpoint that lets the blog editor save `blogs.json` while you work on this
computer. The first run writes an editor key to `blog.key` (git-ignored).

## What is in here

- `index.html`, `styles.css` — the one-page portfolio. Folders on the left open
  panes on the right.
- `main.js`, `flight.js` — the Plane pane. `main.js` draws the jet with three.js
  and runs the flight controls; `flight.js` is the flight model (lift, drag,
  thrust, weight, stall, turn rate) with no graphics dependency, so it can be
  tested in Node: `node --input-type=module -e "import('./flight.js').then(f => console.log(f.rotationSpeed()))"`.
  The aerodynamic constants live at the top of `flight.js`.
- `public/models/plane.glb` — the jet, exported from Fusion 360.
- `blogs.html`, `blogs.json` — the blog. Posts are plain JSON; the page renders
  them and, when unlocked, edits them.
- `public/images/mechanical-horse-sketch.jpg` — the drawing on the right.
- `vendor/` — three.js and the loaders it needs, vendored so the site has no
  external runtime dependencies.

## Writing a blog post

Posts live in `blogs.json`. You can edit that file by hand and commit, or use
the editor on the Blogs page:

1. Open the Blogs page and click **Edit**.
2. Enter the editor key.
   - **On the live site** the key is a GitHub fine-grained personal access
     token. Create one at GitHub → Settings → Developer settings → Personal
     access tokens → Fine-grained tokens. Limit it to this repository only and
     give it one permission: **Contents: Read and write**. The token never
     leaves your browser; it is used to commit `blogs.json` through the GitHub
     API, and GitHub Pages republishes within about a minute.
   - **Locally** (`serve.py`) the key is the contents of `blog.key`.
3. Tick **Remember on this device** if you do not want to paste it again on
   that browser. **Lock** forgets it.

Publishing, editing, and deleting each make one commit on `main`.
