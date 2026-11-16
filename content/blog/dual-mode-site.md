---
title: "Building a blog with a graphic mode and a console mode"
author: "ch0tix"
date: 2026-11-15
description: "One Hugo site, two front ends: a graphic blog and a typed-command console, bridged by a generated JSON feed."
tags: ["meta", "hugo", "javascript", "webdev"]
---

This site has two front ends over the same content: a normal **graphic** blog
(the [hugo-theme-terminal](https://themes.gohugo.io/themes/hugo-theme-terminal/)
look) and an interactive **console** you can type commands into.

<!--more-->

### the idea

Static site generators are great at producing pages. They are not, by default,
great at producing a *typed command line*. So the trick is to keep one source of
truth and render it two ways:

1. Hugo builds the HTML pages as usual (graphic mode).
2. Hugo *also* emits a small `index.json` describing the site — posts, about
   text, skills, projects, links.
3. A ~300-line vanilla-JS console reads that JSON and turns it into commands
   (`posts`, `cat`, `open`, `about`, `skills`, `social`, …).

Because the console is driven by the same JSON that Hugo generates from the
content, the two modes never drift apart. Add a post, and it shows up in both.

### the data feed

The whole bridge is one Hugo template that produces JSON for the home page's
`JSON` output format — posts come straight from the content section, and the
rest from site params. No duplication, no manual lists to maintain.

### the console

The front end is deliberately dependency-free: an overlay, an `<input>`, a
command registry, history with the arrow keys, tab-completion, and a
`localStorage` flag so the site remembers which mode you prefer.

Try it now — press the backtick key `` ` `` and type `help`.
