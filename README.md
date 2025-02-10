# CWA Manager

This Manager app will be used to manage the majority of CodeWithAli company.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Run the Code

This project uses [Bun](https://bun.sh/), [Rust](https://community.chocolatey.org/packages/rust) and [OpenSSL](https://community.chocolatey.org/packages/openssl) for project management. Make sure you have this installed before running the app.
**Project currently uses **Bun version 1.2+, Rust version 1.82***

**If your Windows device doesn't see Openssl, follow [this](https://github.com/sfackler/rust-openssl/issues/1542#issuecomment-2524831738) guide.*

1. Clone the project
```bash
git clone https://github.com/blazehp/CWA-Manager.git
```

2. Install packages
```bash
bun i
```

3. Run App
```bash
bun run tauri dev
```
