/* =========================================================================
   Interactive console mode  —  ch0tix.github.io
   A dependency-free, typed-command terminal that overlays the graphic site.
   Data (about / skills / projects / posts / social) is pulled from
   /index.json, which Hugo generates from your content + config.
   ========================================================================= */
(function () {
  "use strict";

  var script   = document.currentScript;
  var DATA_URL = (script && script.getAttribute("data-base")) || "/index.json";

  var overlay, output, input, promptEl, toggleBtn, closeBtn;
  var DATA = null;
  var booted = false;              // banner printed this page-load?
  var history = [];
  var histIdx = -1;
  var PROMPT = "ch0tix@web:~$";

  var BANNER = [
    " ██████╗██╗  ██╗ ██████╗ ████████╗██╗██╗  ██╗",
    "██╔════╝██║  ██║██╔═████╗╚══██╔══╝██║╚██╗██╔╝",
    "██║     ███████║██║██╔██║   ██║   ██║ ╚███╔╝ ",
    "██║     ██╔══██║████╔╝██║   ██║   ██║ ██╔██╗ ",
    "╚██████╗██║  ██║╚██████╔╝   ██║   ██║██╔╝ ██╗",
    " ╚═════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝╚═╝  ╚═╝"
  ].join("\n");

  // ---- tiny helpers -------------------------------------------------------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function write(html) {
    var div = document.createElement("div");
    div.className = "c-row";
    div.innerHTML = html;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  }
  function blank() { write("&nbsp;"); }

  // ---- command registry ---------------------------------------------------
  var COMMANDS = {
    help: {
      help: "show this help",
      run: function () {
        write('<span class="c-accent">available commands</span>');
        var order = ["about", "whoami", "skills", "projects", "posts",
          "ls", "cat", "open", "social", "clear", "banner", "echo",
          "date", "uname", "pwd", "history", "gui", "help"];
        var rows = '<div class="c-table">';
        order.forEach(function (name) {
          var c = COMMANDS[name];
          if (!c) return;
          rows += '<span class="c-cmd">' + esc(name) + "</span><span>" + esc(c.help) + "</span>";
        });
        rows += "</div>";
        write(rows);
        write('<span class="c-dim">tip: use ↑/↓ for history, Tab to complete, Esc to leave.</span>');
      }
    },
    about: {
      help: "who is ch0tix",
      run: function () {
        var lines = (DATA && DATA.about) || ["(about is empty — edit hugo.toml → params.consoleAbout)"];
        lines.forEach(function (l) { write(l === "" ? "&nbsp;" : esc(l)); });
      }
    },
    whoami: {
      help: "print current user",
      run: function () {
        var name = (DATA && DATA.site && DATA.site.author) || "ch0tix";
        var sub = (DATA && DATA.site && DATA.site.subtitle) || "";
        write('<span class="c-accent">' + esc(name) + "</span>");
        if (sub) write('<span class="c-dim">' + esc(sub) + "</span>");
      }
    },
    skills: {
      help: "list skills / toolbox",
      run: function () {
        var s = (DATA && DATA.skills) || [];
        if (!s.length) return write('<span class="c-dim">(no skills configured)</span>');
        s.forEach(function (l) { write(esc(l)); });
      }
    },
    projects: {
      help: "list projects",
      run: function () {
        var p = (DATA && DATA.projects) || [];
        if (!p.length) return write('<span class="c-dim">(no projects configured)</span>');
        p.forEach(function (pr) {
          var head = '<span class="c-cmd">' + esc(pr.name) + "</span>";
          if (pr.url) head += '  <a href="' + esc(pr.url) + '" target="_blank" rel="noopener">' + esc(pr.url) + "</a>";
          write(head);
          if (pr.desc) write('<span class="c-dim">  ' + esc(pr.desc) + "</span>");
        });
      }
    },
    posts: {
      help: "list blog posts",
      run: listPosts
    },
    ls: {
      help: "list content",
      run: function (args) {
        var pages = (DATA && DATA.pages) || [];
        if (pages.length) {
          write('<span class="c-accent">pages/</span>');
          pages.forEach(function (pg) {
            write('  <a href="' + esc(pg.url) + '">' + esc(pg.title) + "</a>");
          });
        }
        write('<span class="c-accent">posts/</span>');
        listPosts();
      }
    },
    cat: {
      help: "preview a post:  cat <n|slug>",
      run: function (args) {
        var post = findPost(args[0]);
        if (!post) return write('<span class="c-error">cat: no such post: ' + esc(args[0] || "") + "</span>");
        write('<span class="c-cmd">' + esc(post.title) + '</span> <span class="c-dim">(' + esc(post.date) + ")</span>");
        if (post.summary) write(esc(post.summary));
        write('read it: <a href="' + esc(post.url) + '">' + esc(post.url) + '</a>  ·  or type <span class="c-cmd">open ' + esc(args[0]) + "</span>");
      }
    },
    open: {
      help: "open a post in the browser:  open <n|slug>",
      run: function (args) {
        var post = findPost(args[0]);
        if (!post) return write('<span class="c-error">open: no such post: ' + esc(args[0] || "") + "</span>");
        write('<span class="c-dim">opening ' + esc(post.url) + " …</span>");
        setMode("graphic");
        window.location.href = post.url;
      }
    },
    social: {
      help: "contact / social links",
      run: function () {
        var s = (DATA && DATA.social) || {};
        var any = false;
        Object.keys(s).forEach(function (k) {
          if (!s[k]) return;
          any = true;
          var val = s[k];
          var href = (k === "email") ? "mailto:" + val : val;
          write('<span class="c-cmd">' + esc(k) + "</span>  :: " +
            '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(val) + "</a>");
        });
        if (!any) write('<span class="c-dim">(no social links configured)</span>');
      }
    },
    contact: { help: "alias of social", run: function () { COMMANDS.social.run(); } },
    clear: { help: "clear the screen", run: function () { output.innerHTML = ""; } },
    cls:   { help: "alias of clear", run: function () { output.innerHTML = ""; } },
    banner: { help: "print the banner", run: printBanner },
    echo: { help: "echo text", run: function (args, raw) { write(esc(raw.slice(4).trim())); } },
    date: { help: "print the date", run: function () { write(esc(new Date().toString())); } },
    uname: { help: "system info", run: function () { write("ch0tix-web 6.x #1 SMP x86_64 GNU/Linux"); } },
    pwd:  { help: "working directory", run: function () { write("/home/ch0tix"); } },
    history: {
      help: "command history",
      run: function () {
        history.forEach(function (h, i) { write('<span class="c-dim">' + (i + 1) + "</span>  " + esc(h)); });
      }
    },
    sudo: {
      help: null,
      run: function () { write('<span class="c-error">ch0tix is not in the sudoers file. This incident will be reported.</span>'); }
    },
    gui:  { help: "exit to the graphic site", run: closeConsole },
    exit: { help: "alias of gui", run: closeConsole },
    q:    { help: null, run: closeConsole }
  };

  function listPosts() {
    var posts = (DATA && DATA.posts) || [];
    if (!posts.length) return write('<span class="c-dim">(no posts yet)</span>');
    posts.forEach(function (p, i) {
      write('<span class="c-dim">' + String(i + 1).padStart(2, "0") + "</span>  " +
        '<span class="c-dim">' + esc(p.date) + "</span>  " +
        '<a href="' + esc(p.url) + '">' + esc(p.title) + "</a>");
    });
    write('<span class="c-dim">→ open one with: </span><span class="c-cmd">open &lt;n&gt;</span>' +
      '<span class="c-dim"> or </span><span class="c-cmd">cat &lt;n&gt;</span>');
  }

  function findPost(ref) {
    var posts = (DATA && DATA.posts) || [];
    if (!ref) return null;
    var n = parseInt(ref, 10);
    if (!isNaN(n) && String(n) === String(ref).trim()) return posts[n - 1] || null;
    ref = String(ref).toLowerCase();
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].url.toLowerCase().indexOf(ref) !== -1 ||
          posts[i].title.toLowerCase().indexOf(ref) !== -1) return posts[i];
    }
    return null;
  }

  function printBanner() {
    write('<span class="c-banner">' + esc(BANNER) + "</span>");
  }

  function boot() {
    if (booted) return;
    booted = true;
    printBanner();
    var sub = (DATA && DATA.site && DATA.site.subtitle) || "security researcher & engineer";
    write('<span class="c-dim">' + esc(sub) + "</span>");
    blank();
    write('Welcome to the console. Type <span class="c-cmd">help</span> for commands, ' +
      '<span class="c-cmd">gui</span> to return to the site.');
    blank();
  }

  // ---- command execution --------------------------------------------------
  function run(raw) {
    var line = raw.trim();
    write('<span class="c-prompt">' + esc(PROMPT) + '</span> <span class="c-echo">' + esc(line) + "</span>");
    if (!line) return;
    history.push(line); histIdx = history.length;
    var parts = line.split(/\s+/);
    var name = parts[0].toLowerCase();
    var args = parts.slice(1);
    var cmd = COMMANDS[name];
    if (cmd) {
      try { cmd.run(args, line); }
      catch (e) { write('<span class="c-error">error: ' + esc(e.message) + "</span>"); }
    } else {
      write('<span class="c-error">' + esc(name) + ": command not found</span>");
      write('<span class="c-dim">type </span><span class="c-cmd">help</span><span class="c-dim"> for a list.</span>');
    }
    blank();
  }

  // ---- mode switching -----------------------------------------------------
  function setMode(mode) {
    try { localStorage.setItem("site-mode", mode); } catch (e) {}
  }
  function openConsole() {
    document.documentElement.classList.add("console-active");
    overlay.setAttribute("aria-hidden", "false");
    setMode("console");
    boot();
    setTimeout(function () { input.focus(); }, 30);
  }
  function closeConsole() {
    document.documentElement.classList.remove("console-active");
    overlay.setAttribute("aria-hidden", "true");
    setMode("graphic");
    if (toggleBtn) toggleBtn.focus();
  }
  function toggleConsole() {
    if (document.documentElement.classList.contains("console-active")) closeConsole();
    else openConsole();
  }

  // ---- input handling -----------------------------------------------------
  function onKey(e) {
    if (e.key === "Enter") {
      var v = input.value; input.value = ""; run(v);
    } else if (e.key === "ArrowUp") {
      if (histIdx > 0) { histIdx--; input.value = history[histIdx] || ""; }
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      if (histIdx < history.length) { histIdx++; input.value = history[histIdx] || ""; }
      e.preventDefault();
    } else if (e.key === "Tab") {
      e.preventDefault();
      var frag = input.value.trim().toLowerCase();
      if (!frag) return;
      var matches = Object.keys(COMMANDS).filter(function (c) {
        return COMMANDS[c].help !== null && c.indexOf(frag) === 0;
      });
      if (matches.length === 1) input.value = matches[0] + " ";
      else if (matches.length > 1) { write('<span class="c-dim">' + matches.join("  ") + "</span>"); }
    } else if (e.key === "Escape") {
      closeConsole();
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault(); output.innerHTML = "";
    }
  }

  // ---- wiring -------------------------------------------------------------
  function init() {
    overlay   = document.getElementById("console-overlay");
    output    = document.getElementById("console-output");
    input     = document.getElementById("console-input");
    promptEl  = document.getElementById("console-prompt");
    toggleBtn = document.getElementById("console-toggle");
    closeBtn  = document.getElementById("console-close");
    if (!overlay || !output || !input) return;

    promptEl.textContent = PROMPT;
    input.addEventListener("keydown", onKey);
    if (toggleBtn) toggleBtn.addEventListener("click", openConsole);
    if (closeBtn) closeBtn.addEventListener("click", closeConsole);

    // keep focus in the input while the console is open
    overlay.addEventListener("mousedown", function (e) {
      if (e.target === overlay) { e.preventDefault(); input.focus(); }
    });

    // backtick toggles the console from anywhere on the page
    document.addEventListener("keydown", function (e) {
      var t = e.target;
      var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "`" && (!typing || t === input)) {
        if (t === input) return;           // let backtick type normally in the console
        e.preventDefault(); toggleConsole();
      }
    });

    // any link/button pointing at #console opens the console
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href$="#console"], a[href="#console"], [data-console]');
      if (a) { e.preventDefault(); openConsole(); }
    });

    // fetch content data, then (if we loaded straight into console mode) boot
    fetch(DATA_URL, { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) { DATA = json; })
      .catch(function () { DATA = null; })
      .finally(function () {
        if (document.documentElement.classList.contains("console-active")) openConsole();
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
