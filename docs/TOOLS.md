# Assistant tools and skills

Snapshot: 2026-10-13.

Rep Counter was developed with a coding assistant whose visible skill catalog and tool metadata form this inventory, including workflows read during the project and other capabilities exposed in the same session. These are assistant capabilities. Runtime dependencies belong to the application's package manifests.

## Use in this project

React work used `vercel-react-best-practices`, with `verification-before-completion` guiding checks before completion claims. `ui-ux-pro-max` supplied design guidance. The agent read `agent-browser`. UI inspection used the built-in browser through `cua_repl`, following the user's browser preference.

Context7 supplied library documentation. Implementation and tests ran through native shell and file tools, with subagents handling assigned work in the shared workspace.

Repository operations used the Git CLI over SSH, while the visible tool metadata provides no evidence of an installed GitHub MCP.

## Full skill catalog

Skills supply instructions. Each catalog entry names a `SKILL.md` workflow that the assistant reads when the task calls for it, and some workflows then use local scripts or MCP tools.

The catalog contains 35 skills. "Available" marks an entry exposed by the assistant environment, while the project column records reading or applying that workflow during this work.

| Group           | Skill                                 | Purpose                                          | Project use                                            |
| --------------- | ------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Writing         | `humanize`                            | Edit public prose for voice, wording and rhythm  | Documentation                                          |
| Writing         | `ai-check`                            | Review stylistic signs of AI drafting            | Documentation review workflow                          |
| Engineering     | `vercel-react-best-practices`         | React and Next.js performance guidance           | Read and applied                                       |
| Engineering     | `verification-before-completion`      | Require fresh checks before success claims       | Read and applied                                       |
| Design          | `ui-ux-pro-max`                       | UI and UX design guidance                        | Read and applied                                       |
| Browser         | `agent-browser`                       | Browser and desktop automation guidance          | Read, with actual UI work through the built-in browser |
| Assistant setup | `openai-docs`                         | OpenAI product and API documentation             | Available                                              |
| Assistant setup | `skill-creator`                       | Create and update skills                         | Available                                              |
| Assistant setup | `skill-installer`                     | Install skills from supported sources            | Available                                              |
| Assistant setup | `find-skills`                         | Discover skills for a task                       | Available                                              |
| Assistant setup | `plugin-management:plugin-management` | Discover plugins and manage connections          | Available                                              |
| Decisions       | `jev-decisions`                       | Bounded classifications and evidence checks      | Available                                              |
| Design          | `logo-design`                         | Logo briefs, SVG marks and identity assets       | Available                                              |
| Design          | `imagegen`                            | Generate and edit raster images                  | Available                                              |
| Design          | `visualize:visualize`                 | Conversation visuals and interactive tools       | Available                                              |
| Websites        | `sites:sites`                         | Build and manage Sites projects                  | Available                                              |
| SEO             | `dataforseo`                          | DataForSEO audits and API workflows              | Available                                              |
| Documents       | `documents:documents`                 | Create and inspect Word documents                | Available                                              |
| Documents       | `pdf:pdf`                             | Read, create and verify PDFs                     | Available                                              |
| Documents       | `presentations:Presentations`         | Create and edit slide decks                      | Available                                              |
| Documents       | `spreadsheets:Spreadsheets`           | Spreadsheet files, formulas and charts           | Available                                              |
| Documents       | `spreadsheets:excel-live-control`     | Control a connected live Excel session           | Available                                              |
| Templates       | `template-creator:template-creator`   | Turn references into reusable artifact templates | Available                                              |
| Google Drive    | `google-drive:google-drive`           | Find and manage Drive files                      | Available                                              |
| Google Drive    | `google-drive:google-docs`            | Create and edit native Google Docs               | Available                                              |
| Google Drive    | `google-drive:google-drive-comments`  | Review and manage file comments                  | Available                                              |
| Google Drive    | `google-drive:google-sheets`          | Analyze and edit connected Sheets                | Available                                              |
| Google Drive    | `google-drive:google-slides`          | Edit decks using an existing Slides reference    | Available                                              |
| Pages           | `pages:write-page`                    | Create and edit requested Pages content          | Available                                              |
| Pages           | `pages:maintain-space`                | Update Pages and Spaces with new evidence        | Available                                              |
| Pages           | `pages:organize-space`                | Organize Pages and Space structure               | Available                                              |
| Pages           | `pages:manage-schedules`              | Manage recurring Space work                      | Available                                              |
| Work pets       | `work-pets:create-pet`                | Create and validate animated ChatGPT pets        | Available                                              |
| Work pets       | `work-pets:pets`                      | Inspect and manage existing ChatGPT pets         | Available                                              |
| Work pets       | `work-pets:update-pet`                | Repair or update a custom ChatGPT pet            | Available                                              |

## MCP tool namespaces

Tools perform actions. The namespace names below come from session metadata, which exposes callable interfaces while leaving server deployment details and any account authorization outside this inventory.

| Namespace     | Exposed capability                                                         | Project use                          |
| ------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| `context7`    | Resolve library identifiers and query current documentation                | Documentation lookup                 |
| `cua_repl`    | Inspect and operate browsers or native apps                                | Built-in browser UI work             |
| `node_repl`   | Run persistent JavaScript for local inspection and artifact work           | Available                            |
| `codex_app`   | Codex panels, chat management, worktrees, automations and artifact helpers | Available, including panel workflows |
| `code_review` | Read pull or merge request CI diagnostics                                  | Available                            |
| `jev`         | Typed advisory decisions, option ranking and result checks                 | Available                            |
| `mailspring`  | Search mail, manage threads and work with drafts                           | Available                            |
| `n8n`         | Inspect, create, test and execute workflows and data tables                | Available                            |

External account access remains unverified. No credentials or private MCP configuration were read to produce this snapshot.

## App connector families

The `codex_apps` namespace groups app connectors, including Google Drive and Sites, whose visible tool descriptions identify available operations without establishing access to an external account or its documents.

| Family under `codex_apps` | Exposed capability                                                       |
| ------------------------- | ------------------------------------------------------------------------ |
| `chatgpt_space`           | Search and edit Pages or Spaces, sharing and schedules                   |
| `codex_document_control`  | Inspect connected document sessions and execute their supported commands |
| `google_drive`            | Drive files, Docs, Sheets, Slides, comments and sharing                  |
| `hotline`                 | Look up local suicide or self-harm helpline information                  |
| `namecheap`               | Check domain registration availability and prices                        |
| `plugin_management`       | Discover plugins and inspect app permissions or dependencies             |
| `safety_settings`         | ChatGPT parental controls and Trusted Contact settings                   |
| `search_service`          | Internet search and page retrieval                                       |
| `sites`                   | Site creation, versions, deployments, domains and access settings        |

Recommended plugins remain suggestions. Entries such as GitHub, Slack and Gmail in the recommendation list are excluded from the availability tables, because that list provides no evidence of installation or account access.

## Native tools and collaboration

| Interface                                    | Project use or capability                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `exec_command`, `write_stdin`, `apply_patch` | Local inspection, application edits, test commands and Git CLI work                |
| `functions.exec`                             | Compose tool calls and batch independent reads or checks                           |
| `collaboration`                              | Delegate bounded work, exchange findings and coordinate subagents                  |
| Native utilities                             | Web lookup, time, MCP resource discovery, local image viewing and image generation |

AI assisted this draft. `humanize` edits phrasing and rhythm, while `ai-check` grades style heuristically and cannot prove that a person wrote a document. The private review record belongs in the ignored `artifacts/` directory.
