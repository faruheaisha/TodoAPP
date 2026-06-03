# PowerShell 一键执行脚本
# 复制以下内容到 PowerShell 中逐行执行

# ===== 步骤 1: 验证 Rust 版本（用大写 -V） =====
rustc -V
cargo -V

# ===== 步骤 2: 初始化 Git 仓库 =====
cd "E:\claude code\ToDoList-Project"
git init
git config user.name "faruheaisha"
git config user.email "faruhe.aisha@sjtu.edu.cn"
git add .
git commit -m "Day 1: Initial project setup - Tauri v2 + React + TS + Tailwind"

# ===== 步骤 3: 添加 GitHub 远程仓库（请先在 GitHub 创建空仓库）=====
# 在浏览器中打开 https://github.com/new 创建一个空仓库
# 然后执行（替换为你实际的仓库地址）：
# git remote add origin https://github.com/faruheaisha/TodoApp.git
# git branch -M main
# git push -u origin main

# ===== 步骤 4: 安装 npm 依赖 =====
npm install

# ===== 步骤 5: 检查 Rust 编译 =====
cargo check --manifest-path src-tauri\Cargo.toml
