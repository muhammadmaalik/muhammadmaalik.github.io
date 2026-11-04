from pathlib import Path
import json, html
WEB=Path(__file__).resolve().parent.parent
projects=json.loads((WEB/'data/projects.json').read_text(encoding='utf-8'))
e=html.escape
nav=''.join(f'<a href="#{p["id"]}"><span>{i:02}</span> {e(p["title"])}</a>' for i,p in enumerate(projects,1))
articles=[]
for i,p in enumerate(projects,1):
    images=''.join(f'<figure><a href="./public/images/projects/{im["src"]}" aria-label="Open full image: {e(im["caption"])}"><img src="./public/images/projects/{im["src"]}" alt="{e(im["caption"])}" loading="lazy" width="900" height="700"></a><figcaption>{e(im["caption"])}</figcaption></figure>' for im in (p['images'][:3] if p['id']=='batman' else p['images']))
    extra=''
    if p['id']=='batman':
        extra='<details><summary>More build photos</summary><div class="gallery extra-gallery">'+''.join(f'<figure><a href="./public/images/projects/{im["src"]}"><img src="./public/images/projects/{im["src"]}" alt="{e(im["caption"])}" loading="lazy" width="900" height="700"></a><figcaption>{e(im["caption"])}</figcaption></figure>' for im in p['images'][3:])+'</div></details>'
    body=''.join(f'<div><h3>{e(h)}</h3><p>{e(t)}</p></div>' for h,t in p['body'])
    link=f'<a class="text-link" href="{e(p["link"])}">'+('Explore the aircraft' if p['id']=='jet' else 'View repository')+' <span aria-hidden="true">↗</span></a>' if p.get('link') else ''
    articles.append(f'''<article id="{p['id']}" class="project" data-category="{e(p['category'])}">
      <header class="project-heading"><span class="number">{i:02}</span><div><p class="eyebrow">{e(p['category'])} / {e(p['date'])}</p><h2>{e(p['title'])}</h2><p class="subtitle">{e(p['subtitle'])}</p></div><span class="status">{e(p['status'])}</span></header>
      <p class="summary">{e(p['summary'])}</p>
      <p class="tools"><span>TOOLS</span> {e(p['tools'])}</p>
      {('<div class="gallery gallery-'+p['id']+'">'+images+'</div>') if images else ''}
      {extra}<details><summary>Read project notes</summary><div class="notes">{body}</div>{link}</details>
    </article>''')
page=f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Engineering portfolio | Muhammad Maalik</title><meta name="description" content="Engineering projects by Muhammad Maalik: robotics, spacecraft, flight systems and structural analysis."><link rel="stylesheet" href="./assets/css/portfolio.css"></head>
<body><a class="skip" href="#projects">Skip to projects</a><header class="site-header"><a class="wordmark" href="./index.html">Muhammad Maalik</a><nav aria-label="Main"><a href="./index.html">Home</a><a href="./portfolio.html" aria-current="page">Portfolio</a><a href="./portfolio.pdf">Download PDF ↓</a><a href="mailto:umermaalik24@gmail.com">Contact</a></nav></header>
<main><section class="intro"><p class="eyebrow">Mechanical engineering & physics / Stony Brook University</p><h1>From an idea<br>to something <em>built.</em></h1><div class="intro-bottom"><p>A selection of work in robotics, flight, space systems, and engineering analysis. Sketches, simulations, hardware, and the decisions connecting them.</p><span class="edition">Portfolio / 2026<br>{len(projects):02} project studies</span></div></section>
<div class="portfolio-layout"><aside class="project-index"><p class="eyebrow">Project index</p><nav aria-label="Project index">{nav}</nav><a class="download" href="./portfolio.pdf">Printable portfolio ↗</a></aside><div id="projects"><div class="section-label"><span>Selected work</span><span>01 — 08</span></div>{''.join(articles)}</div></div>
<section class="closing"><div><p class="eyebrow">Beyond the projects</p><h2>Engineering, teaching,<br>and working with teams.</h2></div><div><p>Mechanical engineering intern at East End Assemblies. FEA lead at Stony Brook Robotics. Teaching assistant for AMS 261, Multivariable Calculus, and Autodesk ambassador.</p><p>B.S. Mechanical Engineering & Physics<br>Stony Brook University / August 2025 - May 2030</p><a href="./resume.pdf">View résumé ↗</a></div></section></main>
<footer><span>Muhammad Maalik / Engineering portfolio</span><a href="#top">Back to top ↑</a></footer></body></html>'''
page=page.replace('<body>','<body id="top">')
(WEB/'portfolio.html').write_text(page,encoding='utf-8')
