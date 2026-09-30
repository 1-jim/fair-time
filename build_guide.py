"""Build guide.html from USER_GUIDE.md. Run after editing the guide: python3 build_guide.py"""
import markdown, re, pathlib
md = pathlib.Path("USER_GUIDE.md").read_text()
# In-app copy: the "Open the app" line is redundant, replace with a back link
md = re.sub(r"\*\*Open the app:\*\*.*\n", "", md)
body = markdown.markdown(md, extensions=["tables", "toc", "sane_lists"])
html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#17613A" />
    <title>How to use Fair Time</title>
    <link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet" />
    <style>
      :root {{
        --pitch: #17613a;
        --bg: #f3f6f4;
        --surface: #fff;
        --ink: #0f2016;
        --muted: #56665c;
        --line: #d3dcd6;
        --next: #c98a00;
        --next-t: #fff1cc;
        color-scheme: light;
        box-sizing: border-box;
        padding-top: env(safe-area-inset-top, 0px);
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }}
      @media (prefers-color-scheme: dark) {{
        :root:not([data-theme="light"]) {{
          --bg: #0c1711;
          --surface: #13231a;
          --ink: #e7f0ea;
          --muted: #9db0a4;
          --line: #27402f;
          --next: #f2b01e;
          --next-t: #3b2f0f;
          color-scheme: dark;
        }}
      }}
      :root[data-theme="dark"] {{
        --bg: #0c1711;
        --surface: #13231a;
        --ink: #e7f0ea;
        --muted: #9db0a4;
        --line: #27402f;
        --next: #f2b01e;
        --next-t: #3b2f0f;
        color-scheme: dark;
      }}
      html {{ scroll-padding-top: calc(env(safe-area-inset-top, 0px) + 70px); }}
      *, *::before, *::after {{ box-sizing: border-box; }}
      body {{ margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.55 "Barlow", system-ui, sans-serif; }}
      .top {{
        position: sticky;
        top: env(safe-area-inset-top, 0px);
        z-index: 5;
        background: var(--pitch);
        color: #fff;
        box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.85);
      }}
      .top .in {{ max-width: 760px; margin: 0 auto; display: flex; align-items: center; gap: 12px; padding: 10px 14px; }}
      .top img {{ height: 40px; filter: brightness(0) invert(1); }}
      .top a {{
        margin-left: auto;
        color: #fff;
        font: 600 18px "Barlow Condensed", system-ui, sans-serif;
        text-decoration: none;
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 8px;
        padding: 8px 14px;
      }}
      .top a, .top span {{ white-space: nowrap; }}
      .top span {{ font: 700 22px "Barlow Condensed", system-ui, sans-serif; }}
      main {{ max-width: 760px; margin: 0 auto; padding: 18px 16px 60px; }}
      h1, h2, h3 {{ font-family: "Barlow Condensed", system-ui, sans-serif; line-height: 1.15; }}
      h1 {{ font-size: 38px; margin: 6px 0 10px; }}
      h2 {{ font-size: 30px; margin: 36px 0 10px; }}
      h3 {{ font-size: 23px; margin: 24px 0 8px; }}
      p, li {{ max-width: 68ch; }}
      a {{ color: var(--pitch); }}
      @media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) a {{ color: #7fd3a2; }} }}
      hr {{ border: 0; border-top: 1px solid var(--line); margin: 28px 0; }}
      blockquote {{ margin: 16px 0; padding: 10px 14px; border-left: 6px solid var(--next); background: var(--next-t); border-radius: 8px; }}
      blockquote p {{ margin: 0; }}
      code {{ background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; font-size: 0.9em; overflow-wrap: anywhere; }}
      .tbl {{ overflow-x: auto; margin: 12px 0; }}
      table {{ border-collapse: collapse; width: 100%; background: var(--surface); border-radius: 8px; }}
      th, td {{ padding: 9px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }}
      th {{ font: 600 16px "Barlow Condensed", system-ui, sans-serif; color: var(--muted); }}
      li {{ margin: 4px 0; }}
    </style>
  </head>
  <body>
    <header class="top"><div class="in"><img src="icons/icon-192.png" alt="" style="filter:none;border-radius:6px"><span>Coach's guide</span><a href="./">Back to app</a></div></header>
    <main>
{body}
    </main>
    <script>
      try {{
        const s = JSON.parse(localStorage.getItem("wimborne-fairtime-v1") || "{{}}");
        if (s.theme) document.documentElement.dataset.theme = s.theme;
      }} catch (e) {{}}
      document.querySelectorAll("main table").forEach((t) => {{
        const w = document.createElement("div");
        w.className = "tbl";
        t.parentNode.insertBefore(w, t);
        w.appendChild(t);
      }});
    </script>
  </body>
</html>
"""
pathlib.Path("guide.html").write_text(html)
print("guide.html written", len(html))
