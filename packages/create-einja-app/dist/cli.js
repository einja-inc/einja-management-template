#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";
import { readFileSync as readFileSync5 } from "fs";
import { fileURLToPath as fileURLToPath3 } from "url";
import { dirname as dirname5, join as join14 } from "path";

// src/commands/create.ts
import { existsSync as existsSync3, readdirSync } from "fs";
import { resolve } from "path";
import ora2 from "ora";

// src/prompts/project.ts
import inquirer from "inquirer";
async function promptProjectConfig(defaultProjectName) {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D:",
      default: defaultProjectName || "my-project",
      validate: (input) => {
        const regex = /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/;
        if (!regex.test(input)) {
          return "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D\u306F\u82F1\u5B57\u3067\u59CB\u307E\u308A\u3001\u82F1\u6570\u5B57\u30FB\u30CF\u30A4\u30D5\u30F3\u30FB\u30A2\u30F3\u30C0\u30FC\u30B9\u30B3\u30A2\u306E\u307F\u4F7F\u7528\u3067\u304D\u307E\u3059\uFF081\u301C50\u6587\u5B57\uFF09";
        }
        return true;
      }
    },
    {
      type: "confirm",
      name: "useCurrentDir",
      message: "\u4ECA\u3044\u308B\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u306B\u76F4\u63A5\u4F5C\u6210\u3057\u307E\u3059\u304B\uFF1F\uFF08No\u306A\u3089\u30B5\u30D6\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3092\u4F5C\u6210\uFF09",
      default: false
    },
    {
      type: "input",
      name: "packageScope",
      message: "\u30D1\u30C3\u30B1\u30FC\u30B8\u30B9\u30B3\u30FC\u30D7:",
      default: "@repo",
      validate: (input) => {
        const regex = /^@[a-zA-Z][a-zA-Z0-9_-]{0,49}$/;
        if (!regex.test(input)) {
          return "\u30D1\u30C3\u30B1\u30FC\u30B8\u30B9\u30B3\u30FC\u30D7\u306F@\u3067\u59CB\u307E\u308A\u3001\u82F1\u6570\u5B57\u30FB\u30CF\u30A4\u30D5\u30F3\u30FB\u30A2\u30F3\u30C0\u30FC\u30B9\u30B3\u30A2\u306E\u307F\u4F7F\u7528\u3067\u304D\u307E\u3059";
        }
        return true;
      }
    },
    {
      type: "list",
      name: "authMethod",
      message: "\u8A8D\u8A3C\u6A5F\u80FD:",
      choices: [
        { name: "NextAuth.js \u3092\u4F7F\u7528", value: "default" },
        { name: "\u306A\u3057\uFF08\u8A8D\u8A3C\u30D5\u30A1\u30A4\u30EB\u3092\u9664\u5916\uFF09", value: "none" }
      ],
      default: "default"
    },
    {
      type: "confirm",
      name: "setupEinjaCli",
      message: "@einja/dev-cli \u3092\u81EA\u52D5\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u3057\u307E\u3059\u304B\uFF1F",
      default: true
    },
    {
      type: "confirm",
      name: "customizeWorktree",
      message: "Worktree\u8A2D\u5B9A\u3092\u30AB\u30B9\u30BF\u30DE\u30A4\u30BA\u3057\u307E\u3059\u304B\uFF1F",
      default: false
    }
  ]);
  const tools = {
    direnv: true,
    dotenvx: true,
    volta: true,
    biome: true,
    husky: true
  };
  let worktreeConfig;
  if (answers.customizeWorktree) {
    const worktreeAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "postgresPort",
        message: "PostgreSQL\u30DD\u30FC\u30C8\u756A\u53F7:",
        default: "25432",
        validate: (input) => {
          const port = Number.parseInt(input, 10);
          if (Number.isNaN(port) || port < 1024 || port > 65535) {
            return "\u30DD\u30FC\u30C8\u756A\u53F7\u306F1024\u301C65535\u306E\u7BC4\u56F2\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044";
          }
          return true;
        }
      },
      {
        type: "input",
        name: "containerName",
        message: "Docker\u30B3\u30F3\u30C6\u30CA\u540D:",
        default: `${answers.projectName}-postgres`
      },
      {
        type: "input",
        name: "appId",
        message: "\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3ID:",
        default: "web"
      },
      {
        type: "input",
        name: "portRangeStart",
        message: "\u30A2\u30D7\u30EA\u30DD\u30FC\u30C8\u7BC4\u56F2\u958B\u59CB:",
        default: "3000",
        validate: (input) => {
          const port = Number.parseInt(input, 10);
          if (Number.isNaN(port) || port < 1024 || port > 65535) {
            return "\u30DD\u30FC\u30C8\u756A\u53F7\u306F1024\u301C65535\u306E\u7BC4\u56F2\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044";
          }
          return true;
        }
      },
      {
        type: "input",
        name: "rangeSize",
        message: "\u30DD\u30FC\u30C8\u7BC4\u56F2\u30B5\u30A4\u30BA:",
        default: "1000",
        validate: (input) => {
          const size = Number.parseInt(input, 10);
          if (Number.isNaN(size) || size < 1 || size > 1e4) {
            return "\u7BC4\u56F2\u30B5\u30A4\u30BA\u306F1\u301C10000\u306E\u7BC4\u56F2\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044";
          }
          return true;
        }
      }
    ]);
    worktreeConfig = {
      postgres: {
        port: Number.parseInt(worktreeAnswers.postgresPort, 10),
        containerName: worktreeAnswers.containerName
      },
      apps: [
        {
          id: worktreeAnswers.appId,
          portRangeStart: Number.parseInt(worktreeAnswers.portRangeStart, 10),
          rangeSize: Number.parseInt(worktreeAnswers.rangeSize, 10)
        }
      ]
    };
  }
  return {
    projectName: answers.projectName,
    packageScope: answers.packageScope,
    template: "default",
    authMethod: answers.authMethod,
    tools,
    setupEinjaCli: answers.setupEinjaCli,
    worktreeConfig,
    useCurrentDir: answers.useCurrentDir
  };
}

// src/generators/template.ts
import fsExtra from "fs-extra";
import { glob } from "glob";
import { dirname as dirname2, join as join2, relative } from "path";
import { fileURLToPath } from "url";

