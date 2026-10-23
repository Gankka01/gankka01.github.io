# Wonik Jang — academic website

Home and a web CV, adapted from [Keunhong Park's website](https://github.com/keunhong/keunhong.github.io).
The original typography and page structure are retained, with a cool background and selective royal-blue accents.

## Pages

- Home: `https://gankka01.github.io/`
- CV: `https://gankka01.github.io/cv/`

Both pages are published through GitHub Pages.

Home lists PatchMark, the KCC 2026 paper, and KoboNet in reverse chronological order.
The CV includes all four papers, grouped by publication type, including the ICOIN submission.
Home displays the selected hand-drawn portrait and the three approved research figures.
The portrait is cropped to a square by the page layout; the original image is preserved.
Research thumbnails open their full-size images in a new tab.
The Home CV button opens the current PDF; the navigation CV link opens the web CV.
Email buttons copy the address and display a confirmation or a readable fallback.

## Editing content

| Content | File |
| --- | --- |
| Name, biography, email, links, portrait, update date | `_config.yml` |
| Papers, publication status, buttons, research images | `_data/publications.yml` |
| Author names and emphasis | `_data/authors.yml` |
| Education, research, projects, IP, awards, leadership | `_data/cv.yml` |
| Home layout | `index.html` |
| Web CV layout | `cv.html` |
| PDF CV | `assets/files/Wonik_Jang_CV.pdf` |
| Portrait and research images | `assets/images/` |
| Email-copy behavior | `assets/js/site.js` |
| Colors and spacing | `_tailwind.css` |
| Credit line | `_includes/footer.html` |

Set `portrait` and `cv_pdf` in `_config.yml` to the corresponding image and PDF paths.
For each paper, set `image` and `image_alt` after adding an image under `assets/images/`.
Empty image fields display a placeholder.

The `accent_name` field colors only a paper's leading model name.
CV section headings color the first three letters through `_includes/section-title.html`.
The main accent is `#2563EB` in `_tailwind.css`.

Add a verified `publication_url` when PatchMark receives a publication landing page.
Until then, the entry says "Accepted for publication" and shows only its Code link.
Set `show_on_home: false` to keep a paper on the CV alone.
Quote `sort_date` values in ISO format; the displayed `date` uses month and year.

## GitHub Pages

The repository uses the original Jekyll + Tailwind build workflow in
`.github/workflows/jekyll.yml`.

1. Review and merge the website branch into `main`.
2. In the repository's **Settings → Pages**, select **GitHub Actions** as the source.
3. If workflows are disabled for the fork, enable them in **Actions**.
4. When ready to build and publish, run **Deploy Jekyll with Tailwind** from `main`.
   Subsequent pushes to `main` will also trigger this workflow.

No custom domain is configured. The inherited `CNAME` was removed, and `url` points
to `https://gankka01.github.io`. A purchased custom domain can be connected later.
The original owner's analytics ID and personal content are not used.

## Attribution and license

Template adapted from **[Keunhong Park](https://github.com/keunhong/keunhong.github.io)**.
Thanks for sharing!

The original template is offered under **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**.
This adaptation of the template is offered under the same license. See [LICENSE.md](LICENSE.md).

Changes made for this adaptation: replacement of personal and research content,
Home/CV navigation, shared publication data, selective blue accents, approved image assets,
PDF links, clipboard email buttons, upright CV dates, larger section headings and rules,
responsive CV date columns, accessibility labels, and removal of the original blog,
media files, custom domain, and analytics configuration.

Linked papers, software, photographs, trademarks, and third-party fonts or icons
retain their respective rights and licenses.
