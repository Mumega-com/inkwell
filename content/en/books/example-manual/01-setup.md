---
title: "01. Setup: Your First Manual"
author: "The Inkwell Team"
date: 2026-02-12
description: "How to create your own manual using the Inkwell Books collection."
tags: ["setup", "manual", "docs"]
---

Creating a manual in Inkwell is straightforward. 

## 1. Create the Directory
Every book exists as a sub-directory in `content/en/books/`.

```bash
mkdir -p content/en/books/my-manual
```

## 2. Create the Index
Create an `index.md` file in that directory. This will be the landing page for your manual.

```markdown
---
title: "My Manual"
author: "The Team"
description: "A short pitch for your manual."
cover_image: "/images/cover.jpg"
---

The index content goes here...
```

## 3. Add Chapters
Create additional markdown files in the same directory. Chapters are automatically sorted by their filename.

---

[[en/books/example-manual/index|Return to Manual Index]].