// src/utils/fs.ts
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
function writeWithStrategy(filePath, content, strategy) {
  const exists = existsSync(filePath);
  if (!exists) {
    ensureDir(dirname(filePath));
    writeFileSync(filePath, content, "utf-8");
    return true;
  }
  switch (strategy) {
    case "overwrite": {
      writeFileSync(filePath, content, "utf-8");
      return true;
    }
    case "merge": {
      const existingContent = readFileSync(filePath, "utf-8");
      const mergedContent = mergeContent(existingContent, content);
      writeFileSync(filePath, mergedContent, "utf-8");
      return true;
    }
    case "skip": {
      return false;
    }
    default: {
      const _exhaustiveCheck = strategy;
      throw new Error(`Unknown strategy: ${_exhaustiveCheck}`);
    }
  }
}
function mergeContent(existing, newContent) {
  if (existing.includes(newContent)) {
    return existing;
  }
  return `${existing}
${newContent}`;
}
function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}
function appendToGitignore(targetDir, line) {
  const gitignorePath = join(targetDir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${line}
`, "utf-8");
    return;
  }
  const content = readFileSync(gitignorePath, "utf-8");
  if (content.includes(line)) {
    return;
  }
  appendFileSync(gitignorePath, `
${line}
`, "utf-8");
}
function fileExists(filePath) {
  return existsSync(filePath);
}

// src/utils/logger.ts
import chalk from "chalk";
function info(message) {
  console.log(chalk.blue("\u2139"), message);
}
function success(message) {
  console.log(chalk.green("\u2714"), message);
}
function warn(message) {
  console.log(chalk.yellow("\u26A0"), message);
}
function error(message) {
  console.error(chalk.red("\u2716"), message);
}

// src/generators/template.ts
var { copySync, readFileSync: readFileSync2, writeFileSync: writeFileSync2, existsSync: existsSync2, removeSync } = fsExtra;
function getTemplatePath(templateName) {
  const __filename3 = fileURLToPath(import.meta.url);
  const __dirname3 = dirname2(__filename3);
  const distPath = join2(__dirname3, "../templates", templateName);
  const srcPath = join2(__dirname3, "../../templates", templateName);
  if (existsSync2(distPath)) {
    return distPath;
  }
  if (existsSync2(srcPath)) {
    return srcPath;
  }
  return distPath;
}
function getAuthExcludePatterns(authMethod) {
  if (authMethod === "none") {
    return [
      "**/api/auth/**",
      "**/packages/auth/**",
      "**/signin/**",
      "**/signup/**"
    ];
  }
  return [];
}
function replacePlaceholders(content, variables) {
  let result = content;
  result = result.replaceAll("{{projectName}}", variables.projectName);
  result = result.replaceAll("{{packageName}}/", `${variables.packageName}/`);
  result = result.replaceAll("{{packageName}}", variables.packageName);
  result = result.replaceAll("{{description}}", variables.description);
  result = result.replaceAll("@repo/", `${variables.packageName}/`);
  return result;
}
function processFileVariables(filePath, variables) {
  const binaryExtensions = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".eot"];
  if (binaryExtensions.some((ext) => filePath.endsWith(ext))) {
    return;
  }
  try {
    const content = readFileSync2(filePath, "utf-8");
    const replaced = replacePlaceholders(content, variables);
    if (content !== replaced) {
      writeFileSync2(filePath, replaced, "utf-8");
    }
  } catch (error2) {
    warn(`\u5909\u6570\u7F6E\u63DB\u3092\u30B9\u30AD\u30C3\u30D7: ${filePath}`);
  }
}
function renameTemplateFiles(targetPath) {
  const templateFiles = glob.sync("**/*.template", {
    cwd: targetPath,
    absolute: true,
    dot: true
  });
  for (const file of templateFiles) {
    const newPath = file.replace(/\.template$/, "");
    copySync(file, newPath);
    removeSync(file);
  }
}
function renameSpecialFiles(targetPath) {
  const gitignoreFiles = glob.sync("**/gitignore", {
    cwd: targetPath,
    absolute: true,
    dot: true
  });
  for (const file of gitignoreFiles) {
    const dir = dirname2(file);
    const newPath = join2(dir, ".gitignore");
    if (existsSync2(file)) {
      copySync(file, newPath);
      removeSync(file);
    }
  }
}
function excludeAuthFiles(targetPath, authMethod) {
  const excludePatterns = getAuthExcludePatterns(authMethod);
  if (excludePatterns.length === 0) {
    return;
  }
  info("\u8A8D\u8A3C\u65B9\u5F0F\u306B\u5FDC\u3058\u305F\u30D5\u30A1\u30A4\u30EB\u3092\u9664\u5916\u4E2D...");
  for (const pattern of excludePatterns) {
    const files = glob.sync(pattern, {
      cwd: targetPath,
      absolute: true,
      dot: true
    });
    for (const file of files) {
      removeSync(file);
    }
  }
}
async function generateTemplate(config, targetPath) {
  const templatePath = getTemplatePath(config.template);
  if (!existsSync2(templatePath)) {
    throw new Error(`\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ${config.template}`);
  }
  info("\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u3092\u30B3\u30D4\u30FC\u4E2D...");
  await ensureDir(targetPath);
  copySync(templatePath, targetPath, {
    filter: (src) => {
      const relativePath = relative(templatePath, src);
      const excludePatterns = [
        "node_modules",
        ".git",
        ".next",
        ".turbo",
        "out",
        "dist",
        "logs",
        ".env",
        // フェイルセーフ（暗号化キーファイル）
        ".DS_Store",
        "Thumbs.db",
        "coverage"
      ];
      const excludeExtensions = [".log"];
      const pathSegments = relativePath.split(/[/\\]/);
      const matchesExcludePattern = excludePatterns.some(
        (pattern) => pathSegments.includes(pattern)
      );
      const matchesExtension = excludeExtensions.some(
        (ext) => relativePath.endsWith(ext)
      );
      return !matchesExcludePattern && !matchesExtension;
    }
  });
  excludeAuthFiles(targetPath, config.authMethod);
  renameTemplateFiles(targetPath);
  renameSpecialFiles(targetPath);
  info("\u30D7\u30EC\u30FC\u30B9\u30DB\u30EB\u30C0\u30FC\u5909\u6570\u3092\u7F6E\u63DB\u4E2D...");
  const variables = {
    projectName: config.projectName,
    packageName: config.packageScope,
    description: `${config.projectName} - Einja Management Template`
  };
  const allFiles = glob.sync("**/*", {
    cwd: targetPath,
    absolute: true,
    nodir: true,
    dot: true
  });
  for (const file of allFiles) {
    processFileVariables(file, variables);
  }
  success("\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u5C55\u958B\u5B8C\u4E86");
}

// src/generators/post-setup.ts
import { execa, execaSync } from "execa";
import chalk2 from "chalk";
import inquirer2 from "inquirer";
import ora from "ora";
function isDirenvAvailable() {
  try {
    execaSync("which", ["direnv"]);
    return true;
  } catch {
    return false;
  }
}
async function promptAndExecuteDirenvAllow(targetPath) {
  try {
    const { shouldAllow } = await inquirer2.prompt([
      {
        type: "confirm",
        name: "shouldAllow",
        message: "direnv allow \u3092\u5B9F\u884C\u3057\u307E\u3059\u304B\uFF1F\uFF08\u74B0\u5883\u5909\u6570\u3092\u6709\u52B9\u5316\u3057\u307E\u3059\uFF09",
        default: true
      }
    ]);
    if (shouldAllow) {
      try {
        await execa("direnv", ["allow"], { cwd: targetPath });
        success("direnv allow \u3092\u5B9F\u884C\u3057\u307E\u3057\u305F");
      } catch (error2) {
        warn("direnv allow \u306E\u5B9F\u884C\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        info("\u5F8C\u3067\u624B\u52D5\u3067 'direnv allow' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
      }
    } else {
      info("direnv allow \u3092\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F");
      info("\u5F8C\u3067\u624B\u52D5\u3067 'direnv allow' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  } catch (error2) {
    info("direnv allow \u3092\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F");
  }
}
function printCompletionMessage(config) {
  console.log();
  success("\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u4F5C\u6210\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\uFF01");
  console.log();
  console.log(chalk2.bold("\u6B21\u306E\u30B9\u30C6\u30C3\u30D7:"));
  console.log();
  console.log(chalk2.cyan(`  cd ${config.projectName}`));
  console.log(chalk2.cyan("  pnpm env:update          # \u74B0\u5883\u5909\u6570\u3092\u8A2D\u5B9A"));
  console.log(chalk2.cyan("  docker-compose up -d postgres"));
  console.log(chalk2.cyan("  pnpm dev"));
  console.log();
  console.log(chalk2.gray("\u958B\u767A\u30B5\u30FC\u30D0\u30FC: \u30BF\u30FC\u30DF\u30CA\u30EB\u306B\u8868\u793A\u3055\u308C\u308BURL\u3092\u78BA\u8A8D"));
  console.log();
  console.log(
    chalk2.yellow("\u26A0 \u91CD\u8981: ") + chalk2.gray("pnpm env:update \u3067\u74B0\u5883\u5909\u6570\u3092\u81EA\u5206\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u7528\u306B\u518D\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044")
  );
  console.log();
  console.log(chalk2.gray("\u8A73\u7D30\u306F README.md \u3092\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\u3002"));
  console.log();
}
async function execPostSetup(config, targetPath, options) {
  const { skipGit, skipInstall } = options;
  if (!skipGit) {
    const gitSpinner = ora("Git\u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u521D\u671F\u5316\u4E2D...").start();
    try {
      await execa("git", ["init"], { cwd: targetPath });
      await execa("git", ["add", "."], { cwd: targetPath });
      await execa("git", ["commit", "-m", "Initial commit"], { cwd: targetPath });
      gitSpinner.succeed("Git\u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u521D\u671F\u5316\u3057\u307E\u3057\u305F");
    } catch (error2) {
      gitSpinner.fail("Git\u30EA\u30DD\u30B8\u30C8\u30EA\u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      warn("\u5F8C\u3067\u624B\u52D5\u3067 'git init' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  }
  if (!skipInstall) {
    const installSpinner = ora("\u4F9D\u5B58\u95A2\u4FC2\u3092\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u4E2D...").start();
    try {
      await execa("pnpm", ["install"], { cwd: targetPath });
      installSpinner.succeed("\u4F9D\u5B58\u95A2\u4FC2\u3092\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u3057\u307E\u3057\u305F");
      const prismaSpinner = ora("Prisma\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u3092\u751F\u6210\u4E2D...").start();
      try {
        await execa("pnpm", ["db:generate"], { cwd: targetPath });
        prismaSpinner.succeed("Prisma\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u3092\u751F\u6210\u3057\u307E\u3057\u305F");
      } catch (error2) {
        prismaSpinner.fail("Prisma\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u306E\u751F\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        warn("\u5F8C\u3067\u624B\u52D5\u3067 'pnpm db:generate' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
      }
    } catch (error2) {
      installSpinner.fail("\u4F9D\u5B58\u95A2\u4FC2\u306E\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      warn("\u5F8C\u3067\u624B\u52D5\u3067 'pnpm install' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  }
  if (config.tools.direnv && isDirenvAvailable()) {
    await promptAndExecuteDirenvAllow(targetPath);
  }
  if (config.setupEinjaCli) {
    const einjaSpinner = ora("@einja/dev-cli \u3092\u521D\u671F\u5316\u4E2D...").start();
    try {
      await execa("npx", ["@einja/dev-cli", "init", "--force", "--no-backup"], { cwd: targetPath });
      einjaSpinner.succeed("@einja/dev-cli \u3092\u521D\u671F\u5316\u3057\u307E\u3057\u305F");
    } catch (error2) {
      einjaSpinner.fail("@einja/dev-cli \u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      warn("\u5F8C\u3067\u624B\u52D5\u3067 'npx @einja/dev-cli init' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  }
  printCompletionMessage(config);
}

// src/commands/create.ts
function isDirectoryEmpty(dirPath) {
  if (!existsSync3(dirPath)) {
    return true;
  }
  const files = readdirSync(dirPath);
  const significantFiles = files.filter(
    (f) => !f.startsWith(".")
  );
  return significantFiles.length === 0;
}
function validateProjectName(projectName) {
  const regex = /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/;
  if (!regex.test(projectName)) {
    return "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D\u306F\u82F1\u5B57\u3067\u59CB\u307E\u308A\u3001\u82F1\u6570\u5B57\u30FB\u30CF\u30A4\u30D5\u30F3\u30FB\u30A2\u30F3\u30C0\u30FC\u30B9\u30B3\u30A2\u306E\u307F\u4F7F\u7528\u3067\u304D\u307E\u3059\uFF081\u301C50\u6587\u5B57\uFF09";
  }
  return void 0;
}
function checkProjectExists(targetPath) {
  return existsSync3(targetPath);
}
async function createCommand(projectName, options) {
  try {
    let config;
    if (options.yes && projectName) {
      const error2 = validateProjectName(projectName);
      if (error2) {
        error(error2);
        process.exit(1);
      }
      config = {
        projectName,
        packageScope: "@repo",
        template: "default",
        authMethod: "default",
        tools: {
          direnv: true,
          dotenvx: true,
          volta: true,
          biome: true,
          husky: true
        },
        setupEinjaCli: true,
        worktreeConfig: void 0,
        useCurrentDir: false
      };
      info(`\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D: ${config.projectName}`);
      info(`\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8: ${config.template}`);
      info(`\u8A8D\u8A3C\u65B9\u5F0F: ${config.authMethod}`);
    } else {
      config = await promptProjectConfig(projectName);
    }
    const targetPath = config.useCurrentDir ? process.cwd() : resolve(process.cwd(), config.projectName);
    if (config.useCurrentDir) {
      if (!isDirectoryEmpty(targetPath)) {
        error("\u73FE\u5728\u306E\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u306B\u30D5\u30A1\u30A4\u30EB\u304C\u5B58\u5728\u3057\u307E\u3059");
        info("\u7A7A\u306E\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3067\u5B9F\u884C\u3059\u308B\u304B\u3001\u30B5\u30D6\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3092\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044");
        process.exit(1);
      }
    } else {
      if (checkProjectExists(targetPath)) {
        error(`\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA '${config.projectName}' \u306F\u65E2\u306B\u5B58\u5728\u3057\u307E\u3059`);
        info("\u5225\u306E\u540D\u524D\u3092\u6307\u5B9A\u3059\u308B\u304B\u3001\u65E2\u5B58\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3092\u524A\u9664\u3057\u3066\u304F\u3060\u3055\u3044");
        process.exit(1);
      }
    }
    const spinner = ora2("\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u4F5C\u6210\u4E2D...").start();
    try {
      await generateTemplate(config, targetPath);
      spinner.succeed("\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F");
    } catch (error2) {
      spinner.fail("\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      throw error2;
    }
    await execPostSetup(config, targetPath, {
      skipGit: options.skipGit,
      skipInstall: options.skipInstall
    });
  } catch (error2) {
    error("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F:");
    if (error2 instanceof Error) {
      error(error2.message);
    } else {
      error(String(error2));
    }
    process.exit(1);
  }
}

// src/commands/setup.ts
import { existsSync as existsSync4 } from "fs";
import { join as join9 } from "path";
import ora3 from "ora";

// src/prompts/setup.ts
import inquirer3 from "inquirer";
async function promptSetupConfig() {
  const answers = await inquirer3.prompt([
    {
      type: "checkbox",
      name: "tools",
      message: "\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u3059\u308B\u30C4\u30FC\u30EB\u3092\u9078\u629E\uFF08\u8907\u6570\u9078\u629E\u53EF\uFF09:",
      choices: [
        {
          name: "direnv\uFF08\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3054\u3068\u306E\u74B0\u5883\u5909\u6570\u7BA1\u7406\uFF09",
          value: "direnv",
          checked: true
        },
        {
          name: "dotenvx\uFF08.env\u6697\u53F7\u5316\uFF09",
          value: "dotenvx",
          checked: true
        },
        {
          name: "Volta\uFF08Node.js\u30D0\u30FC\u30B8\u30E7\u30F3\u7BA1\u7406\uFF09",
          value: "volta",
          checked: true
        },
        {
          name: "Biome\uFF08Linter / Formatter\uFF09",
          value: "biome",
          checked: false
        },
        {
          name: "Husky + lint-staged\uFF08Git hooks\uFF09",
          value: "husky",
          checked: false
        }
      ]
    },
    {
      type: "list",
      name: "conflictStrategy",
      message: "\u65E2\u5B58\u30D5\u30A1\u30A4\u30EB\u304C\u3042\u308B\u5834\u5408\u306E\u52D5\u4F5C:",
      choices: [
        {
          name: "\u30DE\u30FC\u30B8\uFF08\u65E2\u5B58\u8A2D\u5B9A\u3092\u4FDD\u6301\u3057\u3064\u3064\u8FFD\u52A0\uFF09",
          value: "merge"
        },
        {
          name: "\u4E0A\u66F8\u304D",
          value: "overwrite"
        },
        {
          name: "\u30B9\u30AD\u30C3\u30D7",
          value: "skip"
        }
      ],
      default: "merge"
    }
  ]);
  const toolsArray = answers.tools;
  const tools = {
    direnv: toolsArray.includes("direnv"),
    dotenvx: toolsArray.includes("dotenvx"),
    volta: toolsArray.includes("volta"),
    biome: toolsArray.includes("biome"),
    husky: toolsArray.includes("husky")
  };
  return {
    tools,
    conflictStrategy: answers.conflictStrategy
  };
}

// src/generators/tools/direnv.ts
import { join as join3 } from "path";
import { execSync } from "child_process";
import inquirer4 from "inquirer";
var ENVRC_CONTENT = `# direnv configuration
# Load .env if it exists
dotenv_if_exists

# Allow local overrides
dotenv_if_exists .env.local
`;
var ENVRC_EXAMPLE_CONTENT = `# Example direnv configuration
# Copy this file to .envrc and run 'direnv allow'

# Load environment variables from .env
dotenv_if_exists

# Load local overrides
dotenv_if_exists .env.local
`;
function setupDirenv(options) {
  const { targetDir, conflictStrategy } = options;
  const envrcPath = join3(targetDir, ".envrc");
  const envrcExamplePath = join3(targetDir, ".envrc.example");
  writeWithStrategy(envrcPath, ENVRC_CONTENT, conflictStrategy);
  writeWithStrategy(envrcExamplePath, ENVRC_EXAMPLE_CONTENT, conflictStrategy);
  appendToGitignore(targetDir, ".envrc");
}
async function promptDirenvAllow(targetDir) {
  try {
    const { shouldAllow } = await inquirer4.prompt([
      {
        type: "confirm",
        name: "shouldAllow",
        message: "direnv allow \u3092\u5B9F\u884C\u3057\u307E\u3059\u304B\uFF1F\uFF08\u74B0\u5883\u5909\u6570\u3092\u6709\u52B9\u5316\u3057\u307E\u3059\uFF09",
        default: true
      }
    ]);
    if (shouldAllow) {
      try {
        execSync("direnv allow", { cwd: targetDir, stdio: "inherit" });
        success("direnv allow \u3092\u5B9F\u884C\u3057\u307E\u3057\u305F");
      } catch (error2) {
        warn("direnv allow \u306E\u5B9F\u884C\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        info("\u5F8C\u3067\u624B\u52D5\u3067 'direnv allow' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
      }
    } else {
      info("direnv allow \u3092\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F");
      info("\u5F8C\u3067\u624B\u52D5\u3067 'direnv allow' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  } catch (error2) {
    info("direnv allow \u3092\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F");
  }
}

// src/generators/tools/dotenvx.ts
import { join as join5 } from "path";

// src/utils/package-json.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "fs";
import { join as join4 } from "path";
function readPackageJson(targetDir) {
  const packageJsonPath2 = join4(targetDir, "package.json");
  if (!fileExists(packageJsonPath2)) {
    return {};
  }
  const content = readFileSync3(packageJsonPath2, "utf-8");
  return JSON.parse(content);
}
function writePackageJson(targetDir, data) {
  const packageJsonPath2 = join4(targetDir, "package.json");
  const content = JSON.stringify(data, null, 2);
  writeFileSync3(packageJsonPath2, `${content}
`, "utf-8");
}
function addScripts(targetDir, scripts) {
  const pkg = readPackageJson(targetDir);
  pkg.scripts = { ...pkg.scripts, ...scripts };
  writePackageJson(targetDir, pkg);
}
function addDependencies(targetDir, dependencies, dev = false) {
  const pkg = readPackageJson(targetDir);
  if (dev) {
    pkg.devDependencies = { ...pkg.devDependencies, ...dependencies };
  } else {
    pkg.dependencies = { ...pkg.dependencies, ...dependencies };
  }
  writePackageJson(targetDir, pkg);
}
function addVoltaField(targetDir, nodeVersion, pnpmVersion) {
  const pkg = readPackageJson(targetDir);
  pkg.volta = {
    node: nodeVersion,
    pnpm: pnpmVersion
  };
  writePackageJson(targetDir, pkg);
}
function addLintStaged(targetDir, config) {
  const pkg = readPackageJson(targetDir);
  pkg["lint-staged"] = { ...pkg["lint-staged"], ...config };
  writePackageJson(targetDir, pkg);
}

// src/generators/tools/dotenvx.ts
var ENV_EXAMPLE_CONTENT = `# Environment variables template
# Copy this file to .env and fill in the values

# Database
DATABASE_URL="postgresql://user:password@localhost:25432/dbname"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# OAuth (if using)
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
# GITHUB_CLIENT_ID=""
# GITHUB_CLIENT_SECRET=""
`;
function setupDotenvx(options) {
  const { targetDir, conflictStrategy } = options;
  addDependencies(targetDir, {
    "@dotenvx/dotenvx": "^1.29.0"
  });
  addScripts(targetDir, {
    "env:encrypt": "dotenvx encrypt",
    "env:decrypt": "dotenvx decrypt"
  });
  const envExamplePath = join5(targetDir, ".env.example");
  writeWithStrategy(envExamplePath, ENV_EXAMPLE_CONTENT, conflictStrategy);
}

// src/generators/tools/volta.ts
import { join as join6 } from "path";
var NODE_VERSION = "22.16.0";
var PNPM_VERSION = "9.15.0";
var NODE_VERSION_CONTENT = `${NODE_VERSION}
`;
function setupVolta(options) {
  const { targetDir, conflictStrategy } = options;
  addVoltaField(targetDir, NODE_VERSION, PNPM_VERSION);
  const nodeVersionPath = join6(targetDir, ".node-version");
  writeWithStrategy(nodeVersionPath, NODE_VERSION_CONTENT, conflictStrategy);
}

// src/generators/tools/biome.ts
import { join as join7 } from "path";
var BIOME_CONFIG = `{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "ignore": ["node_modules", "dist", ".next", "out", "build", "coverage"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineEnding": "lf",
    "lineWidth": 100
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "es5",
      "semicolons": "always",
      "arrowParentheses": "always"
    }
  }
}
`;
var VSCODE_SETTINGS = `{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
`;
function setupBiome(options) {
  const { targetDir, conflictStrategy } = options;
  const biomeConfigPath = join7(targetDir, "biome.json");
  writeWithStrategy(biomeConfigPath, BIOME_CONFIG, conflictStrategy);
  addDependencies(
    targetDir,
    {
      "@biomejs/biome": "^1.9.4"
    },
    true
  );
  addScripts(targetDir, {
    lint: "biome lint .",
    "lint:fix": "biome lint --write .",
    format: "biome format .",
    "format:fix": "biome format --write ."
  });
  const vscodeDir = join7(targetDir, ".vscode");
  ensureDir(vscodeDir);
  const vscodeSettingsPath = join7(vscodeDir, "settings.json");
  writeWithStrategy(vscodeSettingsPath, VSCODE_SETTINGS, conflictStrategy);
}

// src/generators/tools/husky.ts
import { join as join8 } from "path";
import { writeFileSync as writeFileSync4 } from "fs";
var PRE_COMMIT_HOOK = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
`;
function setupHusky(options) {
  const { targetDir } = options;
  addDependencies(
    targetDir,
    {
      husky: "^9.1.7",
      "lint-staged": "^15.2.11"
    },
    true
  );
  addScripts(targetDir, {
    prepare: "husky"
  });
  addLintStaged(targetDir, {
    "*.{js,jsx,ts,tsx}": ["biome format --write", "biome lint --write"],
    "*.{json,md,yml,yaml}": ["biome format --write"]
  });
  const huskyDir = join8(targetDir, ".husky");
  ensureDir(huskyDir);
  const preCommitPath = join8(huskyDir, "pre-commit");
  writeFileSync4(preCommitPath, PRE_COMMIT_HOOK, { mode: 493 });
}

// src/commands/setup.ts
async function setupCommand() {
  const targetDir = process.cwd();
  const packageJsonPath2 = join9(targetDir, "package.json");
  if (!existsSync4(packageJsonPath2)) {
    error("\u30A8\u30E9\u30FC: package.json\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
    info("\u3053\u306E\u30B3\u30DE\u30F3\u30C9\u306F\u65E2\u5B58\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3067\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
    process.exit(1);
  }
  info("\u65E2\u5B58\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3078\u306E\u30C4\u30FC\u30EB\u8FFD\u52A0\u3092\u958B\u59CB\u3057\u307E\u3059");
  info("");
  const config = await promptSetupConfig();
  info("");
  info("\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u3092\u958B\u59CB\u3057\u307E\u3059...");
  info("");
  const options = {
    targetDir,
    conflictStrategy: config.conflictStrategy
  };
  let setupCount = 0;
  if (config.tools.direnv) {
    const spin = ora3("direnv \u3092\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u3057\u3066\u3044\u307E\u3059...").start();
    try {
      setupDirenv(options);
      spin.succeed("direnv \u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5B8C\u4E86");
      setupCount++;
    } catch (error2) {
      spin.fail("direnv \u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5931\u6557");
      error(
        error2 instanceof Error ? error2.message : "\u4E88\u671F\u3057\u306A\u3044\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F"
      );
    }
  }
  if (config.tools.dotenvx) {
    const spin = ora3("dotenvx \u3092\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u3057\u3066\u3044\u307E\u3059...").start();
    try {
      setupDotenvx(options);
      spin.succeed("dotenvx \u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5B8C\u4E86");
      setupCount++;
    } catch (error2) {
      spin.fail("dotenvx \u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5931\u6557");
      error(
        error2 instanceof Error ? error2.message : "\u4E88\u671F\u3057\u306A\u3044\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F"
      );
    }
  }
  if (config.tools.volta) {
    const spin = ora3("Volta \u3092\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u3057\u3066\u3044\u307E\u3059...").start();
    try {
      setupVolta(options);
      spin.succeed("Volta \u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5B8C\u4E86");
      setupCount++;
    } catch (error2) {
      spin.fail("Volta \u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5931\u6557");
      error(
        error2 instanceof Error ? error2.message : "\u4E88\u671F\u3057\u306A\u3044\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F"
      );
    }
  }
  if (config.tools.biome) {
    const spin = ora3("Biome \u3092\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u3057\u3066\u3044\u307E\u3059...").start();
    try {
      setupBiome(options);
      spin.succeed("Biome \u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5B8C\u4E86");
      setupCount++;
    } catch (error2) {
      spin.fail("Biome \u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5931\u6557");
      error(
        error2 instanceof Error ? error2.message : "\u4E88\u671F\u3057\u306A\u3044\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F"
      );
    }
  }
  if (config.tools.husky) {
    const spin = ora3("Husky \u3092\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u3057\u3066\u3044\u307E\u3059...").start();
    try {
      setupHusky(options);
      spin.succeed("Husky \u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5B8C\u4E86");
      setupCount++;
    } catch (error2) {
      spin.fail("Husky \u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u5931\u6557");
      error(
        error2 instanceof Error ? error2.message : "\u4E88\u671F\u3057\u306A\u3044\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F"
      );
    }
  }
  info("");
  if (config.tools.direnv) {
    await promptDirenvAllow(targetDir);
    info("");
  }
  success(`\u2705 \u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\uFF01\uFF08${setupCount}\u500B\u306E\u30C4\u30FC\u30EB\uFF09`);
  info("");
  info("\u6B21\u306E\u30B9\u30C6\u30C3\u30D7:");
  if (config.tools.direnv) {
    info("  1. .envrc \u3092\u7DE8\u96C6\u3057\u3066\u74B0\u5883\u5909\u6570\u3092\u8A2D\u5B9A");
    info("  2. direnv allow \u3092\u5B9F\u884C\uFF08\u307E\u3060\u306E\u5834\u5408\uFF09");
  }
  if (config.tools.dotenvx) {
    info("  - .env.example \u3092\u30B3\u30D4\u30FC\u3057\u3066 .env \u3092\u4F5C\u6210");
    info("  - \u5FC5\u8981\u306B\u5FDC\u3058\u3066 pnpm env:encrypt \u3067\u6697\u53F7\u5316");
  }
  if (config.tools.biome) {
    info("  - pnpm lint \u3067\u30B3\u30FC\u30C9\u3092\u30C1\u30A7\u30C3\u30AF");
    info("  - pnpm format:fix \u3067\u30D5\u30A9\u30FC\u30DE\u30C3\u30C8");
  }
  if (config.tools.husky) {
    info("  - pnpm install \u3067Husky\u30D5\u30C3\u30AF\u3092\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB");
  }
  info("");
  success("\u958B\u767A\u3092\u958B\u59CB\u3067\u304D\u307E\u3059\uFF01");
}

// src/commands/add.ts
import { existsSync as existsSync6 } from "fs";
import { readFile as readFile2 } from "fs/promises";
import { dirname as dirname4, join as join13 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import ora4 from "ora";

// src/prompts/add.ts
import inquirer5 from "inquirer";
function getDefaultAddConfig() {
  return {
    components: {
      packages: true,
      apps: true,
      config: true
    },
    packageComponents: ["front-core", "server-core", "config", "ui"],
    appComponents: ["web"],
    dryRun: false
  };
}
async function promptAddConfig(dryRun) {
  const componentAnswers = await inquirer5.prompt([
    {
      type: "checkbox",
      name: "components",
      message: "\u8FFD\u52A0\u3059\u308B\u30B3\u30F3\u30DD\u30FC\u30CD\u30F3\u30C8\u3092\u9078\u629E\uFF08Space\u3067\u9078\u629E\u3001Enter\u3067\u78BA\u5B9A\uFF09:",
      choices: [
        {
          name: "packages/ - \u5171\u901A\u30D1\u30C3\u30B1\u30FC\u30B8\uFF08front-core, server-core, config, ui\uFF09",
          value: "packages",
          checked: true
        },
        {
          name: "apps/ - \u30A2\u30D7\u30EA\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8",
          value: "apps",
          checked: true
        },
        {
          name: "\u76F4\u4E0B\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB - turbo.json, pnpm-workspace.yaml \u7B49",
          value: "config",
          checked: true
        }
      ]
    }
  ]);
  const selectedComponents = componentAnswers.components;
  const hasPackages = selectedComponents.includes("packages");
  const hasApps = selectedComponents.includes("apps");
  const hasConfig = selectedComponents.includes("config");
  let packageComponents = [];
  if (hasPackages) {
    const packageAnswers = await inquirer5.prompt([
      {
        type: "checkbox",
        name: "packages",
        message: "\u8FFD\u52A0\u3059\u308B\u30D1\u30C3\u30B1\u30FC\u30B8\u3092\u9078\u629E:",
        choices: [
          {
            name: "front-core - \u30D5\u30ED\u30F3\u30C8\u30A8\u30F3\u30C9\u5171\u901A\u5C64\uFF08\u8A8D\u8A3C\u8A2D\u5B9A\u3001hooks\u3001utils\uFF09",
            value: "front-core",
            checked: true
          },
          {
            name: "server-core - \u30D0\u30C3\u30AF\u30A8\u30F3\u30C9\u5171\u901A\u5C64\uFF08Prisma\u3001\u30C9\u30E1\u30A4\u30F3\u30ED\u30B8\u30C3\u30AF\uFF09",
            value: "server-core",
            checked: true
          },
          {
            name: "config - \u5171\u901A\u8A2D\u5B9A\uFF08Biome, TypeScript, Panda CSS\uFF09",
            value: "config",
            checked: true
          },
          {
            name: "ui - \u5171\u901AUI\u30B3\u30F3\u30DD\u30FC\u30CD\u30F3\u30C8\uFF08shadcn/ui\uFF09",
            value: "ui",
            checked: true
          }
        ],
        validate: (input) => {
          if (input.length === 0) {
            return "\u5C11\u306A\u304F\u3068\u30821\u3064\u306E\u30D1\u30C3\u30B1\u30FC\u30B8\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044";
          }
          return true;
        }
      }
    ]);
    packageComponents = packageAnswers.packages;
  }
  let appComponents = [];
  if (hasApps) {
    const appAnswers = await inquirer5.prompt([
      {
        type: "checkbox",
        name: "apps",
        message: "\u8FFD\u52A0\u3059\u308B\u30A2\u30D7\u30EA\u3092\u9078\u629E:",
        choices: [
          {
            name: "web - \u30E1\u30A4\u30F3\u7BA1\u7406\u753B\u9762\u30A2\u30D7\u30EA\uFF08Next.js + App Router\uFF09",
            value: "web",
            checked: true
          }
        ],
        validate: (input) => {
          if (input.length === 0) {
            return "\u5C11\u306A\u304F\u3068\u30821\u3064\u306E\u30A2\u30D7\u30EA\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044";
          }
          return true;
        }
      }
    ]);
    appComponents = appAnswers.apps;
  }
  return {
    components: {
      packages: hasPackages,
      apps: hasApps,
      config: hasConfig
    },
    packageComponents,
    appComponents,
    dryRun
  };
}

// src/generators/partials/packages.ts
import { readdir } from "fs/promises";
import { join as join10 } from "path";

// src/utils/merger.ts
import { readFileSync as readFileSync4, writeFileSync as writeFileSync5, existsSync as existsSync5 } from "fs";
import { dirname as dirname3 } from "path";
function mergeTextWithMarkers(templateContent, existingContent) {
  if (existingContent === null) {
    return templateContent;
  }
  const templateSections = parseMarkers(templateContent);
  const localSections = parseMarkers(existingContent);
  const hasMarkers = templateSections.some(
    (s) => s.type === "managed" || s.type === "seed"
  );
  if (!hasMarkers) {
    return existingContent;
  }
  const templateManagedById = /* @__PURE__ */ new Map();
  const templateSeedById = /* @__PURE__ */ new Map();
  const processedTemplateIds = /* @__PURE__ */ new Set();
  for (const section of templateSections) {
    if (section.type === "managed" && section.id) {
      templateManagedById.set(section.id, section);
    } else if (section.type === "seed" && section.id) {
      templateSeedById.set(section.id, section);
    }
  }
  const result = [];
  for (const localSection of localSections) {
    if (localSection.type === "managed") {
      const match = localSection.id ? templateManagedById.get(localSection.id) : void 0;
      if (localSection.id && match) {
        processedTemplateIds.add(localSection.id);
        result.push(match.content);
      } else if (!localSection.id) {
        result.push(localSection.content);
      }
    } else if (localSection.type === "seed") {
      if (localSection.id) {
        processedTemplateIds.add(localSection.id);
      }
      result.push(localSection.content);
    } else {
      result.push(localSection.content);
    }
  }
  for (const [id, section] of templateManagedById) {
    if (!processedTemplateIds.has(id)) {
      result.push(section.content);
    }
  }
  for (const [id, section] of templateSeedById) {
    if (!processedTemplateIds.has(id)) {
      result.push(section.content);
    }
  }
  const firstElement = result[0];
  if (result.length > 0 && firstElement !== void 0 && firstElement.length === 0) {
    result.shift();
  }
  return result.join("\n");
}
function mergeJson(templateJson, existingJson, jsonPaths, filePath = "package.json") {
  if (existingJson === null) {
    return JSON.parse(JSON.stringify(templateJson));
  }
  return deepMergeWithPaths(
    templateJson,
    existingJson,
    jsonPaths,
    filePath,
    ""
  );
}
function deepMergeWithPaths(template, existing, jsonPaths, filePath, currentPath) {
  const result = JSON.parse(JSON.stringify(existing));
  for (const [key, templateValue] of Object.entries(template)) {
    const keyPath = currentPath ? `${currentPath}.${key}` : key;
    const existingValue = existing[key];
    if (isPathManaged(filePath, keyPath, jsonPaths)) {
      result[key] = deepClone(templateValue);
    } else if (isPathSeed(filePath, keyPath, jsonPaths)) {
      if (typeof templateValue === "object" && templateValue !== null && !Array.isArray(templateValue) && typeof existingValue === "object" && existingValue !== null && !Array.isArray(existingValue)) {
        result[key] = deepMergeWithPaths(
          templateValue,
          existingValue,
          jsonPaths,
          filePath,
          keyPath
        );
      } else if (!(key in existing)) {
        result[key] = deepClone(templateValue);
      }
    } else if (typeof templateValue === "object" && templateValue !== null && !Array.isArray(templateValue) && typeof existingValue === "object" && existingValue !== null && !Array.isArray(existingValue)) {
      result[key] = deepMergeWithPaths(
        templateValue,
        existingValue,
        jsonPaths,
        filePath,
        keyPath
      );
    } else if (!(key in existing)) {
      result[key] = deepClone(templateValue);
    }
  }
  return result;
}
function deepClone(value) {
  if (value === void 0) {
    return void 0;
  }
  return JSON.parse(JSON.stringify(value));
}
async function loadSyncMetadata(targetDir) {
  const metadataPath = `${targetDir}/.einja-sync.json`;
  if (!existsSync5(metadataPath)) {
    return null;
  }
  try {
    const content = readFileSync4(metadataPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
async function saveSyncMetadata(targetDir, metadata) {
  const metadataPath = `${targetDir}/.einja-sync.json`;
  ensureDir(dirname3(metadataPath));
  writeFileSync5(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
}
async function mergeAndWriteFile(templatePath, targetPath, syncMetadata) {
  const templateContent = readFileSync4(templatePath, "utf-8");
  const targetExists = existsSync5(targetPath);
  const existingContent = targetExists ? readFileSync4(targetPath, "utf-8") : null;
  const isJsonFile = targetPath.endsWith(".json");
  let mergedContent;
  let action;
  if (!targetExists) {
    mergedContent = templateContent;
    action = "created";
  } else if (isJsonFile) {
    try {
      const templateJson = JSON.parse(templateContent);
      const existingJson = existingContent ? JSON.parse(existingContent) : null;
      const jsonPaths = syncMetadata.jsonPaths || { managed: {}, seed: {} };
      const fileName = targetPath.split("/").pop() || "package.json";
      const mergedJson = mergeJson(templateJson, existingJson, jsonPaths, fileName);
      mergedContent = JSON.stringify(mergedJson, null, 2);
      action = "merged";
    } catch {
      mergedContent = templateContent;
      action = "overwritten";
    }
  } else {
    mergedContent = mergeTextWithMarkers(templateContent, existingContent);
    if (mergedContent === existingContent) {
      action = "skipped";
    } else {
      action = "merged";
    }
  }
  if (action !== "skipped") {
    ensureDir(dirname3(targetPath));
    writeFileSync5(targetPath, mergedContent, "utf-8");
  }
  return { action, path: targetPath };
}
function parseMarkers(content) {
  const lines = content.split("\n");
  const sections = [];
  let currentType = "unmanaged";
  let currentStartLine = 1;
  let currentContent = [];
  let currentId;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const startMarker = parseStartMarker(line);
    if (startMarker) {
      if (currentType !== "unmanaged") {
        currentContent.push(line);
        continue;
      }
      if (currentContent.length > 0 || sections.length === 0) {
        sections.push({
          type: "unmanaged",
          startLine: currentStartLine,
          endLine: lineNumber - 1,
          content: currentContent.join("\n")
        });
      }
      currentType = startMarker.type;
      currentId = startMarker.id;
      currentStartLine = lineNumber;
      currentContent = [line];
    } else if (parseEndMarker(line)) {
      if (currentType === "unmanaged") {
        currentContent.push(line);
        continue;
      }
      currentContent.push(line);
      sections.push({
        type: currentType,
        startLine: currentStartLine,
        endLine: lineNumber,
        content: currentContent.join("\n"),
        id: currentId
      });
      currentType = "unmanaged";
      currentId = void 0;
      currentStartLine = lineNumber + 1;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0 || sections.length === 0) {
    sections.push({
      type: currentType,
      startLine: currentStartLine,
      endLine: lines.length,
      content: currentContent.join("\n"),
      id: currentId
    });
  }
  return sections;
}
function parseStartMarker(line) {
  const markdownManagedPattern = /^<!--\s*@einja:managed:start(?:\s+id="([^"]+)")?\s*-->$/;
  let match = line.match(markdownManagedPattern);
  if (match) {
    return { type: "managed", id: match[1] || void 0 };
  }
  const markdownSeedPattern = /^<!--\s*@einja:seed:start(?:\s+id="([^"]+)")?\s*-->$/;
  match = line.match(markdownSeedPattern);
  if (match) {
    return { type: "seed", id: match[1] || void 0 };
  }
  const yamlManagedPattern = /^\s*#\s*@einja:managed:start(?:\s+id="([^"]+)")?\s*$/;
  match = line.match(yamlManagedPattern);
  if (match) {
    return { type: "managed", id: match[1] || void 0 };
  }
  const yamlSeedPattern = /^\s*#\s*@einja:seed:start(?:\s+id="([^"]+)")?\s*$/;
  match = line.match(yamlSeedPattern);
  if (match) {
    return { type: "seed", id: match[1] || void 0 };
  }
  return null;
}
function parseEndMarker(line) {
  if (/^<!--\s*@einja:managed:end\s*-->$/.test(line)) {
    return "managed";
  }
  if (/^<!--\s*@einja:seed:end\s*-->$/.test(line)) {
    return "seed";
  }
  if (/^\s*#\s*@einja:managed:end\s*$/.test(line)) {
    return "managed";
  }
  if (/^\s*#\s*@einja:seed:end\s*$/.test(line)) {
    return "seed";
  }
  return null;
}
function isPathManaged(filePath, keyPath, jsonPaths) {
  const managedPaths = jsonPaths.managed[filePath] || [];
  return managedPaths.some(
    (p) => keyPath === p || keyPath.startsWith(`${p}.`)
  );
}
function isPathSeed(filePath, keyPath, jsonPaths) {
  const seedPaths = jsonPaths.seed[filePath] || [];
  return seedPaths.some((p) => keyPath === p || keyPath.startsWith(`${p}.`));
}

// src/generators/partials/packages.ts
async function addPackages(options, components, syncMetadata) {
  const added = [];
  const skipped = [];
  const merged = [];
  const { targetDir, templateDir, config } = options;
  for (const component of components) {
    const componentName = component === "front-core" ? "front-core" : component === "server-core" ? "server-core" : component === "config" ? "config" : "ui";
    const srcDir = join10(templateDir, "packages", componentName);
    const destDir = join10(targetDir, "packages", componentName);
    info(`Adding package component: ${componentName}`);
    await copyDirectory(
      srcDir,
      destDir,
      { added, skipped, merged },
      config.dryRun,
      syncMetadata
    );
  }
  return { added, skipped, merged };
}
async function copyDirectory(srcDir, destDir, result, dryRun, syncMetadata) {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join10(srcDir, entry.name);
    const destPath = join10(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, result, dryRun, syncMetadata);
    } else {
      if (!dryRun) {
        const mergeResult = await mergeAndWriteFile(
          srcPath,
          destPath,
          syncMetadata
        );
        if (mergeResult.action === "created") {
          result.added.push(destPath);
        } else if (mergeResult.action === "skipped") {
          result.skipped.push(destPath);
        } else if (mergeResult.action === "merged") {
          result.merged.push(destPath);
        }
      } else {
        result.skipped.push(destPath);
      }
    }
  }
}

// src/generators/partials/apps.ts
import { readdir as readdir2 } from "fs/promises";
import { join as join11 } from "path";
async function addApps(options, components, syncMetadata) {
  const added = [];
  const skipped = [];
  const merged = [];
  const { targetDir, templateDir, config } = options;
  for (const component of components) {
    const componentName = component === "web" ? "web" : component;
    const srcDir = join11(templateDir, "apps", componentName);
    const destDir = join11(targetDir, "apps", componentName);
    info(`Adding app component: ${componentName}`);
    await copyDirectory2(
      srcDir,
      destDir,
      { added, skipped, merged },
      config.dryRun,
      syncMetadata
    );
  }
  return { added, skipped, merged };
}
async function copyDirectory2(srcDir, destDir, result, dryRun, syncMetadata) {
  const entries = await readdir2(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join11(srcDir, entry.name);
    const destPath = join11(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory2(srcPath, destPath, result, dryRun, syncMetadata);
    } else {
      if (!dryRun) {
        const mergeResult = await mergeAndWriteFile(
          srcPath,
          destPath,
          syncMetadata
        );
        if (mergeResult.action === "created") {
          result.added.push(destPath);
        } else if (mergeResult.action === "skipped") {
          result.skipped.push(destPath);
        } else if (mergeResult.action === "merged") {
          result.merged.push(destPath);
        }
      } else {
        result.skipped.push(destPath);
      }
    }
  }
}

// src/generators/partials/config.ts
import { readdir as readdir3, readFile } from "fs/promises";
import { join as join12, relative as relative2, sep } from "path";
async function addConfigFiles(options, syncMetadata) {
  const added = [];
  const skipped = [];
  const merged = [];
  const { targetDir, templateDir, config } = options;
  info("Adding config files from template root");
  const excludedPaths = /* @__PURE__ */ new Set([
    ".claude",
    "docs/einja",
    "CLAUDE.md",
    ".mcp.json",
    "node_modules",
    ".turbo",
    "next-env.d.ts",
    "styled-system",
    "pnpm-lock.yaml",
    "package-lock.json",
    "packages",
    "apps"
  ]);
  const gitignorePatterns = await loadGitignorePatterns(templateDir);
  await copyConfigDirectory(
    templateDir,
    targetDir,
    templateDir,
    // rootDir として templateDir を渡す
    { added, skipped, merged },
    config.dryRun,
    excludedPaths,
    gitignorePatterns,
    syncMetadata
  );
  return { added, skipped, merged };
}
async function loadGitignorePatterns(templateDir) {
  const patterns = /* @__PURE__ */ new Set();
  const gitignorePath = join12(templateDir, ".gitignore");
  try {
    const content = await readFile(gitignorePath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const pattern = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
        patterns.add(pattern);
      }
    }
  } catch {
  }
  return patterns;
}
async function copyConfigDirectory(srcDir, destDir, rootDir, result, dryRun, excludedPaths, gitignorePatterns, syncMetadata) {
  const entries = await readdir3(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join12(srcDir, entry.name);
    const destPath = join12(destDir, entry.name);
    const rawRelativePath = relative2(rootDir, srcPath);
    const relativePath = rawRelativePath.split(sep).join("/");
    if (shouldExclude(relativePath, excludedPaths, gitignorePatterns)) {
      continue;
    }
    if (entry.isDirectory()) {
      await copyConfigDirectory(
        srcPath,
        destPath,
        rootDir,
        // rootDir を引き継ぐ
        result,
        dryRun,
        excludedPaths,
        gitignorePatterns,
        syncMetadata
      );
    } else {
      if (!dryRun) {
        const mergeResult = await mergeAndWriteFile(
          srcPath,
          destPath,
          syncMetadata
        );
        if (mergeResult.action === "created") {
          result.added.push(destPath);
        } else if (mergeResult.action === "skipped") {
          result.skipped.push(destPath);
        } else if (mergeResult.action === "merged") {
          result.merged.push(destPath);
        }
      } else {
        result.skipped.push(destPath);
      }
    }
  }
}
function shouldExclude(relativePath, excludedPaths, gitignorePatterns) {
  for (const excluded of excludedPaths) {
    if (relativePath === excluded || relativePath.startsWith(`${excluded}/`)) {
      return true;
    }
  }
  for (const pattern of gitignorePatterns) {
    if (matchPattern(relativePath, pattern)) {
      return true;
    }
  }
  return false;
}
function matchPattern(path, pattern) {
  if (pattern.endsWith("/")) {
    const dirPattern = pattern.slice(0, -1);
    return path === dirPattern || path.startsWith(`${dirPattern}/`);
  }
  if (pattern.includes("*")) {
    const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
    return new RegExp(`^${regexPattern}$`).test(path);
  }
  return path === pattern || path.startsWith(`${pattern}/`);
}

// src/commands/add.ts
function getTemplatePath2(templateName) {
  const __filename3 = fileURLToPath2(import.meta.url);
  const __dirname3 = dirname4(__filename3);
  const distPath = join13(__dirname3, "../templates", templateName);
  const srcPath = join13(__dirname3, "../../templates", templateName);
  if (existsSync6(distPath)) {
    return distPath;
  }
  if (existsSync6(srcPath)) {
    return srcPath;
  }
  return distPath;
}
async function loadTemplateSyncMetadata(templateDir) {
  const syncFilePath = join13(templateDir, ".einja-sync.json");
  try {
    const content = await readFile2(syncFilePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function mergeSyncMetadata(template, existing) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const jsonPaths = template?.jsonPaths ?? existing?.jsonPaths ?? { managed: {}, seed: {} };
  return {
    version: template?.version ?? existing?.version ?? "1.0.0",
    lastSync: now,
    templateVersion: template?.templateVersion ?? "1.0.0",
    files: { ...existing?.files ?? {}, ...template?.files ?? {} },
    jsonPaths
  };
}
async function addCommand(options) {
  try {
    const targetDir = process.cwd();
    let config;
    if (options.skipPrompts) {
      config = getDefaultAddConfig();
      info("\u30C7\u30D5\u30A9\u30EB\u30C8\u8A2D\u5B9A\u3092\u4F7F\u7528\u3057\u307E\u3059\uFF08\u3059\u3079\u3066\u306E\u30B3\u30F3\u30DD\u30FC\u30CD\u30F3\u30C8\u3092\u9078\u629E\uFF09");
    } else {
      config = await promptAddConfig(options.dryRun);
    }
    config.dryRun = options.dryRun;
    if (config.dryRun) {
      warn("dry-run\u30E2\u30FC\u30C9: \u5B9F\u969B\u306E\u30D5\u30A1\u30A4\u30EB\u64CD\u4F5C\u306F\u884C\u3044\u307E\u305B\u3093");
      info("\n--- \u8FFD\u52A0\u4E88\u5B9A\u306E\u30B3\u30F3\u30DD\u30FC\u30CD\u30F3\u30C8 ---");
      if (config.components.packages) {
        info(
          `- packages/: ${config.packageComponents.join(", ")}`
        );
      }
      if (config.components.apps) {
        info(`- apps/: ${config.appComponents.join(", ")}`);
      }
      if (config.components.config) {
        info("- \u76F4\u4E0B\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB: turbo.json, pnpm-workspace.yaml \u7B49");
      }
      info("---\n");
    }
    const templateDir = getTemplatePath2("default");
    if (!existsSync6(templateDir)) {
      throw new Error("\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: default");
    }
    const templateMetadata = await loadTemplateSyncMetadata(templateDir);
    const existingMetadata = await loadSyncMetadata(targetDir);
    const syncMetadata = mergeSyncMetadata(templateMetadata, existingMetadata);
    const addOptions = {
      targetDir,
      templateDir,
      config
    };
    let totalAdded = 0;
    let totalMerged = 0;
    let totalSkipped = 0;
    if (config.components.packages && config.packageComponents.length > 0) {
      const spinner = ora4("\u30D1\u30C3\u30B1\u30FC\u30B8\u3092\u8FFD\u52A0\u4E2D...").start();
      try {
        const result = await addPackages(
          addOptions,
          config.packageComponents,
          syncMetadata
        );
        totalAdded += result.added.length;
        totalMerged += result.merged.length;
        totalSkipped += result.skipped.length;
        spinner.succeed(
          `\u30D1\u30C3\u30B1\u30FC\u30B8\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F\uFF08\u8FFD\u52A0: ${result.added.length}, \u30DE\u30FC\u30B8: ${result.merged.length}, \u30B9\u30AD\u30C3\u30D7: ${result.skipped.length}\uFF09`
        );
      } catch (error2) {
        spinner.fail("\u30D1\u30C3\u30B1\u30FC\u30B8\u306E\u8FFD\u52A0\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        throw error2;
      }
    }
    if (config.components.apps && config.appComponents.length > 0) {
      const spinner = ora4("\u30A2\u30D7\u30EA\u3092\u8FFD\u52A0\u4E2D...").start();
      try {
        const result = await addApps(
          addOptions,
          config.appComponents,
          syncMetadata
        );
        totalAdded += result.added.length;
        totalMerged += result.merged.length;
        totalSkipped += result.skipped.length;
        spinner.succeed(
          `\u30A2\u30D7\u30EA\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F\uFF08\u8FFD\u52A0: ${result.added.length}, \u30DE\u30FC\u30B8: ${result.merged.length}, \u30B9\u30AD\u30C3\u30D7: ${result.skipped.length}\uFF09`
        );
      } catch (error2) {
        spinner.fail("\u30A2\u30D7\u30EA\u306E\u8FFD\u52A0\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        throw error2;
      }
    }
    if (config.components.config) {
      const spinner = ora4("\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB\u3092\u8FFD\u52A0\u4E2D...").start();
      try {
        const result = await addConfigFiles(addOptions, syncMetadata);
        totalAdded += result.added.length;
        totalMerged += result.merged.length;
        totalSkipped += result.skipped.length;
        spinner.succeed(
          `\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F\uFF08\u8FFD\u52A0: ${result.added.length}, \u30DE\u30FC\u30B8: ${result.merged.length}, \u30B9\u30AD\u30C3\u30D7: ${result.skipped.length}\uFF09`
        );
      } catch (error2) {
        spinner.fail("\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB\u306E\u8FFD\u52A0\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        throw error2;
      }
    }
    if (!config.dryRun) {
      syncMetadata.lastSync = (/* @__PURE__ */ new Date()).toISOString();
      await saveSyncMetadata(targetDir, syncMetadata);
    }
    success("\n\u2713 \u8FFD\u52A0\u5B8C\u4E86\uFF01\n");
    if (config.dryRun) {
      info("\uFF08dry-run\u30E2\u30FC\u30C9\u306E\u305F\u3081\u3001\u5B9F\u969B\u306E\u5909\u66F4\u306F\u884C\u308F\u308C\u3066\u3044\u307E\u305B\u3093\uFF09\n");
    }
    info(`\u8FFD\u52A0\u3055\u308C\u305F\u30D5\u30A1\u30A4\u30EB: ${totalAdded}\u500B`);
    info(`\u30DE\u30FC\u30B8\u3055\u308C\u305F\u30D5\u30A1\u30A4\u30EB: ${totalMerged}\u500B`);
    info(`\u30B9\u30AD\u30C3\u30D7\u3055\u308C\u305F\u30D5\u30A1\u30A4\u30EB: ${totalSkipped}\u500B
`);
    const packageJsonPath2 = join13(targetDir, "package.json");
    if (existsSync6(packageJsonPath2)) {
      const packageJson2 = await import(packageJsonPath2);
      const hasEinjaCli = packageJson2.default?.devDependencies?.["@einja/dev-cli"] || packageJson2.default?.dependencies?.["@einja/dev-cli"];
      if (!hasEinjaCli) {
        info("\u6B21\u306E\u30B9\u30C6\u30C3\u30D7:");
        info("1. pnpm install");
        info("2. pnpm dev:setup");
        info("\n\u63A8\u5968:");
        info("  einja\u958B\u767A\u652F\u63F4CLI (@einja/dev-cli) \u306E\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB:");
        info("  pnpm add -D @einja/dev-cli\n");
      } else {
        info("\u6B21\u306E\u30B9\u30C6\u30C3\u30D7:");
        info("1. pnpm install");
        info("2. pnpm dev:setup\n");
      }
    } else {
      info("\u6B21\u306E\u30B9\u30C6\u30C3\u30D7:");
      info("1. pnpm install");
      info("2. pnpm dev:setup\n");
    }
  } catch (error2) {
    error("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F:");
    if (error2 instanceof Error) {
      error(error2.message);
    } else {
      error(String(error2));
    }
    process.exit(1);
  }
}

// src/cli.ts
var __filename2 = fileURLToPath3(import.meta.url);
var __dirname2 = dirname5(__filename2);
var packageJsonPath = join14(__dirname2, "../package.json");
var packageJson = JSON.parse(readFileSync5(packageJsonPath, "utf-8"));
var program = new Command();
program.name("create-einja-app").description("CLI tool to create new projects with Einja Management Template").version(packageJson.version);
program.argument("[project-name]", "Project name").option("--skip-git", "Skip git initialization").option("--skip-install", "Skip package installation").option("-y, --yes", "Skip interactive prompts").action(
  async (projectName, options) => {
    await createCommand(projectName, options);
  }
);
program.command("setup").description("Setup tools for existing project").action(async () => {
  await setupCommand();
});
program.command("add").description("Add einja components to existing monorepo").option("-y, --yes", "Skip prompts and use defaults (select all)").option("--all", "Select all components (same as -y)").option("--dry-run", "Preview changes without making them").action(
  async (options) => {
    await addCommand({
      skipPrompts: options.yes || options.all || false,
      dryRun: options.dryRun || false
    });
  }
);
program.parse();
//# sourceMappingURL=cli.js.map