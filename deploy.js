#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

console.log('🚀 Deploying to gh-pages...\n');

try {
  // Build the project
  console.log('1️⃣ Building project...');
  execSync('pnpm build', { stdio: 'inherit' });

  // Create a temporary git worktree
  console.log('\n2️⃣ Setting up deployment branch...');
  const distPath = path.resolve('dist-react');
  const worktreePath = path.resolve('.publish');

  // Remove old worktree if exists
  if (fs.existsSync(worktreePath)) {
    fs.rmSync(worktreePath, { recursive: true, force: true });
  }

  // Create worktree for gh-pages branch
  execSync(`git worktree add ${worktreePath} gh-pages`, { stdio: 'inherit' });

  // Copy build files and selectively copy public assets
  console.log('\n3️⃣ Copying build and public files...');
  if (fs.existsSync(worktreePath)) {
    fs.rmSync(worktreePath, { recursive: true, force: true });
  }
  fs.mkdirSync(worktreePath, { recursive: true });

  // Copy Vite build output (React app only)
  execSync(`xcopy "${distPath}" "${worktreePath}" /E /I /Y /Q`, {
    stdio: 'inherit',
    shell: true
  });

  // Function to copy directory recursively with filters
  const copyDir = (src, dest, skipDirs = []) => {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      // Skip specified directories
      if (entry.isDirectory()) {
        if (skipDirs.includes(entry.name)) {
          continue;
        }
        copyDir(srcPath, destPath, skipDirs);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };

  // Copy public folder (excluding subproject dependencies)
  const publicPath = path.resolve('public');
  if (fs.existsSync(publicPath)) {
    copyDir(publicPath, worktreePath, ['node_modules', 'target', '.mvn', 'nest', '.nest']);
    console.log('✅ Public files copied (subproject dependencies excluded)');
  }

  // Create .gitignore to exclude any remaining unwanted files
  const gitignorePath = path.join(worktreePath, '.gitignore');
  const gitignoreContent = `node_modules/
target/
.mvn/
pnpm-lock.yaml
.nest/
.DS_Store
.gitkeep
`;
  fs.writeFileSync(gitignorePath, gitignoreContent);
  // Commit and push
  console.log('\n4️⃣ Committing and pushing...');
  process.chdir(worktreePath);

  execSync('git add --all', { stdio: 'inherit' });

  // Check if there are changes
  const status = execSync('git status --porcelain', { encoding: 'utf-8' });
  if (!status.trim()) {
    console.log('✅ No changes to deploy.');
  } else {
    execSync('git commit -m "Deploy to GitHub Pages"', { stdio: 'inherit' });
    execSync('git push origin gh-pages -f', { stdio: 'inherit' });
  }

  // Cleanup
  console.log('\n5️⃣ Cleaning up...');
  process.chdir('..');
  execSync('git worktree remove .publish -f', { stdio: 'inherit' });

  console.log('\n✅ Deployment successful!');
  console.log('🌐 https://atbox-zz.github.io/app');

} catch (error) {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
}
